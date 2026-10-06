-- SPEC 12 — tablas `rooms` y `children`, su enum `child_status` y su RLS.
-- Fuente de verdad: ../07-DB-Schema/opendaycare-database-schema.md, secciones 3 y 4.
-- Desvío anotado en la spec: `children.daycare_id` es NOT NULL — el schema de
-- referencia scopes por `room_id` nullable, y con RLS por guardería un niño sin
-- `daycare_id` quedaría invisible.
-- El seed de salas y niños NO vive acá: va en `supabase/seed/`.
-- Aplicar con el MCP de Supabase (`apply_migration`); nunca editar la base a mano.

-- 1. Enum ---------------------------------------------------------------
-- `create type` no admite `if not exists`, así que el guardián es un `do $$`.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'child_status'
      and n.nspname = 'public'
  ) then
    create type public.child_status as enum ('active', 'archived');
  end if;
end
$$;

-- 2. Tablas -------------------------------------------------------------
create table if not exists public.rooms (
  id         uuid        primary key default gen_random_uuid(),
  daycare_id uuid        not null references public.daycares(id) on delete cascade,
  name       text        not null,
  created_at timestamptz not null default now(),
  constraint rooms_name_not_blank check (length(btrim(name)) > 0),
  constraint rooms_daycare_name_unique unique (daycare_id, name)
);

comment on table public.rooms is
  'Salas de la guardería. Sin CRUD en UI: las 3 del producto vienen del seed (SPEC 12).';

create table if not exists public.children (
  id            uuid                primary key default gen_random_uuid(),
  daycare_id    uuid                not null references public.daycares(id) on delete restrict,
  room_id       uuid                references public.rooms(id) on delete set null,
  full_name     text                not null,
  birth_date    date                not null,
  enrolled_at   date                not null default current_date,
  medical_notes text,
  allergy_tags  text[]              not null default '{}',
  photo_consent boolean             not null default true,
  status        public.child_status not null default 'active',
  created_at    timestamptz         not null default now(),
  updated_at    timestamptz         not null default now(),
  constraint children_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint children_birth_date_not_future check (birth_date <= current_date)
);

comment on table public.children is
  'Niños inscritos en la guardería. Archivado/borrado físico sin UI todavía (SPEC 12).';

-- Índices por la regla de FK (precedente: `users_daycare_id_idx` de SPEC 09).
-- `rooms.daycare_id` ya queda cubierto por el prefijo de `rooms_daycare_name_unique`.
create index if not exists children_daycare_id_idx on public.children (daycare_id);
create index if not exists children_room_id_idx    on public.children (room_id);

-- 3. Trigger ------------------------------------------------------------
create trigger children_set_updated_at
  before update on public.children
  for each row execute function public.set_updated_at();

-- 4. RLS y políticas ----------------------------------------------------
alter table public.children enable row level security;
alter table public.rooms     enable row level security;

-- Predicado de SPEC 09: subquery sobre `public.users` que resuelve guardería,
-- rol y estado. El RLS de `users` se le aplica encima (fail-closed).
create policy children_select_staff on public.children
  for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = children.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

create policy children_insert_staff on public.children
  for insert
  to authenticated
  with check (exists (
    select 1 from public.users u
    where u.daycare_id = children.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

-- UPDATE necesita USING (fila vieja) y WITH CHECK (fila nueva): con el mismo
-- predicado sobre `children.daycare_id` un staff tampoco puede mover un niño
-- a otra guardería.
create policy children_update_staff on public.children
  for update
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = children.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ))
  with check (exists (
    select 1 from public.users u
    where u.daycare_id = children.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

-- Sin política DELETE en `children`: denegado por omisión (el borrado lógico
-- con `child_status = 'archived'` llega cuando haya UI).
-- Sin política de insert/update en `rooms`: no hay CRUD de salas en UI; el seed
-- escribe como dueño de la BD y no pasa por RLS.
create policy rooms_select_staff on public.rooms
  for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = rooms.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));
