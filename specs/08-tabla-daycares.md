# SPEC 08 — Tabla raíz `daycares` y patrón de migraciones

> **Estado:** Approved\
> \*\***Depende de:** SPEC 00 — Arquitectura\
> \*\***Fecha:** 2026-10-05\
> \*\***Objetivo:** Crear la tabla raíz `daycares` en Supabase con la primera migración versionada del proyecto, fijando el patrón de migraciones del repo (archivo en `supabase/migrations/` aplicado vía MCP) con RLS habilitado y una fila semilla.

## Por qué existe este spec

Es la primera migración real del proyecto y el resto del esquema (`rooms`, `children`, `users`, `posts`, …) depende del patrón que aquí se fija. Además destapa una decisión de seguridad que hoy no está escrita en ningún lado: en este proyecto los `default privileges` del esquema `public` otorgan `arwdDxtm` a `anon` y `authenticated` sobre **toda tabla nueva**, así que el ACL es permisivo por omisión y **el RLS es la única puerta**. Sin esa claridad, la primera tabla con datos reales queda legible por la Data API pública.

Estado verificado de la base al momento de escribir este spec (2026-10-05):

| Dato | Valor |
| --- | --- |
| Tablas en `public` | 0 |
| Políticas en `public` | 0 |
| Postgres | 17.11 |
| Extensiones | `pgcrypto`, `uuid-ossp`, `plpgsql`, `supabase_vault`, `pg_stat_statements` |
| Historial de migraciones | 2 entradas de smoke test (`20261005170536 smoke_test_table`, `20261005171322 drop_smoke_test_table`) |
| `default privileges` en `public` | `anon=arwdDxtm`, `authenticated=arwdDxtm`, `service_role=arwdDxtm` |
| Project ref | `zvtgjvsqehhvutyrbsil` |
| Advisors de seguridad (baseline) | 2 WARN por `public.rls_auto_enable()` (`SECURITY DEFINER` ejecutable por `anon` y `authenticated`) — **preexistentes, ajenos a esta migración** |

`gen_random_uuid()` es nativo desde Postgres 13, así que no hace falta `create extension` (aunque `pgcrypto` ya esté instalada).

## Alcance

**Incluye:**

- `supabase/config.toml` (nuevo): archivo declarativo **mínimo** con `project_id` y un comentario que explique que la CLI de Supabase no está instalada y que las secciones restantes las completa `supabase init` cuando se monte.
- `supabase/migrations/<version>_create_daycares.sql` (nuevo): el SQL de la primera migración, con un encabezado corto que declara su fuente de verdad (sección 1 del diccionario) y que se aplica vía MCP `apply_migration`.
- La tabla `public.daycares` en el proyecto Supabase: `id uuid PK default gen_random_uuid()`, `name text not null` con `check (length(btrim(name)) > 0)`, `created_at timestamptz not null default now()`; `comment on table`; y `alter table ... enable row level security` **sin ninguna política**.
- Una fila semilla `('Guardería Sala Soles')` en la misma migración, con el `id` generado por el default (nunca hardcodeado) e `insert` guardado por un `where not exists` para que la migración sea re-ejecutable.
- Una sección de **diseño de RLS** para `daycares` —qué operación cubre cada política, el predicado exacto y el SQL de referencia— que se escribe y se razona acá pero **no se aplica** en esta migración.
- El nombre del archivo de migración reconciliado con la `version` que devuelve `apply_migration`, para que repo e historial no divergan.
- `AGENTS.md`: actualizar la sección Supabase para documentar el patrón de migraciones y sacar `supabase/migrations/` de la lista de pendientes (el cliente y la CLI siguen pendientes).

**Fuera de alcance (specs futuros):**

- Las otras tablas del diccionario (`users`, `rooms`, `children`, `parent_children`, `invitations`, `posts`, `post_children`, `post_photos`, `reactions`, `comments`, `daily_summaries`, `devices`) y los 7 enums.
- **Aplicar** cualquier política de RLS. El SQL de las políticas queda especificado en la sección de diseño de RLS y lo aplica el spec de `users`, que es el que crea la tabla sobre la que el predicado de ownership consulta.
- `GRANT` explícitos para el Data API y el toggle de exposición del dashboard.
- Cliente de Supabase en la app (`@supabase/supabase-js` + `@supabase/ssr`), `proxy.ts` de refresh de sesión y vars `NEXT_PUBLIC_SUPABASE_*`.
- Instalar la Supabase CLI, `supabase link`, stack local (`supabase start`) y Edge Functions.
- Trigger de `AFTER INSERT` sobre `auth.users` (va con la tabla `users`).
- Corregir los 2 WARN preexistentes de `public.rls_auto_enable()`.
- `updated_at` en `daycares` (el diccionario no lo lista para esta tabla).

## Modelo de datos

SQL exacto de la migración (este bloque es el que se aplica y el que se commitea):

```sql
-- SPEC 08 — tabla raíz `daycares`.
-- Fuente de verdad del esquema: ../07-DB-Schema/opendaycare-database-schema.md, sección 1.
-- Aplicar con el MCP de Supabase (`apply_migration`); nunca editar la base a mano.

create table if not exists public.daycares (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null,
  created_at timestamptz not null default now(),
  constraint daycares_name_not_blank check (length(btrim(name)) > 0)
);

comment on table public.daycares is 'La guardería como entidad raíz del modelo.';

alter table public.daycares enable row level security;

insert into public.daycares (name)
select 'Guardería Sala Soles'
where not exists (select 1 from public.daycares where name = 'Guardería Sala Soles');
```

Convenciones:

- PK `uuid` con `gen_random_uuid()`, timestamps `timestamptz` — las del diccionario.
- Todo lo persistido en inglés; `'Guardería Sala Soles'` es un **valor de dato** seed (nombre visible de la entidad), no un tag ni un código.
- La fila semilla no lleva `id` explícito: lo emite el default.
- Sin `unique (name)` a propósito (ver Decisiones).

## Arquitectura / Patrones

Este spec es **Infraestructura pura**: no toca Dominio, Aplicación ni Presentación. Los mocks de `data/mock/` siguen siendo la fuente de datos de la app, exactamente igual que antes.

- **Nuevo (infraestructura de BD):** `supabase/config.toml`, `supabase/migrations/<version>_create_daycares.sql`.
- **Modificado (docs):** `AGENTS.md` (sección Supabase).
- **Sin cambios:** `app/`, `components/`, `lib/`, `data/`, `.env`, `.env.example`, `package.json`.
- **Regla de dependencia de la SPEC 00:** se mantiene sin esfuerzo — nada en `app/` ni `components/` sabe que esta tabla existe.

El patrón que este spec fija para las próximas tablas:

1. Se escribe el `.sql` en `supabase/migrations/` con el timestamp del momento.
2. Se aplica con `apply_migration` (MCP), que versiona el cambio en el historial `supabase_migrations`.
3. Se renombra el archivo al `version` que devolvió `apply_migration`, si difieren.
4. Se verifica con `list_tables` + un probe de `execute_sql` + `get_advisors('security')` y `get_advisors('performance')`.

`apply_migration` es el único mecanismo de DDL. `execute_sql` queda para lectura y diagnóstico; no escribe DDL.

## Diseño de RLS para `daycares` (especificado, **no** aplicado en esta migración)

Esta sección fija el contrato de autorización de `daycares`. No es código ejecutable hoy: el predicado de ownership necesita `public.users` (`users.daycare_id`, `users.role`, `users.status`), que este spec no crea. El SQL es el que el spec de `users` va a aplicar; escribirlo de más o de menos sería inventar autorización.

### Por qué `daycares` no puede llevar una política hoy

`daycares` no tiene columna de ownership. La relación es indirecta: la única forma de saber si el `auth.uid()` actual pertenece a una guardería es preguntarle a `users`. Con RLS habilitado y cero políticas, la posición actual es *deny-all* para `anon` y `authenticated` — que es exactamente la posición segura. Agregar la primera política es un acto que abre algo, así que va en el spec que también crea la tabla que la respalda, no en un spec que solo crea una tabla raíz.

### El predicado de ownership

Dentro de una política, la fila bajo prueba se referencia por el nombre de la tabla (`daycares.id`). El usuario actual es dueño de ella si y solo si tiene un perfil activo en esa guardería:

```sql
exists (
  select 1
  from public.users u
  where u.daycare_id = daycares.id
    and u.id = (select auth.uid())
    and u.status = 'active'
)
```

Tres decisiones embebidas:

- `u.status = 'active'`**.** `user_status` tiene `pending` y `active`; un perfil `pending` es el estado previo al signup modelado en `invitations`. Si el predicado no lo filtra, un perfil no activado lee la guardería. Es el filtro que convierte "tiene sesión" en "está activado".
- `u.id = (select auth.uid())`**, con el** `select` **envolviendo.** `auth.uid()` es Stable y no volátil, pero sin el envoltorio Postgres la evalúa una vez **por fila** candidata. Envuelta en un `select` se resuelve a un `InitPlan` y se calcula una vez por consulta. En una tabla de guarderías grande la diferencia es de orden de magnitud, no de porcentaje.
- `exists` **sobre** `users`**, y no una comparación directa.** El ownership de `daycares` es indirecto: no hay columna que compararse en la propia tabla, así que el filtro tiene que vivir en `users`. `exists` corta en la primera coincidencia en lugar de materializar el perfil, y es semi-join: no duplica filas de `daycares`.

### Las políticas

```sql
-- Lectura: cualquier usuario activo de esa guardería.
create policy daycares_select_own on public.daycares
  for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = daycares.id
      and u.id = (select auth.uid())
      and u.status = 'active'
  ));

-- Escritura: solo un admin de esa guardería renombra.
create policy daycares_update_admin on public.daycares
  for update
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = daycares.id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role = 'admin'
  ))
  with check (exists (
    select 1 from public.users u
    where u.daycare_id = daycares.id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role = 'admin'
  ));
```

Puntos que no son negociables en el spec que lo aplique:

| Punto | Por qué |
| --- | --- |
| `to authenticated`, nunca `auth.role()` | `auth.role()` está deprecado y con sign-in anónimo rompe en silencio: un usuario anónimo trae el rol `authenticated` y pasa el check sin estar autenticado de verdad. El rol va en la cláusula `TO`. |
| `to authenticated` **más** predicado de ownership | Solo `TO authenticated` es autenticación sin autorización (BOLA/IDOR): cualquier usuario autenticado leería todas las guarderías. La combinación es lo que hace la política. |
| `with check` en el `update` | `USING` filtra la fila que ya existía; `WITH CHECK` valida la fila **resultante**. Aquí parece redundante porque `daycares.id` es la PK y no debería cambiar, pero `id` es una columna cualquiera para Postgres: sin el `with check` un admin podría reescribir el `id` y mover la guardería fuera de su alcance. Se mantiene porque el costo es un `exists` más. |
| El `update` necesita la política `select` | En RLS de Postgres un `UPDATE` primero hace `SELECT` de la fila. Sin política `SELECT`, un `update` devuelve 0 filas **sin error**. Las dos van en la misma migración. |
| Sin política `insert` ni `delete` | Alta y borrado de guarderías quedan solo por SQL con `service_role`. Ausencia de política = denegado, aunque el ACL por default dé `arwdDxtm`. |
| Índice en `users (daycare_id, id)` | El predicado se evalúa por fila de `daycares`; sin índice cada fila es un seq scan sobre `users`. Se crea en el spec de `users`. |
| Nombre de política `<tabla>_<acción>_<sujeto>` | `daycares_select_own`, `daycares_update_admin`. Legible en `pg_policies` sin tener que abrir el DDL. |

### Cómo esto se verifica cuando se aplique

El spec de `users` no debe dar por buena la política porque compila. El probe tiene que fijar la variable de sesión de `auth.uid()` y ejecutar **como** `authenticated`, con tres filas de prueba: un admin del daycare, un parent del mismo daycare y un parent de otro:

```sql
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"<uuid-admin>","role":"authenticated"}';
  select count(*) as rows_visible from public.daycares;               -- > 0
  update public.daycares set name = 'Guardería Sala Soles' where true; -- 1 fila
rollback;
```

`request.jwt.claims` es el GUC que `auth.uid()` lee, así que fijarlo es lo que hace que el predicado tenga un sujeto. El bloque cierra con `rollback` a propósito: el `update` tiene que ejecutarse para probar que la política deja escribir, y no debe commitear. Repetir con `<uuid-parent-mismo-daycare>` (vee la fila, `update` afecta 0 filas) y con `<uuid-parent-otro-daycare>` (0 filas visibles).

Casos que tienen que verificarse, no solo compilar: admin del daycare renombra y ve; parent del mismo daycare lee y no escribe; admin de otro daycare no ve; `anon` no ve nada; y `update` ejecutado sin la política `select` devuelve 0 filas sin error, que es el modo de falla silencioso de RLS.

### Condiciones que el spec de `users` tiene que cumplir para que este contrato sea válido

1. `users.daycare_id` es `not null`. Si admitiera `null`, un perfil sin guardería tendría `u.daycare_id = null` y nunca coincidiría con `daycares.id` — inofensivo en la práctica, pero el predicado quedaría expresando una regla que el schema no respalda.
2. `users.id` es PK y FK a `auth.users(id)`, con el **mismo** UUID. El predicado compara contra `auth.uid()`, que es el `sub` del JWT.
3. `users` tiene RLS habilitado **con cero políticas** hasta que su propio spec aplique las suyas. Si `users` quedara con alguna política permisiva, el `exists` del predicado de `daycares` se ejecutaría con los permisos de quien llama y podría devolver filas que el usuario no debería ver.
4. Existe índice en `users (daycare_id, id)`.

El punto 3 es el que más fácil se rompe: `daycares` no filtra nada si `users` filtra poco.

## Plan de implementación

1. **Directorio y config.** Crear `supabase/config.toml` con el bloque de más abajo (mínimo, sin secciones que la CLI no va a leer todavía). Verify: archivo commiteado, sin efecto en la base de datos.

   ```toml
   # Configuración de Supabase del proyecto.
   #
   # La CLI de Supabase NO está instalada (decisión del SPEC 08), así que este archivo no
   # salió de `supabase init`: es declarativo y mínimo. Cuando se monte la CLI,
   # `supabase init` / `supabase config push` completarán las secciones restantes.
   #
   # Las migraciones se aplican con el MCP de Supabase (`apply_migration`), que registra cada
   # cambio en el historial `supabase_migrations` de la base. El SQL vive commiteado en
   # `supabase/migrations/`.
   
   project_id = "zvtgjvsqehhvutyrbsil"
   ```

2. **SQL de la migración.** Crear `supabase/migrations/<timestamp>_create_daycares.sql` con el SQL exacto de la sección Modelo de datos. Usar el timestamp del momento en formato `YYYYMMDDHHMMSS` (14 dígitos), que se reconcilia en el paso 4. Verify: el archivo existe y el SQL es copiable tal cual a `apply_migration`.

3. **Aplicar la migración.** Llamar `apply_migration` con `name: create_daycares` y el SQL del paso 2 sin modificar. Guardar el `version` que devuelve. Si el MCP responde con error de conexión, reintentar una vez antes de tocar nada más (el historial de este proyecto ya intermitió una vez en esta sesión). Verify: `list_migrations` muestra una tercera entrada `create_daycares`, y `list_tables(['public'])` incluye `daycares`.

4. **Reconciliar el nombre.** Comparar el `version` del paso 3 con el prefijo del nombre del archivo. Si difieren, renombrar el archivo a `<version>_create_daycares.sql`. Repo e historial quedan con la misma versión. Verify: `git status` muestra el archivo con el nombre final y sin contenido modificado.

5. **Probe de estructura.** Ejecutar el probe de abajo con `execute_sql` y comprobar columnas, RLS, políticas, ACL y fila semilla. Si el MCP no permite `set local role`, verificar el mismo hecho por metadata (`relrowsecurity = true` + 0 políticas) y anotarlo al cerrar el spec. Verify: el probe no devuelve filas de `pg_class` con `relrowsecurity = false` y `count(*)` de `daycares` es 1.

   ```sql
   select c.relname,
          c.relrowsecurity,
          c.relforcerowsecurity,
          (select count(*) from pg_policies p
             where p.schemaname = 'public' and p.tablename = c.relname) as policies,
          has_table_privilege('anon', c.oid, 'SELECT') as anon_select_granted
   from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
   order by c.relname;
   
   select column_name, data_type, is_nullable, column_default
   from information_schema.columns
   where table_schema = 'public' and table_name = 'daycares'
   order by ordinal_position;
   
   select id, name, created_at from public.daycares;
   ```

6. **Advisors.** Ejecutar `get_advisors('security')` y `get_advisors('performance')`. Ningún lint de WARN o superior puede apuntar a `daycares`. Los 2 WARN de `public.rls_auto_enable()` son el baseline: si aparecen nuevos, arreglar antes de cerrar. El lint INFO `rls_enabled_no_policy` es **esperado**: la tabla tiene RLS y cero políticas por decisión de diseño, así que el advisor informa el deny-all que se quiere. No se "arregla" — limpiarlo exigiría aplicar una política, que este spec excluye explícitamente. Verify: diff mental contra el baseline de la tabla de arriba.

7. **Documentar el patrón.** En `AGENTS.md`, sección Supabase: reemplazar la línea de pendientes que menciona `supabase/migrations/` por la descripción del patrón (archivo commiteado + `apply_migration` + reconciliación de versión + verificación con advisors), y dejar en la lista de pendientes solo el cliente de Supabase y la CLI. Agregar la advertencia de que `public` otorga `arwdDxtm` a `anon`/`authenticated` por default, así que RLS habilitado con cero políticas es lo que mantiene la tabla cerrada. Verify: `AGENTS.md` ya no dice que el directorio de migraciones está pendiente.

8. **Redactar el diseño de RLS.** Escribir la sección "Diseño de RLS para `daycares`" de este spec: el predicado de ownership, el SQL de las dos políticas (`select` para cualquier usuario activo del daycare, `update` solo para admin con `using` + `with check`), la tabla de puntos no negociables, el probe de verificación con `set local request.jwt.claims` y las 4 condiciones que el spec de `users` tiene que cumplir. Es documentación: nada de esto se aplica ni se commitea como SQL. Verify: la sección existe en el spec, el SQL no aparece en `supabase/migrations/*_create_daycares.sql`, y `pg_policies` sigue devolviendo 0 filas para `daycares` después de aplicar la migración.

9. **Chequeo final.** `npm run lint && npm run build` en limpio (el repo de app no cambió: sirve para confirmar que nada se rompió). Revisar `git status` para confirmar que solo hay `supabase/` y `AGENTS.md` modificados, y que `.env` no aparece. Verificar en el diff que el contenido del `.sql` es idéntico al que se aplicó.

## Criterios de aceptación

- [ ] Existe `supabase/config.toml` con `project_id = "zvtgjvsqehhvutyrbsil"` y sin secciones inventadas para la CLI.

- [ ] `supabase/migrations/` contiene exactamente un archivo `.sql`, nombrado `<version>_create_daycares.sql`.

- [ ] El prefijo `<version>` del archivo es igual a la `version` que registró `apply_migration` para `create_daycares` (verificable comparando con `list_migrations`).

- [ ] El SQL del archivo commiteado es idéntico al enviado a `apply_migration`.

- [ ] `list_tables(['public'])` lista `daycares`.

- [ ] `daycares` tiene exactamente 3 columnas: `id uuid` (PK, default `gen_random_uuid()`, `is_nullable = NO`), `name text` (`NOT NULL`), `created_at timestamptz` (default `now()`, `is_nullable = NO`). No existe `updated_at`.

- [ ] Existe el constraint `daycares_name_not_blank`; un `insert` con `name = ''` y otro con `name = ' '` fallan por check (probe dentro de `begin`/`rollback`).

- [ ] `relrowsecurity = true` y `relforcerowsecurity = false` para `public.daycares`.

- [ ] `pg_policies` devuelve 0 filas para `daycares`.

- [ ] `has_table_privilege('anon', 'public.daycares', 'SELECT')` es `true` (lo otorgan los `default privileges` del proyecto) y, aun con ese privilegio, un `select count(*)` ejecutado como `anon` devuelve 0 filas: el RLS sin políticas cierra la tabla.

- [ ] `public.daycares` tiene exactamente 1 fila, con `name = 'Guardería Sala Soles'` y un `id` `uuid` no nulo (ningún id hardcodeado en el SQL).

- [ ] Re-ejecutar el mismo SQL no crea una segunda fila con el mismo nombre.

- [ ] El archivo de migración no contiene ninguna sentencia `grant` ni `revoke`.

- [ ] `get_advisors('security')` no reporta ningún lint de nivel **WARN o superior** que nombre `daycares`. Los 2 WARN de `public.rls_auto_enable` son baseline preexistente y quedan fuera. El lint **INFO** `rls_enabled_no_policy` **sí aparece** y queda waived por la decisión de RLS con cero políticas: describe el deny-all deliberado de la tabla, no una fuga — la postura correcta se verifica por probe (`relrowsecurity = true`, 0 políticas, `anon` ve 0 filas), no por ausencia de lints.

- [ ] `get_advisors('performance')` no reporta ningún lint que nombre `daycares`.

- [ ] El spec tiene una sección de diseño de RLS para `daycares` con: el predicado de ownership (`exists` sobre `users` filtrando `daycare_id`, `id = (select auth.uid())` y `status = 'active'`), el SQL de la política `select` y de la política `update` (solo `admin`, con `using` **y** `with check`), y la nota de que `update` requiere la política `select` para no devolver 0 filas en silencio.

- [ ] Ninguna de las políticas documentadas aparece aplicada: `pg_policies` devuelve 0 filas para `daycares` y el `.sql` commiteado no contiene `create policy`.

- [ ] `AGENTS.md` documenta el patrón de migraciones y ya no lista `supabase/migrations/` como pendiente; la CLI y el cliente siguen listados como pendientes.

- [ ] `npm run lint` y `npm run build` terminan sin errores.

- [ ] `git status` no muestra `.env` ni ningún archivo de credenciales; el diff toca solo `supabase/` y `AGENTS.md`.

## Decisiones

- **Sí:** montar `supabase/migrations/` y `config.toml` en el mismo spec que la primera tabla. El patrón se prueba con algo real; un spec de infra sin caso de uso queda en teoría.
- **Sí:** el SQL vive commiteado en el repo y se aplica con `apply_migration`. El archivo es el artefacto revisable en diff; el MCP es el mecanismo de aplicación y versionado. Esto sigue lo que ya manda `AGENTS.md`.
- **Sí:** reconciliar el nombre del archivo con la `version` que devuelve `apply_migration`. Sin esto, el historial de la BD y los nombres de archivo divergen y el primer `db push` intentará re-aplicar la migración.
- **No:** la Supabase CLI, por ahora. No hace falta para aplicar por MCP, y evita agregar \~100MB de paquete a `devDependencies` hasta que se necesiten `db push`, Edge Functions o la stack local. Cuando llegue, `supabase init` completa el `config.toml` mínimo.
- **No:** código de la app ni `.env`. Nada consume `daycares` todavía; el cliente y las vars `NEXT_PUBLIC_*` llegan con el spec que monte el cliente. Un `.env.example` con vars sin uso sería ruido.
- **No:** `updated_at` en `daycares`. El diccionario lista solo `id`, `name`, `created_at` para esta tabla. Agregarlo "por consistencia" crea divergencia con el documento que es la fuente de verdad.
- **Sí:** RLS habilitado con **cero políticas**. Es la posición segura y no tiene costo: no hay consumidor. La primera política necesita el predicado de ownership sobre `users`, que no existe.
- **Sí:** documentar el diseño de RLS de `daycares` en este spec sin aplicarlo. La primera política de una tabla es la decisión con más consecuencias del esquema y merece estar escrita y razonada antes de que exista el predicado que la habilita. Documentarla acá también deja escrito el contrato que el spec de `users` tiene que cumplir (`daycare_id not null`, `id` = `auth.users.id`, `users` con RLS y cero políticas, índice en `(daycare_id, id)`).
- **No:** aplicar la primera política en este spec. Una policy mal escrita expone filas, y no se puede probar con tres roles distintos (admin, parent del mismo daycare, parent de otro) hasta que exista el perfil que el predicado consulta. `daycares` con RLS y cero políticas ya está en deny-all, que es deny-all de verdad: no hay nada que perder esperando.
- **No:** función `security definer` en un schema privado para evaluar el ownership. Con una guardería por defecto y `users` en cardinalidad chica, un `exists` indexado es suficiente y evita meter el primer `security definer` del proyecto — que la skill de Supabase marca como superficie pública por defecto mientras la función viva en `public`. Si el número de guarderías crece, la función se introduce con el spec que lo justifique, con `revoke execute` a `anon`/`authenticated` y `auth.uid()` dentro del cuerpo.
- **No:** política de `insert` ni de `delete` para `daycares`. Alta y borrado de guarderías son operaciones administrativas que no tienen consumidor desde el cliente; dejarlas sin política las mantiene en `service_role` aunque el ACL por default conceda `arwdDxtm`.
- **Sí:** sin `GRANT` explícitos, con la fecha de enforced del changelog anotada en Riesgos. Como el ACL por default ya da `SELECT` a `anon` y `authenticated`, un `grant` adicional sería redundante; lo que hace falta cuando exista un cliente es exposure en el dashboard, no SQL.
- **Sí:** una fila semilla en la misma migración. Deja la tabla con datos y da destino real a las FK de `rooms` y `users` que vengan después. Con el `where not exists` la migración sigue siendo re-ejecutable sin duplicar.
- **No:** migración de seed aparte. Una fila no justifica un segundo archivo ni un segundo paso de verificación.
- **No:** `unique (name)`. El diccionario no lo pide, y el nombre de una guardería no tiene por qué ser una clave de negocio. El `check` de no-blanco evita el caso degenerado sin agregar un índice único que restringe sin motivo.
- **Sí:** `create table if not exists`. Migraciones versionadas se aplican una vez, pero el guard de idempotencia cuesta una línea y hace seguro re-aplicar tras un fallo parcial.
- **No:** tocar `public.rls_auto_enable()`. Los 2 WARN son preexistentes y de plataforma, no de esta migración. El criterio de aceptación compara contra el baseline en vez de exigir cero lints.
- **Sí:** aceptar el lint INFO `rls_enabled_no_policy` que la propia tabla dispara. El criterio de aceptación se amendó para exigir solo lints de WARN o superior: el criterio original ("ningún lint que nombre `daycares`") era insatisfacible, porque el estado que este spec decide —RLS habilitado con cero políticas— es exactamente el que el advisor reporta. La tabla cerrada se demuestra por probe, no por silencio de lints.
- **No:** corregir la divergencia menor de `default privileges` en `public` (la entrada de `postgres` y la de `supabase_admin` son distintas). Fuera de alcance; se documenta en Riesgos.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El ACL por default da `arwdDxtm` a `anon`/`authenticated` en `public`, así que el RLS es la única puerta | `enable row level security` va en la **misma** migración que el `create table`, y el criterio de aceptación exige el probe `set local role anon` → 0 filas. La fila semilla nunca es legible por la API. |
| Changelog 2026-04-28: desde **2026-10-30** las tablas nuevas de `public` dejan de exponerse al Data API por defecto (hoy es opt-in) | No hay consumidores, así que nada se rompe el 30 de octubre. El spec que monte el cliente debe revisar exposure en el dashboard + `GRANT` antes de leer `daycares` desde la app. Queda anotado aquí a propósito. |
| La `version` que devuelve `apply_migration` puede diferir del timestamp del nombre del archivo | Paso 4 del plan reconcilia el nombre **antes** de commitear; el criterio de aceptación compara ambos. |
| El MCP intermitió (`list_migrations` falló con error de conexión y funcionó al reintentar) | Reintentar una vez ante error de conexión. El SQL es idempotente (`if not exists` + `where not exists`), así que un reintento no duplica ni deja la tabla a medias. |
| Un fallo entre el paso 3 y el paso 4 deja la BD adelantada al repo | El SQL está en disco desde el paso 2: si el nombre queda sin reconciliar, el archivo sigue siendo la fuente y se renombra después. |
| `config.toml` mínimo puede no ser lo que la CLI espera cuando se monte | Declarado explícitamente en el comentario del archivo; `supabase init` / `supabase config push` completa las secciones. Ninguna tooling del proyecto lo lee hoy. |
| Sin stack local no hay dónde iterar el SQL antes de aplicarlo | DDL chico y revisado contra el diccionario; `execute_sql` sirve para inspeccionar el estado antes y después. Cuando se monte la CLI, `supabase db reset` habilita el ciclo local. |
| Los 2 WARN de `public.rls_auto_enable()` hacen ruido en cada corrida de advisors | Baseline registrado en la cabecera del spec; el criterio de aceptación compara contra él en vez de exigir cero lints. |
| El diseño de RLS documentado queda sin verificar hasta que exista `users`, y para entonces puede estar desactualizado | Las 4 condiciones del contrato y el probe de verificación con `set local request.jwt.claims` están escritos acá; el spec de `users` tiene que ejecutarlos antes de dar sus políticas por buenas. Un spec de diseño sin ejecutar no es una garantía — es una decisión tomada temprano. |
| El predicado de `daycares` consulta `users`, así que una política permisiva en `users` se filtra hacia `daycares` | Declarado como condición 3 del contrato. `users` va con RLS habilitado y cero políticas hasta que su propio spec aplique las suyas. |

## Lo que **no** está en este spec

- Las otras tablas del diccionario y los 7 enums.
- Aplicar políticas de RLS (quedan **especificadas** en la sección de diseño, no aplicadas), `GRANT` explícito o toggle de exposición en el dashboard.
- Cliente de Supabase en la app, `proxy.ts`, vars `NEXT_PUBLIC_SUPABASE_*`, `.env.example`.
- Supabase CLI, `supabase link`, stack local, Edge Functions.
- Trigger de `AFTER INSERT` sobre `auth.users` (va con `users`).
- `updated_at` en `daycares`.
- Arreglar `public.rls_auto_enable()` o la divergencia de `default privileges` en `public`.
- Cualquier cambio en `app/`, `components/`, `lib/` o `data/`.

Cada uno de esos, si llega, va en su propio spec.