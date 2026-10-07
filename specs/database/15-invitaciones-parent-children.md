# SPEC 15 — Tablas `invitations` y `parent_children` (vínculo real padre–niño)

> **Estado:** Aprobado\
> **Depende de:** SPEC 08 — `daycares`, SPEC 09 — `users`, SPEC 12 — `children`/`rooms`, SPEC 13 — Invitación padre (feature)\
> **Fecha:** 2026-10-06\
> **Objetivo:** Parte de base de datos de la SPEC 13 de feature: crear los enums `invitation_status` y `parent_role`, las tablas `invitations` y `parent_children` con su RLS, y la función `activate_invitation(uuid, uuid)` que SPEC 14 consumirá con `service_role`. La feature spec **referencia** este documento como fuente de verdad del esquema.

> **Hijo de:** [SPEC 13 — Vincular padre real: invitación en BD y email con Resend](../13-invitacion-padre-email.md). Este spec solo cubre lo que toca a la base de datos (migración + seed); el código de la app (Server Action, modal, card, email) pertenece a la feature spec.

## Por qué existe este spec

La SPEC 06 vinculaba padres solo en `localStorage`. La SPEC 13 la reemplaza con el vínculo real: el staff invita a un padre (guarda un hash del código, envía el código por email), y la activación posterior (SPEC 14) crea el vínculo `parent_children`. Este spec aterriza esa parte en la BD, siguiendo el patrón fijado por SPEC 08/09/12 (migración en `supabase/migrations/` aplicada vía MCP).

La cardinalidad y el flujo:

- `invitations` es la propuesta viva: 1 fila **pendiente** por par `(child_id, email)` (índice único parcial). La reactivación hace upsert (regenera código y extiende vigencia).
- `parent_children` es el vínculo aceptado: sin políticas de escritura; lo escribe SPEC 14 con `service_role` vía `activate_invitation`.

Estado verificado de la base al momento de escribir (2026-10-06), baseline de SPEC 12:

- Tablas en `public`: `daycares`, `users`, `children`, `rooms` (todas con RLS).
- Policy precedent: predicado `exists` sobre `public.users` con `daycare_id`, `id = auth.uid()`, `status = 'active'` y `role in ('staff','admin')`.

## Alcance

**Incluye:**

- `supabase/migrations/<UTC>_create_invitations_parent_children.sql` (nuevo): enums `invitation_status` (`pending`/`accepted`/`revoked`) y `parent_role` (`mama`/`papa`/`tutor`) con guardián `do $$`; tablas `invitations` y `parent_children`; índices (único parcial `(child_id, email) where status='pending'` + por columna de FK + `code_hash`); trigger `invitations_set_updated_at`; RLS en ambas; las 6 políticas; y `activate_invitation` con `revoke`/`grant`.
- **RLS de `invitations`:** `select`/`insert`/`update` solo para `staff`/`admin` activos de la guardería (`daycare_id` de la fila). Sin política `DELETE` (denied by default; el estado `revoked` cubre el futuro sin borrado físico).
- **RLS de `parent_children`:** `select` para staff/admin de la guardería **y** para el propio padre (`parent_id = auth.uid()`). Sin `insert`/`update`/`delete`: el vínculo lo escribe SPEC 14 con `service_role`.
- `activate_invitation(uuid, uuid)`: `SECURITY DEFINER`, `set search_path = ''`, atómico (promover usuario + vincular + aceptar), con `revoke execute` a `public`/`anon`/`authenticated` y `grant` solo a `service_role`.
- El seed `supabase/seed/0003_dev_invitation.sql` (invitación pendiente de prueba con código conocido `DEVCODE1`), aplicado con `execute_sql`, nunca con `apply_migration`.
- Reconciliación del nombre del archivo con la `version` que devuelve `apply_migration`.

**Fuera de alcance (specs futuros):**

- La **activación/registro del padre** (validar el código, crear la cuenta, `app_metadata`, promover a `active`, escribir `parent_children`): SPEC 14. Este spec solo **crea** la función que SPEC 14 va a llamar.
- Vincular a un padre con cuenta existente.
- Editar, revocar o reenviar invitaciones desde la UI.
- Rate limiting, webhooks de Resend, dominio de envío verificado (pertenecen a la feature spec).

## Modelo de datos

El SQL exacto se aplica y se commitea en `supabase/migrations/20261007023916_create_invitations_parent_children.sql`. Sección por sección:

### 1. Enums

```sql
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'invitation_status' and n.nspname = 'public') then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'parent_role' and n.nspname = 'public') then
    create type public.parent_role as enum ('mama', 'papa', 'tutor');
  end if;
end $$;
```

`create type` no admite `if not exists`: el guardián de SPEC 09/12 evita el error si la migración se re-aplica tras un fallo parcial.

### 2. Tabla `invitations`

```sql
create table if not exists public.invitations (
  id           uuid                     primary key default gen_random_uuid(),
  daycare_id   uuid                     not null references public.daycares(id) on delete cascade,
  child_id     uuid                     not null references public.children(id) on delete cascade,
  email        text                     not null,
  full_name    text                     not null,
  relationship public.parent_role       not null,
  code_hash    text                     not null,
  status       public.invitation_status not null default 'pending',
  expires_at   timestamptz              not null,
  invited_by   uuid                     references public.users(id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz              not null default now(),
  updated_at   timestamptz              not null default now(),
  constraint invitations_email_not_blank     check (length(btrim(email)) > 0),
  constraint invitations_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint invitations_email_lowercase     check (email = lower(email))
);

create unique index if not exists invitations_pending_child_email_key
  on public.invitations (child_id, email) where status = 'pending';
create index if not exists invitations_daycare_id_idx on public.invitations (daycare_id);
create index if not exists invitations_child_id_idx   on public.invitations (child_id);
create index if not exists invitations_code_hash_idx  on public.invitations (code_hash);

create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();
```

Decisión de seguridad clave: **solo se guarda `code_hash`** (sha256 hex). El texto plano del código existe únicamente en el correo y en la respuesta al modal; un dump de la BD no revela códigos vivos. `expires_at = now() + 7 días` lo emite la Server Action (SPEC 13), no el schema.

### 3. Tabla `parent_children`

```sql
create table if not exists public.parent_children (
  id           uuid               primary key default gen_random_uuid(),
  daycare_id   uuid               not null references public.daycares(id) on delete cascade,
  parent_id    uuid               not null references public.users(id) on delete cascade,
  child_id     uuid               not null references public.children(id) on delete cascade,
  relationship public.parent_role not null,
  created_at   timestamptz        not null default now(),
  constraint parent_children_parent_child_unique unique (parent_id, child_id)
);

create index if not exists parent_children_daycare_id_idx on public.parent_children (daycare_id);
create index if not exists parent_children_parent_id_idx  on public.parent_children (parent_id);
create index if not exists parent_children_child_id_idx   on public.parent_children (child_id);
```

El unique `(parent_id, child_id)` es la red final del `on conflict do nothing` de `activate_invitation`.

### 4. RLS y políticas

```sql
alter table public.invitations     enable row level security;
alter table public.parent_children enable row level security;

-- invitations: staff/admin activos de la guardería (mismo predicado de SPEC 09/12)
create policy invitations_select_staff on public.invitations for select to authenticated
  using (exists (select 1 from public.users u
    where u.daycare_id = invitations.daycare_id and u.id = (select auth.uid())
      and u.status = 'active' and u.role in ('staff', 'admin')));
create policy invitations_insert_staff on public.invitations for insert to authenticated
  with check (exists (select 1 from public.users u
    where u.daycare_id = invitations.daycare_id and u.id = (select auth.uid())
      and u.status = 'active' and u.role in ('staff', 'admin')));
create policy invitations_update_staff on public.invitations for update to authenticated
  using (exists (select 1 from public.users u
    where u.daycare_id = invitations.daycare_id and u.id = (select auth.uid())
      and u.status = 'active' and u.role in ('staff', 'admin')))
  with check (exists (select 1 from public.users u
    where u.daycare_id = invitations.daycare_id and u.id = (select auth.uid())
      and u.status = 'active' and u.role in ('staff', 'admin')));

-- parent_children: staff/admin de la guardería + el propio padre
create policy parent_children_select_staff on public.parent_children for select to authenticated
  using (exists (select 1 from public.users u
    where u.daycare_id = parent_children.daycare_id and u.id = (select auth.uid())
      and u.status = 'active' and u.role in ('staff', 'admin')));
create policy parent_children_select_own on public.parent_children for select to authenticated
  using (parent_id = (select auth.uid()));
```

Puntos no negociables (heredados de SPEC 08/09):

- `to authenticated`, nunca `auth.role()`: deprecado y roto en silencio con sign-in anónimo.
- `update` con `USING` **y** `WITH CHECK`: sin el segundo, un staff movería la fila a otra guardería.
- El `update` necesita la política `select` (RLS hace SELECT antes del UPDATE; sin ella devuelve 0 filas en silencio). Ambas van en la misma migración.
- `parent_children` sin políticas de escritura: no hay UI para vincular usuarios existentes, así que una política de insert sería código muerto y superficie extra. El único camino al vínculo es `activate_invitation` (service_role).

### 5. `activate_invitation` (la consume SPEC 14)

```sql
create or replace function public.activate_invitation(p_user_id uuid, p_invitation_id uuid)
  returns void language plpgsql security definer set search_path = ''
as $$
declare v public.invitations;
begin
  select * into v from public.invitations
    where id = p_invitation_id and status = 'pending' and expires_at > now() for update;
  if not found then
    raise exception 'activate_invitation: invitación inexistente, vencida o ya usada';
  end if;

  update public.users set status = 'active' where id = p_user_id;

  insert into public.parent_children (daycare_id, parent_id, child_id, relationship)
    values (v.daycare_id, p_user_id, v.child_id, v.relationship)
    on conflict (parent_id, child_id) do nothing;

  update public.invitations set status = 'accepted', accepted_at = now()
    where id = p_invitation_id;
end;
$$;

revoke execute on function public.activate_invitation(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.activate_invitation(uuid, uuid) to service_role;
```

- `SECURITY DEFINER` es el estilo de `handle_new_user` (SPEC 09): el `service_role` que llama necesita intentar RLS, y esta función debe ver la invitación aunque la sesión no tenga perfil en la guardería. La atomicidad (promover + vincular + aceptar en una transacción) evita estados a medias.
- El `revoke` es obligatorio en la **misma** migración: Postgres otorga `EXECUTE` a `PUBLIC` en toda función nueva, y `anon`/`authenticated` heredan de `PUBLIC`. Sin el revoke, la función sería un endpoint público en `/rest/v1/rpc/activate_invitation` corriendo con privilegios de `postgres` (advisor `anon_security_definer_function_executable`).
- `set search_path = ''` hace explícito el schema en cada objeto (no hay ambigüedad de `pg_temp`).

## Arquitectura / Patrones

Este spec es **Infraestructura pura** de BD (SPEC 00): no toca Dominio, Aplicación ni Presentación. La feature spec (SPEC 13) es la única consumidora y **referencia este documento** para su parte de datos.

- **Nuevo (infra):** `supabase/migrations/20261007023528_create_invitations_parent_children.sql`.
- **Nuevo (infra, seed):** `supabase/seed/0003_dev_invitation.sql` — descrito abajo, aplicado con `execute_sql`.
- **Sin cambios:** `data/`, `lib/`, `app/`, `components/`.

Patrón de migraciones (de SPEC 08): se escribe el `.sql` commiteado, se aplica con `apply_migration`, se renombra el archivo si la `version` devuelta difiere del prefijo, y se verifica con probes + advisors. Los seeds van en `supabase/seed/` y se aplican con `execute_sql`: `list_migrations` no los muestra y un `db push` no los re-aplica.

## Seed de prueba

`supabase/seed/0003_dev_invitation.sql` deja una invitación pendiente del niño "Mateo Fernández" con código conocido **`DEVCODE1`**, para verificar SPEC 14 sin depender del modo test de Resend. Idempotente: `where not exists` en el insert y `is distinct from` en los updates, para que una segunda corrida no cree filas ni bumpee `updated_at`.

```sql
-- La invitación apunta al niño "Mateo Fernández" (seed 0002) y al daycare de la
-- sesión de SPEC 09 (el que tiene el staff). `code_hash` es el sha256 de DEVCODE1.
-- invite à: invited_by = el usuario "Staff Solas" (seed 0001).
```

El `code_hash` se calcula con `encode(extensions.digest('DEVCODE1','sha256'),'hex')`. El seed usa el mismo algoritmo que `hashInviteCode()` de `lib/invite-code.ts` (SPEC 13), de modo que el código texto plano `DEVCODE1` verifica contra la fila del seed.

## Plan de implementación

1. **Migración.** Escribir el `.sql` de arriba, aplicarlo con `apply_migration`; si la `version` devuelta no coincide con el prefijo del archivo, renombrar el archivo. Verify: `list_tables` muestra ambas tablas con RLS; `get_advisors('security')` sin hallazgos nuevos y sin `anon_security_definer_function_executable`.
2. **Seed.** Escribir `supabase/seed/0003_dev_invitation.sql` y aplicarlo con `execute_sql`. Verify: 1 fila pendiente con `code_hash` del `DEVCODE1`; segunda corrida no duplica.
3. **Probes de RLS.** Ejecutar como `authenticated` con `request.jwt.claims` para un staff y para un parent: staff ve sus invitaciones y vínculos; parent ve 0 invitaciones y solo sus `parent_children`; `anon` ve 0 filas de ambas. Verify: el bloque termina con `rollback` y no deja datos.

## Criterios de aceptación

- [ ] `invitations` y `parent_children` existen en `public` con `relrowsecurity = true` y `list_tables` las muestra.
- [ ] Existen los enums `invitation_status` y `parent_role` con sus tres/tres valores; la migración es re-aplicable (guardián `do $$` + `if not exists`).
- [ ] El índice único parcial `(child_id, email) where status='pending'` existe.
- [ ] `pg_policies` lista 3 políticas en `invitations` (select/insert/update, todas `to authenticated`, predicado staff/admin activo con `daycare_id`) y 2 en `parent_children` (staff/admin + propia). Cero políticas `delete` en `invitations`, cero de escritura en `parent_children`.
- [ ] `has_table_privilege('anon', '<tabla>', 'SELECT')` es `true` (default privileges) y aun así `anon` ve 0 filas en ambas por RLS.
- [ ] Un `select` sobre `invitations` como rol `anon` o como `parent` devuelve 0 filas; como `parent`, `parent_children` devuelve solo sus filas (`parent_id = auth.uid()`).
- [ ] `public.activate_invitation(uuid, uuid)` existe y `has_function_privilege('service_role', ..., 'EXECUTE')` es `true`; `anon` y `authenticated` no tienen `EXECUTE`.
- [ ] `get_advisors('security')` no reporta `anon_security_definer_function_executable` ni hallazgos nuevos atribuibles a este spec.
- [ ] `supabase/seed/0003_dev_invitation.sql` deja 1 fila `pending` con `code_hash = encode(extensions.digest('DEVCODE1','sha256'),'hex')`; una segunda corrida no duplica ni la modifica.

## Decisiones

- **Sí:** DDL de ambas tablas en el spec de SPEC 13, aunque `parent_children` se **escriba** en SPEC 14. La card PADRES VINCULADOS (SPEC 13) necesita leer pendientes + activos; SPEC 14 queda casi todo aplicación.
- **Sí:** `activate_invitation` en esta migración (no en la de SPEC 14). Da atomicidad y evita que SPEC 14 invente DDL.
- **Sí:** `code_hash` sha256 + expiración de 7 días en vez de guardar el código en claro. No es una contraseña reutilizable, pero el hash evita que un dump de la BD revele códigos vivos.
- **Sí:** índice único parcial `(child_id, email) where status='pending'` + upsert en la action. Una sola invitación viva por niño y email; reinvitar regenera código y extiende vigencia.
- **Sí:** `service_role` como único escritor de `parent_children`. Sin UI para vincular usuarios existentes, una política de insert para staff sería código muerto y superficie extra.
- **Sí:** `SECURITY DEFINER` + `revoke execute` a `public`/`anon`/`authenticated`. Es el único mecanismo que deja a un recién creado (`parent`/`pending`, sin perfil que pase predicado alguno) poder activarse sin exponer RLS.
- **No:** política `DELETE` en `invitations`. Ausencia de política = denegado; el estado `revoked` llega cuando haya UI de gestión, sin borrado físico.
- **No:** `updated_at` en `parent_children`. Es un vínculo inmutable (created_at basta); el diccionario no lo lista.
- **No:** grants de escritura a `authenticated` en `daycares`/`users` correspondientes a SPEC 14; eso pertenece a su spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| La `version` de `apply_migration` puede diferir del prefijo del archivo | El plan reconcilia el nombre antes de commitear; el criterio compara ambos. |
| **Changelog 2026-04-28:** desde **2026-10-30** las tablas nuevas de `public` dejan de exponerse al Data API por defecto (hoy es opt-in). La app lee `invitations`/`parent_children` con el cliente de servidor de SPEC 13 | La feature spec (SPEC 13) llegar con el cliente ya montado; si la tabla no fuera visible por la Data API al momento de verificar, el fix es un `grant select`/`usage` explícito en el dashboard + SQL, anotado en ese spec (precedente SPEC 08). El RLS sigue siendo la puerta de filas. |
| Un `SECURITY DEFINER` olvidado sin revoke deja un RPC público | El `revoke` vive en la misma migración y el criterio exige `get_advisors('security')` sin `anon_security_definer_function_executable`. |
| El subquery del predicado consulta `users`, cuyo RLS se aplica encima (fail-closed) | Precedente SPEC 09: el `exists` queda reducido por `users_select_own` a `u.id = auth.uid()`, que es lo que el predicado exige. |

## Lo que **no** está en este spec

- La activación/registro del padre: validar el código, crear la cuenta, `app_metadata`, promover a `active` y **llamar** a `activate_invitation` (SPEC 14).
- Vincular a un padre con cuenta existente.
- UI de editar, revocar o reenviar invitaciones.
- Rate limiting, webhooks de Resend, dominio de envío verificado.
- Todo lo de la feature spec 13 que no toca a la base de datos (Server Action, email, modal, card).

Cada uno de esos, si llega, va en su propio spec.