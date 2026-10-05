# SPEC 09 — Tabla `users`, sus enums y el RLS de ownership

> **Estado:** Approved\
****Depende de:** SPEC 00 — Arquitectura, SPEC 08 — Tabla raíz `daycares`\
****Fecha:** 2026-10-05\
****Objetivo:** Crear la tabla `users` con sus dos enums (`user_role`, `user_status`), el trigger `AFTER INSERT` sobre `auth.users` que la puebla, su propio RLS de ownership, las dos políticas de `daycares` que SPEC 08 dejó especificadas sin aplicar, y un seed de tres usuarios de prueba.

## Por qué existe este spec

`daycares` quedó con RLS habilitado y **cero políticas** a propósito (SPEC 08): es la posición segura, y la primera política necesita un predicado de ownership que consulte `public.users`, la tabla que todavía no existía. Este spec es el que crea esa tabla y **cierra el contrato**: sin él, `daycares` no tiene consumidor, `users` no tiene por dónde poblarse, y la autorización del proyecto es un documento sin código que la respalde.

Detesta también el primer `SECURITY DEFINER` del proyecto, y lo hace sobre la superficie que más daño puede hacer: una función que inserta filas de perfil desde el signup. La decisión de dónde lee el `role` y el `daycare_id` no es un detalle de implementación — es la frontera entre "un padre se registra" y "un padre se auto-nombra admin".

Estado verificado de la base al momento de escribir este spec (2026-10-05, por `list_tables`, `list_migrations` y `execute_sql` de solo lectura):

| Dato | Valor |
| --- | --- |
| Tablas en `public` | 1 (`daycares`, 1 fila, RLS sin políticas) |
| Políticas en `pg_policies` (`public`) | 0 |
| Enums en `public` | 0 |
| Filas en `auth.users` | 0 |
| Triggers no internos en `auth.users` | 0 |
| Historial de migraciones | 3 entradas (2 de smoke test + `create_daycares`) |
| Project ref | `zvtgjvsqehhvutyrbsil` |
| `default privileges` en `public` | `anon=arwdDxtm`, `authenticated=arwdDxtm`, `service_role=arwdDxtm` |
| Rol con que corre `execute_sql` (MCP) | `postgres` — `rolbypassrls = true`, `rolsuper = false` |
| `rolbypassrls` de los demás | `service_role=true`, `supabase_auth_admin=false`, `authenticated=false`, `anon=false` |
| `pgcrypto` | instalada, pero en el schema `extensions`: `extensions.crypt`, `extensions.gen_salt`. **No** en `public`. |
| `auth.users.id` | `uuid` **sin default** — el que inserte tiene que supplying el UUID |
| `auth.users.is_anonymous` | existe, `not null default false` |
| `auth.identities` | PK `id`; `unique (provider_id, provider)`; FK `user_id → auth.users(id) on delete cascade`; tiene columnas `email` e `identity_data` |
| `auth.uid()` | `coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid` |
| Advisors de seguridad (baseline) | 2 **WARN** por `public.rls_auto_enable()` (`SECURITY DEFINER` ejecutable por `anon` y `authenticated`) y 1 **INFO** `rls_enabled_no_policy` sobre `daycares` |
| Advisors de performance (baseline) | 0 lints |

Tres de esos datos cambian el SQL de este spec y no son evidentes:

- `supabase_auth_admin` **tiene** `rolbypassrls = false` **y no aparece en los** `default privileges` **de** `public`**.** GoTrue inserta en `auth.users` con ese rol, así que el `AFTER INSERT` se dispara con sus privilegios. Sin `SECURITY DEFINER` la función no puede escribir en `public.users`: no tiene privilegio de INSERT ni salta el RLS. El `SECURITY DEFINER` no es una preferencia de estilo acá, es lo que hace que el signup funcione.
- `pgcrypto` **está en** `extensions`**.** `crypt(...)` sin calificar no resuelve; el seed tiene que llamar `extensions.crypt` y `extensions.gen_salt`.
- `auth.users.id` **no tiene default.** El seed genera el UUID explícitamente.

## Modelo de datos

Enums (los dos que esta tabla necesita; los otros cinco del diccionario pertenecen a tablas que todavía no existen):

```sql
create type public.user_role   as enum ('staff', 'parent', 'admin');
create type public.user_status as enum ('pending', 'active');
```

Tabla:

```sql
create table if not exists public.users (
  id                    uuid              primary key references auth.users(id) on delete cascade,
  daycare_id            uuid              not null references public.daycares(id) on delete restrict,
  role                  public.user_role   not null,
  status                public.user_status not null default 'active',
  full_name             text              not null,
  avatar_url            text,
  notify_on_post        boolean           not null default true,
  daily_summary_enabled boolean           not null default true,
  created_at            timestamptz       not null default now(),
  updated_at            timestamptz       not null default now(),
  constraint users_full_name_not_blank check (length(btrim(full_name)) > 0)
);

comment on table public.users is 'Perfil de aplicación vinculado a Supabase Auth; el email y la contraseña viven en auth.users.';

create index if not exists users_daycare_id_idx on public.users (daycare_id);
```

Funciones:

```sql
create or replace function public.set_updated_at() returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
declare
  v_raw         text;
  v_daycare_id  uuid;
  v_name        text;
begin
  -- GoTrue emite un `auth.users` por cada signup, incluidos los anónimos.
  -- Un perfil anónimo no es un usuario del producto.
  if new.is_anonymous then
    return new;
  end if;

  -- `daycare_id` se lee de `raw_app_meta_data`, que escribe el servidor.
  -- `raw_user_meta_data` lo puede editar el usuario: leer el tenancy de ahí
  -- permitiría que cualquiera se autoasigne a otra guardería.
  v_raw := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'daycare_id', '')), '');
  if v_raw is null then
    raise exception 'handle_new_user: falta `daycare_id` en raw_app_meta_data (auth.users.id=%)', new.id;
  end if;

  begin
    v_daycare_id := v_raw::uuid;
  exception when invalid_text_representation then
    raise exception 'handle_new_user: `daycare_id` no es un uuid válido: %', v_raw;
  end;

  if not exists (select 1 from public.daycares d where d.id = v_daycare_id) then
    raise exception 'handle_new_user: `daycare_id` % no corresponde a ninguna guardería', v_daycare_id;
  end if;

  -- `full_name` no es dato de autorización: sí se lee de `raw_user_meta_data`.
  v_name := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  if v_name is null then
    v_name := nullif(split_part(coalesce(new.email, ''), '@', 1), '');
  end if;
  if v_name is null then
    raise exception 'handle_new_user: no hay `full_name` en raw_user_meta_data ni email del que derivarlo (auth.users.id=%)', new.id;
  end if;

  -- El rol y el estado NO se leen de ningún metadata: nacen `parent`/`pending`.
  insert into public.users (id, daycare_id, role, status, full_name)
  values (new.id, v_daycare_id, 'parent', 'pending', v_name);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function public.set_updated_at()   from public, anon, authenticated, service_role;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

RLS y políticas:

```sql
alter table public.users enable row level security;

create policy users_select_own on public.users
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy users_update_self on public.users
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Las dos que SPEC 08 especificó y dejó sin aplicar. El SQL es el de SPEC 08,
-- sin cambios: el predicado ahora sí tiene la tabla que consulta.
create policy daycares_select_own on public.daycares
  for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = daycares.id
      and u.id = (select auth.uid())
      and u.status = 'active'
  ));

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

Y el cierre de la escalada de privilegios, que es la parte que el RLS solo no resuelve:

```sql
revoke update on table public.users from anon, authenticated;

grant update (full_name, avatar_url, notify_on_post, daily_summary_enabled)
  on table public.users to authenticated;
```

Seed (archivo aparte, **no** es migración — ver Plan, paso 6). Estructura:

```
Guardería Estrellas                    ← segunda guardería, la crea el seed
admin@solas.test     → admin   → Guardería Sala Soles
staff@solas.test     → staff   → Guardería Sala Soles
parent@estrellas.test → parent → Guardería Estrellas

Por cada usuario: fila en auth.users (id = gen_random_uuid(), encrypted_password =
extensions.crypt(<dev password>, extensions.gen_salt('bf')), email_confirmed_at =
now(), raw_app_meta_data = {"daycare_id": <uuid>} — eso dispara el trigger, que
deja el perfil en parent/pending) + fila en auth.identities (provider = 'email',
provider_id = auth.users.id::text, identity_data = {"sub","email","email_verified"})
+ un update a role/status finales.
```

Los tres usuarios mapean las tres ramas del predicado de ownership de `daycares`:

| Usuario | Rama que prueba |
| --- | --- |
| `admin@solas.test` | `exists` con `role = 'admin'` → ve **y** escribe `daycares` |
| `staff@solas.test` | `exists` sin `role = 'admin'` → ve `daycares`, no escribe. Cubre el caso de SPEC 08 ("parent del mismo daycare"): el predicado filtra por `daycare_id`, `id` y `status`, no por `role` |
| `parent@estrellas.test` | `exists` con otro `daycare_id` → ve **1 fila, la suya** (`'Guardería Estrellas'`) y 0 de `'Guardería Sala Soles'`. Aísla por `daycare_id`, no por identidad de guardería |

Convenciones:

- Todo lo persistido en inglés: los valores de enum son los del diccionario (`staff`, `pending`) y los valores de dato seed (los nombres de guardería y de las cuentas) van en español porque son los que se muestran en pantalla.
- PK `uuid`; `users.id` **no** lleva default: es el mismo UUID que `auth.users.id`.
- `role` y `status` son `not null` aunque el diccionario no lo diga: un `role` nulo haría que `u.role = 'admin'` fuera `null` (fail-closed, pero un predicado que expresa una regla que el schema no respalda), y un `status` nulo dejaría perfiles invisibles para `daycares` por accidente y no por decisión.
- `daycare_id` es `on delete restrict`, no `cascade`: borrar una guardería no puede dejar perfiles huérfanos en silencio. SPEC 08 dejó el borrado de guarderías en `service_role`, así que la restricción es coherente con esa decisión.
- Las preferencias (`notify_on_post`, `daily_summary_enabled`) son `not null default true` como dice el diccionario; un `null` en una preferencia es indistinguible de "no decidido".
- Nombres: constraint `users_full_name_not_blank`, índice `users_daycare_id_idx`, políticas `<tabla>_<acción>_<sujeto>` — las tres convenciones de SPEC 08.

## Arquitectura / Patrones

Este spec es **Infraestructura pura**, igual que SPEC 08: no toca Dominio, Aplicación ni Presentación. Los mocks de `data/mock/` siguen siendo la fuente de datos de la app.

- **Nuevo (infraestructura de BD):** `supabase/migrations/<version>_create_users.sql`, `supabase/seed/0001_staff_users.sql`.
- **Modificado (docs):** `specs/08-tabla-daycares.md` (dos amends, ver Plan paso 9), `AGENTS.md` (sección Supabase).
- **Sin cambios:** `app/`, `components/`, `lib/`, `data/`, `package.json`, `.env`, `.env.example`, `supabase/config.toml`.
- **Regla de dependencia de la SPEC 00:** se mantiene sin esfuerzo. Nada en `app/` ni `components/` sabe que `users` existe.

Dos convenciones nuevas que este spec fija para las tablas que vengan:

1. **El seed no es una migración.** Va en `supabase/seed/`, se aplica con `execute_sql` y nunca con `apply_migration`. El motivo es concreto: el seed escribe en `auth.users` y `auth.identities`, que son tablas internas de GoTrue cuya forma cambia entre versiones, y contiene credenciales de desarrollo. Eso no pertenece al historial de migraciones, que es el registro de la forma del esquema. El archivo queda versionado igual — es revisable en diff — pero `list_migrations` no lo muestra y un `db push` no lo re-aplica.
2. `set search_path = ''` **en toda función.** Con el `search_path` vacío, cualquier referencia sin calificar falla en vez de resolverse contra el primer esquema que aparezca en la lista. Es la defensa contra el search-path hijacking, y con `SECURITY DEFINER` es la diferencia entre una función que escribe en `public.users` y una que escribe donde le digan.

### Cómo el RLS de `users` sostiene el de `daycares`

El predicado de `daycares` contiene un `exists` sobre `public.users`, y ese subquery se evalúa **con los privilegios de quien llama**, así que el RLS de `users` se le aplica encima. Con `users_select_own` el subquery queda reducido a `u.id = auth.uid()` — que es exactamente la condición que el predicado ya exige, y además fail-closed: si mañana una política de `users` se afloja, el `exists` sigue teniendo que pasar por `users_select_own`. Este es el punto 3 del contrato de SPEC 08, y por eso `users` no puede quedar sin política `select` en este spec aunque nadie la necesite desde el cliente.

## Plan de implementación

 1. **Enums.** Crear `public.user_role` y `public.user_status`. `create type` no admite `if not exists`, así que va dentro de un bloque `do $$ ... $$` que chequee `pg_type`. Verify: `select typname, enumlabel from pg_type join pg_enum ...` devuelve 3 labels para `user_role` y 2 para `user_status`.

 2. **Tabla e índice.** Escribir el `create table` de la sección Modelo de datos, con `comment on table` y `create index if not exists users_daycare_id_idx`. Verify: `list_tables(['public'])` lista `users` con las 10 columnas esperadas y `relrowsecurity` en `false` todavía (el RLS llega en el paso 4).

 3. **Funciones y triggers.** Escribir `public.set_updated_at()` y `public.handle_new_user()`, los dos `revoke execute` y los dos `create trigger`. Los `revoke` van **después** de los `create or replace` y antes de exponer nada. Verify: `select proname, prosecdef, proconfig, proacl from pg_proc ...` muestra `prosecdef = true` y `proconfig = {search_path=""}` en `handle_new_user`, y `proacl` sin `=X/` para `anon`.

 4. **RLS y políticas.** `alter table public.users enable row level security`, las dos políticas de `users`, las dos de `daycares` copiadas textualmente de la sección de diseño de RLS de SPEC 08, y el `revoke update` + `grant update` por columnas. Verify: `pg_policies` devuelve 4 filas para `public` (2 de `users`, 2 de `daycares`); `pg_policies` devuelve 0 para `users` en `select` sobre `role`/`status` porque no existen esas políticas.

 5. **Escribir y aplicar la migración.** Guardar el SQL de los pasos 1–4 en `supabase/migrations/<timestamp>_create_users.sql` con el timestamp UTC del momento (`YYYYMMDDHHMMSS`), y aplicar con `apply_migration` (nombre `create_users`). Reconciliar el nombre del archivo con la `version` devuelta si difieren. Verify: `list_migrations` muestra una cuarta entrada y `list_tables(['public'])` lista `daycares` y `users`.

 6. **Seed.** Crear `supabase/seed/0001_staff_users.sql` con las cuatro sentencias del Modelo de datos (guardería, `auth.users`, `auth.identities`, promoción). Aplicarlo con `execute_sql`, no con `apply_migration`. Los tres `insert` llevan `where not exists` y el `update` lleva un `where (p.role <> ... or p.status <> ...)` para que una segunda corrida sea un no-op y no bumpee `updated_at`. Verify: `select email from auth.users` devuelve 3 filas, `public.users` tiene 3 filas con los roles esperados, `public.daycares` tiene 2.

 7. **Probe estructural.** Con `execute_sql`, confirmar columnas y nulabilidad de `users`, los dos enums, `relrowsecurity = true` en ambas tablas, las 4 políticas por nombre, los dos triggers, `proacl` de las dos funciones, el índice `users_daycare_id_idx`, y `column_privileges` mostrando UPDATE únicamente sobre las 4 columnas de auto-servicio para `authenticated` y ninguno para `anon`. Si el MCP no permite `set local role`, verificar lo mismo por metadata y anotarlo al cerrar el spec. Verify: el probe no devuelve ninguna fila fuera de lo esperado.

 8. **Probe de RLS de 3 roles.** Con `set local role authenticated` y `set local request.jwt.claims` apuntando al UUID de cada usuario, dentro de `begin` / `rollback`:

    ```sql
    begin;
      set local role authenticated;
      set local request.jwt.claims = '{"sub":"<uuid-admin-solas>","role":"authenticated"}';
      select count(*) from public.daycares;                                   -- 1
      select count(*) from public.users;                                      -- 1 (solo la propia)
      update public.daycares set name = name where true;                     -- 1 fila
    rollback;
    
    begin;
      set local role authenticated;
      set local request.jwt.claims = '{"sub":"<uuid-staff-solas>","role":"authenticated"}';
      select count(*) from public.daycares;                                   -- 1
      update public.daycares set name = name where true;                     -- 0 filas, sin error
    rollback;
    
    begin;
      set local role authenticated;
      set local request.jwt.claims = '{"sub":"<uuid-parent-estrellas>","role":"authenticated"}';
      select name from public.daycares;                                        -- 'Guardería Estrellas'
      select count(*) from public.daycares;                                   -- 1
      select count(*) from public.daycares
        where name = 'Guardería Sala Soles';                                   -- 0
    rollback;
    ```

    El `update` que devuelve 0 filas **sin error** es el resultado correcto del caso `staff`: es el modo de falla silencioso de RLS cuando el `USING` no matchea. El caso `parent@estrellas.test` devuelve **1 fila, la de su propia guardería** — el aislamiento se prueba por *qué* fila ve, no por un conteo de 0: con `status = 'active'` (que es lo que deja el seed del paso 6) el `exists` matchea y el padre ve su guardería, no la ajena. Un 0 sería el resultado de un perfil `pending`, que es un estado transitorio del alta y no una regla de diseño: `daycare_id` es `not null`, así que "perfil sin guardería" no existe. Por eso el probe trae el `name`: sin él, un 1 y un 0 por guardia ajena son indistinguibles de un fallo del predicado. Verify: los tres bloques devuelven 1/1/1, 1/0 y Estrellas/1/0, en ese orden.

 9. **Probe de escalada y de** `anon`**.** Con el `admin` autenticado, `update public.users set role = 'admin' where id = (select auth.uid())` debe fallar con `42501` (privilegio de columna revocado) o devolver 0 filas — lo que **no** puede hacer es dejar `role = 'admin'` en la fila. Con `set local role anon`, `select count(*) from public.daycares` y de `public.users` devuelven 0 ambas, aun con `arwdDxtm` en el ACL. Todo en `begin` / `rollback`. Verify: `role` del admin sigue siendo `admin` después del probe, y los dos conteos `anon` son 0.

10. **Probe del trigger.** Tres `insert` en `auth.users` dentro de `begin` / `rollback`: (a) con `raw_app_meta_data = {"daycare_id": "<uuid válido>"}` → crea un perfil `parent`/`pending`; (b) sin `daycare_id` en `raw_app_meta_data` → la función levanta excepción y **no** se inserta nada; (c) con `raw_user_meta_data = {"role":"admin","daycare_id":"<uuid ajeno>"}` → el perfil sale `parent` y apuntando a la guardería del `app_metadata`, no a la del `user_metadata`. En los tres casos, involved el insert en `auth.users` en `rollback`. Verify: (a) 1 fila `parent`/`pending`, (b) excepción y 0 filas en `public.users`, (c) 1 fila `parent` en el daycare del `app_metadata`.

11. **Advisors.** `get_advisors('security')` y `get_advisors('performance')`. Los 2 WARN de `public.rls_auto_enable()` son el baseline preexistente. El lint INFO `rls_enabled_no_policy` sobre `daycares` **debe desaparecer** (ahora tiene políticas) y no debe aparecer uno nuevo sobre `users`. Ningún advisor puede nombrar `public.handle_new_user`: si aparece `anon_security_definer_function_executable` o `authenticated_security_definer_function_executable`, al `revoke execute` le falta un rol. En `performance`, el único lint admisible es el INFO `unused_index` sobre `users_daycare_id_idx`, esperado por ser recién creado. Verify: ningún lint por encima de INFO salvo los 2 WARN baseline de `rls_auto_enable()`.

12. **Amendar SPEC 08.** Dos cambios puntuales en `specs/08-tabla-daycares.md`, para que no queden criterios que la base contradiga:

    - El criterio "`public.daycares` tiene exactamente 1 fila, con `name = 'Guardería Sala Soles'`" → "tiene exactamente 1 fila **al terminar la migración** `create_daycares`; el seed del SPEC 09 agrega una segunda fila (`'Guardería Estrellas'`) con fines de prueba de aislamiento".
    - La condición 4 del contrato de RLS, "Existe índice en `users (daycare_id, id)`" → "Existe un índice en `users` con `daycare_id` como columna líder (`users_daycare_id_idx`)". El `id` es la PK y sirve el predicado por igualdad única. Verify: `grep` sobre SPEC 08 no encuentra ni "exactamente 1 fila," sin la salvedad ni `(daycare_id, id)`.

13. **Documentar en** `AGENTS.md`**.** En la sección Supabase: actualizar el estado de la base (2 tablas, 2 enums, 4 políticas), cambiar la línea de `users` de la lista de pendientes, y agregar dos patrones: el seed en `supabase/seed/` aplicado con `execute_sql` (no es una migración), y la necesidad de `revoke execute` en toda función `SECURITY DEFINER` de `public` porque `default privileges` deja el schema ejecutable. Verificar también que siga pendiente el cliente de Supabase y la CLI. Verify: la sección Supabase ya no lista `users` ni `supabase/seed/` como pendientes.

14. **Chequeo final.** `npm run lint && npm run build` en limpio (el repo de app no cambió: confirma que nada se rompió). Revisar `git status` para confirmar que el diff toca solo `supabase/`, `specs/08-tabla-daycares.md` y `AGENTS.md`, y que `.env` no aparece. Comparar el SQL commiteado con el enviado a `apply_migration`.

## Criterios de aceptación

Estructura:

- [ ] Existen `public.user_role` con exactamente los labels `staff`, `parent`, `admin` y `public.user_status` con `pending`, `active`.

- [ ] `list_tables(['public'])` lista `users` con exactamente 10 columnas: `id uuid` PK `is_nullable = NO` sin default y FK a `auth.users(id) on delete cascade`; `daycare_id uuid` `NOT NULL` FK a `daycares` con `on delete restrict`; `role user_role` `NOT NULL`; `status user_status` `NOT NULL` default `'active'`; `full_name text` `NOT NULL`; `avatar_url text` nullable; `notify_on_post boolean` `NOT NULL` default `true`; `daily_summary_enabled boolean` `NOT NULL` default `true`; `created_at timestamptz` y `updated_at timestamptz` ambos `NOT NULL` default `now()`.

- [ ] Existe el constraint `users_full_name_not_blank`; un insert con `full_name = ''` y otro con `full_name = ' '` fallan por check (probe en `begin`/`rollback`).

- [ ] Existe el índice `users_daycare_id_idx` sobre `public.users (daycare_id)`.

- [ ] Existen las funciones `public.set_updated_at()` (`security invoker`) y `public.handle_new_user()` (`security definer`), y **ambas** tienen `proconfig` con `search_path=""`.

- [ ] `pg_proc.proacl` de las dos funciones no otorga `EXECUTE` a `PUBLIC`, `anon`, `authenticated` ni `service_role`.

- [ ] Existen los triggers `users_set_updated_at` (`BEFORE UPDATE` sobre `public.users`) y `on_auth_user_created` (`AFTER INSERT` sobre `auth.users`).

- [ ] `relrowsecurity = true` y `relforcerowsecurity = false` para `public.users` y para `public.daycares`.

- [ ] `pg_policies` devuelve exactamente 4 filas en `public`: `users_select_own` y `users_update_self` (`for select` / `for update`, ambas `to authenticated`), `daycares_select_own` y `daycares_update_admin` (ambas `to authenticated`). Ninguna es `for insert` ni `for delete`.

- [ ] El SQL de las dos políticas de `daycares` es idéntico al de la sección de diseño de RLS del SPEC 08.

- [ ] El archivo `supabase/migrations/` contiene exactamente dos `.sql`; el prefijo `<version>` del de `users` es igual a la `version` que registró `apply_migration` para `create_users`, y su contenido es idéntico al enviado.

- [ ] El archivo de migración **no** contiene sentencias `insert`, `update` ni `delete` sobre `auth.users` / `auth.identities` / `public.users`: el seed vive en `supabase/seed/0001_staff_users.sql`.

- [ ] `list_migrations` no contiene ninguna entrada con nombre `seed*`: el seed no entró al historial de migraciones.

Seed:

- [ ] `auth.users` tiene exactamente 3 filas: `admin@solas.test`, `staff@solas.test`, `parent@estrellas.test`, todas con `email_confirmed_at` no nulo.

- [ ] `auth.identities` tiene 3 filas, una por usuario, con `provider = 'email'` y `provider_id = auth.users.id::text`.

- [ ] `public.users` tiene exactamente 3 filas, con `role` = `admin` / `staff` / `parent` respectivamente, todas con `status = 'active'`, y `daycare_id` de `admin@solas.test` y `staff@solas.test` apuntando a `'Guardería Sala Soles'` y el de `parent@estrellas.test` a `'Guardería Estrellas'`.

- [ ] Re-ejecutar el seed no crea filas nuevas en `auth.users`, `auth.identities` ni `public.users`, ni cambia `updated_at` de los perfiles existentes.

Comportamiento del trigger:

- [ ] Un `insert` en `auth.users` con `raw_app_meta_data = {"daycare_id": "<uuid de una guardería existente>"}` crea en `public.users` una fila con `role = 'parent'` y `status = 'pending'` (probe en `begin`/`rollback`).

- [ ] Un `insert` en `auth.users` **sin** `daycare_id` en `raw_app_meta_data` levanta excepción y no deja fila en `public.users`.

- [ ] Un `insert` en `auth.users` con `daycare_id` que no es un uuid válido, o que no corresponde a ninguna fila de `daycares`, levanta excepción y no deja fila en `public.users`.

- [ ] Un `insert` en `auth.users` con `raw_user_meta_data = {"role":"admin","daycare_id":"<uuid de otra guardería>"}` y `raw_app_meta_data` de la guardería correcta crea un perfil con `role = 'parent'` y `daycare_id` **tomado del** `app_metadata`, no del `user_metadata`.

- [ ] Un `insert` en `auth.users` con `is_anonymous = true` no crea fila en `public.users`.

- [ ] Un `insert` en `auth.users` sin `full_name` en `raw_user_meta_data` crea el perfil con el local-part del email; si tampoco hay email, levanta excepción.

- [ ] Un `update` sobre cualquier columna de `public.users` deja `updated_at` mayor que el valor previo.

RLS:

- [ ] Como `authenticated` con el `sub` del admin de Sala Soles: `select count(*) from public.daycares` devuelve 1, `select count(*) from public.users` devuelve 1, y `update public.daycares set name = name where true` afecta 1 fila.

- [ ] Como `authenticated` con el `sub` del staff de Sala Soles: `select count(*) from public.daycares` devuelve 1 y `update public.daycares set name = name where true` afecta 0 filas **sin error**.

- [ ] Como `authenticated` con el `sub` del parent de Estrellas: `select name from public.daycares` devuelve exactamente `('Guardería Estrellas')` — su propia guardería y ninguna otra; `select count(*) from public.daycares` devuelve 1, y 0 filas son `'Guardería Sala Soles'`.

- [ ] Como `authenticated` con el `sub` del staff de Sala Soles: `select count(*) from public.users` devuelve 1 (solo su propia fila), no las 3.

- [ ] Con el admin autenticado, `update public.users set role = 'admin' where id = (select auth.uid())` **no** deja `role = 'admin'` en la fila: falla con `42501` por el privilegio de columna revocado, o devuelve 0 filas.

- [ ] `authenticated` sí puede actualizar `full_name`, `avatar_url`, `notify_on_post` y `daily_summary_enabled` de su propia fila (probe en `begin`/`rollback` que además confirma que `updated_at` cambió).

- [ ] Como `anon`: `select count(*) from public.daycares` y `select count(*) from public.users` devuelven 0 ambas, aun con `has_table_privilege('anon', …, 'SELECT')` en `true`.

- [ ] `has_table_privilege('authenticated', 'public.users', 'UPDATE')` es `false`, mientras `has_column_privilege('authenticated', 'public.users', 'full_name', 'UPDATE')` es `true` y `has_column_privilege('authenticated', 'public.users', 'role', 'UPDATE')` es `false`.

- [ ] No existe ninguna política de `insert` ni de `delete` en `users` ni en `daycares`: un `insert` directo en `public.users` como `authenticated` afecta 0 filas.

Advisors:

- [ ] `get_advisors('security')` no reporta ningún lint de nivel **WARN o superior** que nombre `users`, `handle_new_user`, `set_updated_at`, `users_select_own`, `users_update_self` ni las políticas de `daycares`. Los 2 WARN de `public.rls_auto_enable()` son baseline preexistente y quedan fuera.

- [ ] El lint **INFO** `rls_enabled_no_policy` que SPEC 08 aceites sobre `daycares` ya no aparece (la tabla tiene políticas) y no aparece uno nuevo sobre `users`.

- [ ] `get_advisors('performance')` no reporta ningún lint por encima de **INFO**. El único INFO admisible es `unused_index` sobre `users_daycare_id_idx`: es un índice recién creado, así que todavía no tiene estadísticas de uso, y existe por la regla de FK sobre `daycare_id`, no para acelerar una consulta concreta (el predicado de `daycares` resuelve `id` por la PK). Cualquier otro lint, o un `unused_index` sobre otro índice, no cumple el criterio.

Documentación:

- [ ] `specs/08-tabla-daycares.md` tiene las dos amendments del Plan paso 12 y ya no afirma sin salvedad que `daycares` tiene exactamente 1 fila ni que el índice es `(daycare_id, id)`.

- [ ] `AGENTS.md` documenta el patrón de seeds (`supabase/seed/` con `execute_sql`, no migración) y ya no lista `users` ni `supabase/seed/` como pendientes; el cliente de Supabase y la CLI siguen listados como pendientes.

Repo:

- [ ] `npm run lint` y `npm run build` terminan sin errores.

- [ ] `git status` no muestra `.env` ni ningún archivo de credenciales de Supabase; el diff toca solo `supabase/`, `specs/08-tabla-daycares.md` y `AGENTS.md`.

## Decisiones

- **Sí:** los dos enums que la tabla necesita (`user_role`, `user_status`), no los siete del diccionario. Los otros cinco pertenecen a tablas que no existen; crearlos ahora deja tipos sin ninguna columna que los referencie y adelanta decisiones que corresponden a los specs de `parent_children`, `invitations`, `posts` y `children`.
- **Sí:** `daycare_id not null`. Es la condición 1 del contrato de SPEC 08: con `null`, el predicado de ownership de `daycares` expresaría una regla que el schema no respalda, y un perfil sin guardería sería un agujero que nadie puede consultar.
- **Sí:** `role` y `status` `not null`, aunque el diccionario no lo diga. `status` ya trae `default 'active'`, así que el `not null` no agrega fricción; `role` sin `not null` haría que `u.role = 'admin'` fuera `null` en vez de `false` — el mismo resultado, pero un predicado que ya no se puede leer.
- **No:** cambiar el default de `status` a `pending`. El diccionario dice `active`; el trigger pasa `pending` explícito. Fail-secure suena mejor, pero contradice la fuente de verdad del esquema, y el trigger ya cubre el caso que importa.
- **Sí:** `full_name not null` + `users_full_name_not_blank`, con el mismo patrón que `daycares_name_not_blank`. Sin él, la UI tiene que manejar un nombre vacío, que ya es un caso degenerado en la base.
- **No:** validar el formato de `avatar_url`. El diccionario solo dice nullable; un check de URL sería inventar una regla.
- **Sí:** `updated_at` con la función genérica `public.set_updated_at()`. El diccionario lista `updated_at` en `users` (a diferencia de `daycares`, donde SPEC 08 lo descartó), así que la columna es parte del contrato. La función es reutilizable para cada tabla que venga con `updated_at`.
- **No:** `updated_at` por trigger de `statement` o sin trigger. Sin trigger el campo miente a partir del primer UPDATE, que es peor que no tenerlo.
- **Sí:** índice solo en `daycare_id`, no `(daycare_id, id)`. Se corrige la condición 4 del contrato de SPEC 08. El predicado de `daycares` busca `daycare_id = X and id = Y`; con `id` como PK, Postgres resuelve por el índice de la PK —una igualdad única, con el índice garantizado por la propia tabla— y filtra `daycare_id` y `status` sobre una fila. El índice compuesto agrega un segundo índice por escribir sin ganar nada en la consulta que existía para servir. El índice de `daycare_id` sí se justifica por la regla de FK: sin él, borrar una guardería hace un seq scan sobre `users`.
- **Sí:** `on delete restrict` en `daycare_id`, no `cascade`. SPEC 08 dejó el borrado de guarderías en `service_role`; con `cascade`, una operación administrativa borra en silencio todos los perfiles de esa guardería. `restrict` obliga a decidir qué pasa con los usuarios.
- **Sí:** el trigger sobre `auth.users` entra en este spec. Es el único camino por el que `users` se puebla sola, y sin él la tabla queda sin consumidor real.
- **No:** leer `role` de `raw_user_meta_data`, como sugiere la nota al pie de la tabla del diccionario. `raw_user_meta_data` es editable por el usuario y aparece en `auth.jwt()`: leer el rol de ahí es permitir que cualquiera se registre como `admin`. La nota del diccionario describe el patrón de la mayoría de los tutoriales, no una propiedad de seguridad.
- **Sí:** el trigger **fuerza** `role = 'parent'` y `status = 'pending'` y nunca los lee de ningún metadata. El rol se resuelve después, con una operación explícita de `service_role`. La consecuencia es que el alta de staff no es un signup: es un alta en `auth.users` más un `update` de perfil, que es exactamente lo que hace el seed.
- **Sí:** `daycare_id` se lee de `raw_app_meta_data`, que escribe el servidor. El tenancy no puede venir de un campo que el usuario controla.
- **Sí:** si falta `daycare_id` o no corresponde a una guardería existente, la función levanta excepción y el signup falla. Un fallback a "la única guardería que hay" ata el alta de usuarios a un supuesto de single-tenant que este proyecto no ha declarado, y un `insert` con `daycare_id = null` es imposible porque la columna es `not null`.
- **Sí:** `full_name` sí se lee de `raw_user_meta_data`, con fallback al local-part del email y excepción si no hay ninguno. El nombre no es dato de autorización: leerlo del metadata que el usuario controla no le da poder. Inventar un nombre por defecto sí crearía datos falsos en la base.
- **Sí:** el trigger no crea perfil para `auth.users.is_anonymous = true`. El signup anónimo de GoTrue emite un `auth.users` como cualquier otro, y sin este `if` cada sesión anónima deja un perfil `parent`/`pending` en `users`.
- **Sí:** las funciones en `public`, no en un schema privado, con `set search_path = ''` y `revoke execute` a `PUBLIC`/`anon`/`authenticated`/`service_role`. SPEC 08 decidió no introducir el schema privado; la postura se mantiene y la superficie se cierra con el `revoke`, que además es lo que evita que el advisor dispare. El `search_path` vacío es la defensa contra search-path hijacking y va en las dos funciones, no solo en la `SECURITY DEFINER`.
- **Sí:** `security definer` en `handle_new_user` y `security invoker` en `set_updated_at`. No es una preferencia: `supabase_auth_admin` (el rol con que GoTrue inserta en `auth.users`) tiene `rolbypassrls = false` y no está en los `default privileges` de `public`, así que sin `SECURITY DEFINER` el trigger no puede escribir en `public.users`. El propietario de la función será `postgres`, que sí tiene `bypassrls`.
- **Sí:** `users_select_own` + `users_update_self`, sin política de `insert` ni de `delete`. El alta la hace el trigger como `definer`; el borrado queda en `service_role`. Con `users_select_own` presente, el `exists` del predicado de `daycares` queda reducido a `u.id = auth.uid()`, que es la condición que el predicado ya exige — fail-closed en lugar de fail-open.
- **Sí:** `revoke update on table public.users from anon, authenticated` seguido de `grant update` sobre las cuatro columnas de auto-servicio. **Esta es la segunda puerta, y la que el RLS solo no puede ser**: `users_update_self` con `with check (id = auth.uid())` le permite a un padre actualizar su propia fila, y con privilegio de UPDATE sobre toda la tabla eso incluye `role = 'admin'` sobre sí mismo. El `with check` no lo detiene, porque `id` no cambia. Restringir el privilegio por columna es lo que cierra la escalada. El orden importa: el `revoke` va primero.
- **No:** una política `users_update_admin` para que un admin de la guardería edite el rol de cualquiera. Exigiría conceder UPDATE sobre `role`/`status`, y ese privilegio de columna no es condicional por política: aplicaría también a `users_update_self`, y volvería a abrir la escalada que el paso anterior acaba de cerrar. El alta de staff queda en `service_role`, que es el rol que ya tiene `bypassrls`.
- **No:** revocar `insert`/`delete` de `users` para `anon`/`authenticated`. La postura de SPEC 08 es que el RLS es la única puerta y la ausencia de política deniega; agregar `revoke` everywhere sería ruido. El `revoke` de UPDATE es la excepción porque hace falta algo que el RLS no expresa.
- **Sí:** el seed en `supabase/seed/0001_staff_users.sql`, aplicado con `execute_sql` y no con `apply_migration`. El seed escribe en `auth.users` y `auth.identities`, tablas internas de GoTrue cuya forma cambia entre versiones, y contiene credenciales de desarrollo. El historial de migraciones es el registro de la forma del esquema; una operación de datos sobre internals de Auth no pertenece ahí. El archivo sí queda versionado y revisable en diff.
- **Sí:** el seed autocontenido — inserta en `auth.users` y `auth.identities` con `extensions.crypt` / `extensions.gen_salt('bf')` y `provider_id = auth.users.id::text`. La alternativa (crear el usuario en el Dashboard y dejar solo el `update`) no es automatizable, y sin un alta reproducible los criterios de aceptación no se pueden volver a correr. Se acepta el acoplamiento a la forma de esas dos tablas y queda en Riesgos.
- **Sí:** tres usuarios de prueba, no uno. El probe de RLS que escribió SPEC 08 necesita tres perfiles: admin del daycare, un no-admin del mismo daycare y alguien de otro. Un `staff` de Sala Soles cubre el caso del "parent del mismo daycare" sin agregar un cuarto usuario, porque el predicado filtra por `daycare_id`, `id` y `status`, no por `role`.
- **Sí:** el seed crea una segunda guardería (`'Guardería Estrellas'`) para poder probar aislamiento entre guarderías de verdad. El alternativa de crearla dentro de un `begin`/`rollback` deja el probe enrevesado y el perfil del tercer usuario con una FK que desaparece al terminar la transacción.
- **Sí:** amendar los dos puntos de SPEC 08 que este spec contradice. Un criterio de aceptación que la base contradice es peor que uno ausente: entrena a leer los criterios sin verificarlos.
- **No:** `force row level security` en `users`. El propietario de la tabla (`postgres`) tiene `bypassrls` de todos modos, y el seed necesita esa vía para promover los roles del seed.
- **No:** una función `security definer` en schema privado para evaluar el ownership. Misma decisión que SPEC 08: con una guardería por defecto y `users` en cardinalidad chica, un `exists` indexado alcanza. Si el número de guarderías crece, se introduce con el spec que lo justifique.
- **No:** cambiar el nombre de `public.users` para no chocar con `auth.users`. El diccionario lo llama `users` y el schema `public` ya da el contexto.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El seed escribe en `auth.users` / `auth.identities`, tablas internas de GoTrue cuya forma cambia entre versiones | Las columnas se nombran explícitamente en el `insert`, nunca `insert ... select *`. Si una actualización de Supabase las cambia, el fallo es del seed — que no está en el historial de migraciones — y no del esquema de la aplicación. El seed es disposable: se regenera desde cero. |
| `extensions.crypt` no resuelve si alguien lo llama sin calificar desde un `search_path` que no incluye `extensions` | El seed **no** usa `set search_path = ''`, así que depende del `search_path` de la sesión. Se califica explícitamente (`extensions.crypt`, `extensions.gen_salt`) para que no dependa del orden de esquemas. |
| El `revoke execute` de las funciones se olvida o se hace después de exponerlas | Va en el mismo archivo de migración, inmediatamente después del `create or replace`, y el criterio de aceptación consulta `pg_proc.proacl`. El advisor `anon_security_definer_function_executable` es la segunda línea de detección. |
| El trigger es `SECURITY DEFINER` y escribe en `users` saltándose su RLS | Es intencional y es el único camino de alta. El riesgo real es que la función se use de puerta trasera: por eso `revoke execute` a los cuatro roles, y por eso el cuerpo no lee `role` de ningún metadata. |
| `users_update_self` + privilegio de UPDATE de tabla permitiría la escalada a `admin` | Cerrado por el `revoke` + `grant` por columna, verificado con `has_column_privilege` y con un probe que intenta la escalada. Es el punto donde un spec de RLS suele quedarse a medio cerrar y dejar la escalada abierta. |
| El subquery de las políticas de `daycares` se evalúa con el RLS de `users` encima, y una política permisiva futura en `users` filtraría hacia `daycares` | `users_select_own` reduce el subquery a la propia fila del llamador, así que hoy es fail-closed por construcción. Declarado como condición del contrato: cualquier política nueva de `users` tiene que revisarse contra las políticas de `daycares`. |
| Changelog 2026-04-28: desde **2026-10-30** las tablas nuevas de `public` dejan de exponerse al Data API por defecto | No hay consumidor todavía, así que nada se rompe el 30 de octubre. El spec que monte el cliente de Supabase tiene que revisar exposure + `GRANT` antes de leer `users` o `daycares` desde la app. Se anota aquí porque este spec es el que los hace legibles. |
| La contraseña de los usuarios del seed queda en un archivo commiteado | Es una credencial de desarrollo de un proyecto sin datos reales, en un archivo que no es parte de las migraciones. Se rotaría si el seed llegara a un entorno compartido. |
| El `execute_sql` del MCP corrió una vez como `postgres` con `rolsuper = false` | `postgres` tiene `rolbypassrls = true`, así que la promoción del seed funciona. Si el MCP cambiara de rol y perdiera `bypassrls`, el `update` del seed devolvería 0 filas sin error — el mismo modo de falla silencioso. El criterio del seed exige ver los 3 roles aplicados. |
| Los amends de SPEC 08 se aplican en la implementación y no ahora | Los dos cambios van escritos en el Plan (paso 12) y como criterio de aceptación, así que no se pierden. Son de documentación, no de esquema. |

## Lo que **no** está en este spec

- Las otras 11 tablas del diccionario y los 5 enums restantes.
- La tabla `invitations` y el flujo real de vinculación padre ↔ niño. Hoy el `daycare_id` del signup lo declara el servidor en `raw_app_meta_data`; cuando `invitations` exista, el alta pasa a resolverse por código de invitación y este trigger se reescribe.
- Cualquier edición de perfil desde la app: cliente de Supabase (`@supabase/supabase-js` + `@supabase/ssr`), `proxy.ts` de refresh de sesión, vars `NEXT_PUBLIC_SUPABASE_*`, pantalla de preferencias.
- La Supabase CLI, `supabase link`, `supabase db push`, stack local y Edge Functions.
- Storage para avatares (`avatar_url` es texto libre; el bucket y sus políticas son otro spec).
- Policies de `insert` o `delete` en `users` y `daycares`, y `force row level security`.
- `grant` explícito de INSERT/DELETE para `authenticated`, o exposure en el dashboard del Data API.
- Corregir los 2 WARN preexistentes de `public.rls_auto_enable()`.
- Cambios en `app/`, `components/`, `lib/` o `data/`.

Cada uno de esos, si llega, va en su propio spec.