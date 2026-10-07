# SPEC 16 — `handle_new_user` con creación diferida (app_metadata llega en el UPDATE de GoTrue)

> **Estado:** Aprobado\
> **Depende de:** SPEC 09 — `users` (trigger `handle_new_user`), SPEC 13 — Invitación padre, SPEC 14 — Activación de cuenta\
> **Fecha:** 2026-10-07\
> **Objetivo:** Corregir un defecto del contrato de `handle_new_user` (SPEC 09) que bloqueó la E2E de SPEC 14: GoTrue inserta `auth.users` con solo `user_metadata` y escribe `app_metadata` en un **UPDATE posterior**, de forma que el trigger `AFTER INSERT` nunca veía el `daycare_id` y abortaba `admin.createUser` con `handle_new_user: falta daycare_id en raw_app_meta_data`. Este spec convierte la creación del perfil en **idempotente y diferida**: el perfil se crea cuando el `UPDATE` de GoTrue aterriza el metadata, vía un nuevo trigger `AFTER UPDATE`.

## Por qué existe este spec

La E2E de la activación (SPEC 14) reprodujo el fallo con datos reales: `createParentAccountAction` llama a `supabase.auth.admin.createUser` con `app_metadata: { role, status, daycare_id }`, y GoTrue respondía `P0001: handle_new_user: falta daycare_id en raw_app_meta_data`. Se descartaron, con evidencia, el SDK (`supabase-js` envía el JSON correcto, capturado en el wire), el cuerpo REST directo, y la validación del trigger (un insert SQL con el mismo `daycare_id` pasaba). La inspección del código de GoTrue (`internal/api/admin.go` y `internal/models/user.go`, rama `master`) probó la causa real:

1. `adminUserCreate` crea el usuario con `models.NewUser(phone, email, pwd, aud, params.UserMetaData)` — el 5º argumento es **`user_metadata`**. El `INSERT` a `auth.users` nace sin `app_metadata`.
2. Si venía `params.AppMetaData`, se aplica **después**, con `user.UpdateAppMetaData(tx, ...)` → `tx.UpdateOnly(user, "raw_app_meta_data")` — un **`UPDATE` posterior** dentro de la misma transacción.

El trigger `AFTER INSERT` de SPEC 09 se ejecutaba cuando `raw_app_meta_data` aún no tenía `daycare_id` y abortaba la transacción completa. Como las únicas cuentas creadas hasta ahora lo fueron por **insert SQL** (seeds con `daycare_id` presente al insert), el defecto no se había manifestado.

**Decisión de diseño:** no se mueve la autorización a `raw_user_meta_data` (editable por el usuario — definitivamente prohibido en AGENTS.md y en los comentarios de SPEC 09). Se conserva `raw_app_meta_data` como única fuente de tenancy y se **difiere** la creación del perfil al momento en que GoTrue lo escribe. Un `UPDATE` a `raw_app_meta_data` en el flujo de activación dispara el trigger `AFTER UPDATE`, que crea el perfil parent/pending. Semántica para el seed de staff (insert SQL con daycare presente): el perfil sigue creándose al `INSERT`, sin cambios.

## Alcance

**Incluye:**

- Nueva migración `supabase/migrations/20261007052343_defer_user_profile_until_app_metadata.sql` (aplicada con `apply_migration`; nombre reconciliado con la `version` devuelta):
  - `create or replace function public.handle_new_user()`: rework con dos `early return` nuevos —
    1. perfil ya existe (`id` en `public.users`) → `return new` (idempotencia entre el INSERT y cada UPDATE posterior de `auth.users`; **nunca** pisa `role`/`status`, que nacen `parent`/`pending` y se gestionan por RPC);
    2. `daycare_id` ausente en `raw_app_meta_data` → `return new` (el UPDATE de GoTrue lo traerá y este mismo trigger creará el perfil en ese instante).
  - Los `raise exception` por `daycare_id` **no uuid** o **guardería inexistente** se conservan: siguen siendo contratos rotos (ese metadata lo escribimos nosotros).
  - Nuevo trigger `on_auth_user_updated` (`after update on auth.users`). El `on_auth_user_created` existente se mantiene intacto.
  - `revoke execute` repetido (barato, autodocumentado) sobre ambas funciones.
- Normalización de scripts ad-hoc de la sesión de debugging (descartados del historial de migraciones): drop del event trigger `ensure_rls` y su función `public.rls_auto_enable()` (artefacto de probe, nunca versionado), y limpieza de usuarios de sonda (`probe-upd@test.dev`, `e2e-fix-probe@test.dev`) — ambos eliminados con `execute_sql`.

**Fuera de alcance:**

- Cambiar la fuente de tenancy (sigue siendo `raw_app_meta_data`).
- Sincronizar `role`/`status` de perfiles existentes desde metadata (ruido; los escribe la app vía RPC).
- Habilitar `Leaked Password Protection` del proyecto (ajuste del dashboard de Auth) — queda como recomendación de seguimiento.

## Comportamiento resultante

| Camino | INSERT | UPDATE siguiente | Perfil `public.users` |
|---|---|---|---|
| Seed de staff (insert SQL, daycare presente) | trigger crea perfil | — | `staff`/`active` según seed |
| Activación de padre (SPEC 14: `admin.createUser` → `UpdateOnly raw_app_meta_data`) | `return new` (sin daycare aún) | trigger crea perfil | `parent`/`pending` |
| Signup no tipado (sin tenancy) | `return new` (sin error) | — | ninguno (fail-closed vía RLS) |

La validación de la corrección fue empírica end-to-end: `POST /auth/v1/admin/users` con `app_metadata` real devolvió el usuario creado y `public.users` quedó con `role=parent`, `status=pending`, `full_name` de `user_metadata` y el `daycare_id` correcto.

## Verificación

- Tras la migración: `list_migrations`, `get_advisors('security')`/`get_advisors('performance')`, y probe `createUser` + `select` a `public.users` (ver "Comportamiento resultante"). Los `lints` de `anon_security_definer_function_executable` sobre `rls_auto_enable` desaparecieron con su drop.
- La E2E de SPEC 14 repite el flujo completo por UI (hoy pasa el happy path).