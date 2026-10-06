# SPEC 11 — Seed del usuario de prueba `pending` (para la protección de rutas)

> **Estado:** Borrador
> **Depende de:** SPEC 09 — Tabla `users`
> **Fecha:** 2026-10-05
> **Objetivo:** Agregar un cuarto usuario de prueba con perfil `parent`/`pending` a `supabase/seed/0001_staff_users.sql` para que la rama de guard de SPEC 10 sea verificable en lugar de ser código sin cubrir.

## Alcance

**Incluye:**

- Un cuarto usuario en el seed existente, **`pending@solas.test`** / `solas-dev-password`, con nombre "Pending Solas" en la guardería "Guardería Sala Soles", siguiendo la convención de nombres de fixture de los tres que ya están (`Admin Soles`, `Staff Soles`, `Parent Estrellas`).
- Su alta por el mismo camino que los otros tres: fila en `auth.users` con `raw_app_meta_data.daycare_id` + fila en `auth.identities`. El perfil en `public.users` lo crea el trigger `on_auth_user_created` como `parent`/`pending`.
- **La particularidad del caso:** este usuario se deja **fuera** del `update` final que promueve rol y estado. Los otros tres terminan en `active`; este se queda en `pending` a propósito, que es exactamente el estado que el guard de SPEC 10 tiene que rechazar.
- Actualizar el comentario de cabecera del seed, que hoy afirma que "el `update` final es la operación explícita que resuelve el rol" y con cuarto usuario ya no es cierto para todos.
- Verificación con `execute_sql` (lectura) y una segunda corrida para confirmar idempotencia.

**Fuera de alcance (specs futuros):**

- **Migración de cualquier tipo.** Esto no es DDL: no hay columnas, índices, constraints, políticas ni funciones nuevas. `list_migrations` no debe cambiar.
- Estados nuevos en el enum `user_status` (no existe `blocked`, `invited` ni nada que le sirva al alta por invitación).
- El alta por invitación que produce `pending` desde la app: es SPEC 10 "fuera de alcance" y necesita Edge Function o `service_role` para escribir `app_metadata.daycare_id`.
- Cualquier dato de `daycares`, niños o publicaciones.
- Cambios en las contraseñas de los tres usuarios existentes (son credenciales de desarrollo asumidas por SPEC 09).
- Un proceso de "activar la cuenta": promover este usuario a `active` a mano es el mecanismo de prueba del criterio de SPEC 10 que dice que un pending no debe poder entrar.

## Modelo de datos

**No se introduce ninguna estructura.** El usuario se apoya en el schema de SPEC 09 sin cambios:

```sql
-- auth.users + auth.identities: alta de GoTrue, escrita por el seed.
-- public.users: la fila la crea el trigger, no el seed.
--   role   = 'parent'  (forzado por handle_new_user)
--   status = 'pending' (forzado por handle_new_user, nunca promovido por el seed)
```

Los cuatro usuarios de prueba quedan:

| Email | Contraseña | `role` | `status` | Guardería |
| --- | --- | --- | --- | --- |
| `admin@solas.test` | `solas-dev-password` | `admin` | `active` | Guardería Sala Soles |
| `staff@solas.test` | `solas-dev-password` | `staff` | `active` | Guardería Sala Soles |
| `parent@estrellas.test` | `estrellas-dev-password` | `parent` | `active` | Guardería Estrellas |
| `pending@solas.test` | `solas-dev-password` | `parent` | `pending` | Guardería Sala Soles |

## Arquitectura / Patrones

El seed sigue el patrón que fijó SPEC 09 y que AGENTS.md vuelve norma: los seeds viven en `supabase/seed/<NNN>_<nombre>.sql`, se aplican con `execute_sql` y **nunca** con `apply_migration` (no aparecen en `list_migrations` ni los re-aplica un `db push`), porque escriben en `auth.users` y `auth.identities`, tablas internas de GoTrue cuya forma cambia entre versiones y que contienen credenciales de desarrollo.

La idempotencia se mantiene con las dos guardas que ya usa el archivo: `where not exists` en los tres `insert` y el `update` condicionado a `is distinct from`. Agregar el cuarto usuario no puede romper esa propiedad: el `update` ni lo menciona, así que una segunda corrida no lo toca.

El alta tiene que seguir el mismo camino que un signup real, y esa es la razón de ser de este seed: si se insertara la fila de `public.users` a mano, el `pending` sería un artificio que no se parecería en nada al caso que SPEC 10 tiene que manejar.

## Plan de implementación

1. **Editar el seed.** En `supabase/seed/0001_staff_users.sql`: sumar `('pending@solas.test', 'Pending Solas', 'Guardería Sala Soles', 'solas-dev-password')` al `values` del `insert` en `auth.users`; sumar `'pending@solas.test'` a la lista del `where u.email in (...)` del `insert` en `auth.identities`; **no** tocar el `update` final; y corregir el comentario de cabecera para explicar que el `update` promueve a tres de los cuatro y que el cuarto se queda en `pending` a propósito. Verificar que el `join public.daycares d on d.name = v.daycare_name` resuelve para el nuevo valor ("Guardería Sala Soles" ya existe). Verify: el archivo sigue siendo SQL válido y su `where not exists` no cambia.
2. **Aplicar con `execute_sql`.** Correr el archivo con `execute_sql` (MCP), nunca con `apply_migration`. Verify: la query de control de abajo devuelve 4 en `auth.users` y 4 en `public.users`.
3. **Query de prueba.**
   ```sql
   select u.email, p.role::text, p.status::text, d.name
   from auth.users u
   join public.users p on p.id = u.id
   join public.daycares d on d.id = p.daycare_id
   order by u.email;
   ```
   Verify: `pending@solas.test` aparece con `role = parent` y `status = pending`; los otros tres, con `active`.
4. **Idempotencia.** Volver a aplicar el archivo con `execute_sql` y comparar conteos y `updated_at` de `public.users`. Verify: siguen siendo 4 filas en cada tabla y ningún `updated_at` cambió.
5. **Chequeo de migraciones.** `list_migrations` debe seguir mostrando solo `create_daycares` y `create_users`, y `get_advisors('security')` no debe reportar nada nuevo. Verify: ambos antes y después son iguales.

## Criterios de aceptación

- [ ] `supabase/seed/0001_staff_users.sql` sigue siendo idempotente y no se aplicó con `apply_migration`.

- [ ] `auth.users` tiene 4 filas y una de ellas es `pending@solas.test` con `email_confirmed_at` no nulo y su `auth.identities` con `provider = 'email'`.

- [ ] `public.users` tiene 4 filas y la de `pending@solas.test` tiene `role = 'parent'`, `status = 'pending'` y `daycare_id` apuntando a Guardería Sala Soles.

- [ ] Los tres usuarios preexistentes siguen con su rol y `status = 'active'` intactos (naming, filas y `updated_at` sin cambios).

- [ ] `pending@solas.test` con `solas-dev-password` successfully autentica contra Supabase Auth: es una sesión válida con un perfil que el guard debe rechazar.

- [ ] Una segunda corrida del seed no crea filas nuevas ni bumpea ningún `updated_at` en `public.users`.

- [ ] `list_migrations` no muestra ninguna migración nueva y `get_advisors('security')` no reporta nada que no estuviera antes.

- [ ] El comentario de cabecera del seed refleja que el `update` final promueve a tres de los cuatro usuarios.

## Decisiones

- **Sí:** un seed, no una migración. La única forma de tener un `auth.users` real con su `identity` y su perfil creado por el trigger es pasar por el alta real de GoTrue; y eso no pertenece al historial de migraciones.
- **Sí:** `role = 'parent'`. Lo impone `handle_new_user` sin importar qué se pase: el rol de una cuenta recién dada de alta nunca se decide en el alta, se resuelve después con una operación explícita de `service_role`. Forzar `staff` en el seed contradiría el diseño de SPEC 09.
- **Sí:** queda en `pending` y por eso se lo excluye del `update` final. Ese es el objetivo del seed: cubrir la rama del guard. Si se promoviera a `active`, el caso se volvería indistinguible del de `staff@solas.test`.
- **Sí:** nombre de fixture "Pending Solas", no un nombre de persona real. Sigue la convención de los tres que ya están y deja claro en la UI que es una cuenta de prueba.
- **Sí:** guardería "Guardería Sala Soles", no Estrellas. Lo que hay que cubrir del guard es "perfil que existe pero no puede usar la app", no el aislamiento entre guarderías, y `daycares_select_own` ya resuelve el aislamiento.
- **Sí:** contraseña `solas-dev-password`, la misma que los otros dos usuarios de Sala Soles. Es una credencial de desarrollo ya asumida en SPEC 09 y el repositorio es local.
- **No:** un estado `blocked` o `rejected` en `user_status`. El enum tiene `pending` y `active` porque son los dos estados que el trigger y la promoción producen; agregar un tercero sin un flujo que lo produzca es un estado muerto.
- **No:** borrar ni modificar los tres usuarios existentes. Son la base de las pruebas de SPEC 10 y de cualquier pantalla que protege.
- **No:** un flujo de activación de cuenta. Que el guard trate al `pending` como bloqueado es de SPEC 10; esto solo le da el dato.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Agregar una fila al `values` del `insert` de `auth.users` sin `raw_app_meta_data.daycare_id` hace fallar el trigger y aborta el seed entero | Se copia exactamente la forma de las tres filas existentes, que ya traen `daycare_id`; la query del paso 3 lo delata si falta |
| El `insert` en `auth.identities` no incluye el email nuevo y el login por email no resuelve | Agregar el email a la lista del `where u.email in (...)`; criterio de aceptación con un login exitoso |
| Que el `update` final promueva por accidente al cuarto usuario y el caso pending desaparezca | El `update` se deja intacto; criterio de aceptación explícito sobre `status = 'pending'` y la segunda corrida |
| El seed se aplica con `apply_migration` y aparece en `list_migrations`, dejando historial contaminado | SPEC 09 ya lo prohíbe por escrito y AGENTS.md lo repite; criterio de aceptación que compara `list_migrations` antes y después |
| Quedar creyendo que el seed "en teoría" tiene el usuario y no aplicarlo nunca | Paso 2 explícito con `execute_sql` y paso 3 con query de control, ambos en el plan |

## Lo que **no** está en este spec

- Cualquier cambio de schema: columnas, índices, constraints, enums, funciones, triggers o políticas.
- El alta de cuentas por invitación desde la app (Edge Function que escriba `app_metadata.daycare_id` y promueva el rol).
- Un estado distinto de `pending` para cuentas no activadas.
- Datos de `daycares`, niños o publicaciones.
- Gestión de contraseñas, reset, o cualquier cambio en las credenciales de los usuarios existentes.

Cada uno de esos, si llega, va en su propio spec.
