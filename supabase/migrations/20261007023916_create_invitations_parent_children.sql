-- SPEC 13 — tablas `invitations` y `parent_children`, sus enums, su RLS y la
-- función `activate_invitation` (la consume SPEC 14 con `service_role`).
-- Fuente de verdad del esquema: specs/15-invitaciones-parent-children.md
-- (referencia el diccionario ../07-DB-Schema/opendaycare-database-schema.md).
-- Aplicar con el MCP de Supabase (`apply_migration`); nunca editar la base a mano.
-- El seed de la invitación de prueba NO vive acá: va en `supabase/seed/`.

-- 1. Enums ---------------------------------------------------------------
-- `create type` no admite `if not exists`, así que el guardián es un `do $$`.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'invitation_status'
      and n.nspname = 'public'
  ) then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'parent_role'
      and n.nspname = 'public'
  ) then
    create type public.parent_role as enum ('mama', 'papa', 'tutor');
  end if;
end
$$;

-- 2. Tablas --------------------------------------------------------------
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

comment on table public.invitations is
  'Invitación pendiente de un padre a un niño. Solo se guarda el hash del código; el texto plano vive en el correo y en la respuesta al modal.';

create unique index if not exists invitations_pending_child_email_key
  on public.invitations (child_id, email) where status = 'pending';
create index if not exists invitations_daycare_id_idx on public.invitations (daycare_id);
create index if not exists invitations_child_id_idx   on public.invitations (child_id);
create index if not exists invitations_code_hash_idx  on public.invitations (code_hash);

create table if not exists public.parent_children (
  id           uuid               primary key default gen_random_uuid(),
  daycare_id   uuid               not null references public.daycares(id) on delete cascade,
  parent_id    uuid               not null references public.users(id) on delete cascade,
  child_id     uuid               not null references public.children(id) on delete cascade,
  relationship public.parent_role not null,
  created_at   timestamptz        not null default now(),
  constraint parent_children_parent_child_unique unique (parent_id, child_id)
);

comment on table public.parent_children is
  'Vínculo aceptado entre un padre y un niño. Sin políticas de escritura: solo service_role escribe (SPEC 14).';

create index if not exists parent_children_daycare_id_idx on public.parent_children (daycare_id);
create index if not exists parent_children_parent_id_idx  on public.parent_children (parent_id);
create index if not exists parent_children_child_id_idx   on public.parent_children (child_id);

-- 3. Trigger ------------------------------------------------------------
create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

-- 4. RLS y políticas ----------------------------------------------------
alter table public.invitations     enable row level security;
alter table public.parent_children enable row level security;

-- Predicado de SPEC 09/12: subquery sobre `public.users` que resuelve guardería,
-- rol y estado. El RLS de `users` se le aplica encima (fail-closed).
-- `invitations` no lleva política DELETE: el borrado no tiene consumidor en la UI
-- y el estado `revoked` cubre el caso futuro.
create policy invitations_select_staff on public.invitations
  for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = invitations.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

create policy invitations_insert_staff on public.invitations
  for insert
  to authenticated
  with check (exists (
    select 1 from public.users u
    where u.daycare_id = invitations.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

create policy invitations_update_staff on public.invitations
  for update
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = invitations.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ))
  with check (exists (
    select 1 from public.users u
    where u.daycare_id = invitations.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

-- `parent_children` sin políticas de escritura: el vínculo lo escribe SPEC 14
-- con `service_role`. Lectura para staff/admin de la guardería Y para el propio
-- padre (que no ve invitaciones, solo las filas que lo vinculan).
create policy parent_children_select_staff on public.parent_children
  for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = parent_children.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

create policy parent_children_select_own on public.parent_children
  for select
  to authenticated
  using (parent_id = (select auth.uid()));

-- 5. Función de activación (la consume SPEC 14) --------------------------
create or replace function public.activate_invitation(p_user_id uuid, p_invitation_id uuid)
  returns void language plpgsql security definer set search_path = ''
as $$
declare v public.invitations;
begin
  select * into v from public.invitations
    where id = p_invitation_id and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'activate_invitation: invitación inexistente, vencida o ya usada';
  end if;

  update public.users set status = 'active' where id = p_user_id;

  insert into public.parent_children (daycare_id, parent_id, child_id, relationship)
    values (v.daycare_id, p_user_id, v.child_id, v.relationship)
    on conflict (parent_id, child_id) do nothing;

  update public.invitations
    set status = 'accepted', accepted_at = now()
    where id = p_invitation_id;
end;
$$;

-- Postgres otorga EXECUTE a PUBLIC en toda función nueva, y `anon` y
-- `authenticated` heredan de PUBLIC: sin estos revoke, `activate_invitation` es
-- un endpoint público que corre con privilegios de `postgres`. Se concede solo
-- a `service_role`, el único autorizado a activar invitaciones (SPEC 14).
revoke execute on function public.activate_invitation(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.activate_invitation(uuid, uuid) to service_role;