-- SPEC 18 — enum `post_type`, tablas `posts`/`post_children`/`post_photos`,
-- función `my_child_rooms()` y bucket `post-photos`, con RLS.
-- Fuente de verdad del esquema: specs/database/18-tabla-posts.md.
-- La app (Server Action, feed, guard) es de la SPEC 17.
-- Aplicar con el MCP de Supabase (`apply_migration`); nunca editar la base a mano.

-- 1. Enum ---------------------------------------------------------------
-- `create type` no admite `if not exists`, así que el guardián es un `do $$`.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'post_type'
      and n.nspname = 'public'
  ) then
    create type public.post_type as enum
      ('comida', 'siesta', 'actividad', 'logro', 'animo', 'foto', 'anuncio');
  end if;
end
$$;

-- 2. Tablas -------------------------------------------------------------
create table if not exists public.posts (
  id           uuid                primary key default gen_random_uuid(),
  daycare_id   uuid                not null references public.daycares(id) on delete cascade,
  author_id    uuid                not null references public.users(id)    on delete cascade,
  author_name  text                not null,
  room_id      uuid                references public.rooms(id) on delete cascade,
  type         public.post_type    not null,
  body         text                not null,
  published_at timestamptz         not null default now(),
  created_at   timestamptz         not null default now(),
  updated_at   timestamptz         not null default now(),
  constraint posts_body_not_blank       check (length(btrim(body)) > 0),
  constraint posts_author_name_not_blank check (length(btrim(author_name)) > 0)
);

comment on table public.posts is
  'Entradas del feed. room_id con valor = "toda la sala"; room_id nulo = destinatarios en post_children.';

create index if not exists posts_daycare_published_idx on public.posts (daycare_id, published_at desc);
create index if not exists posts_room_id_idx  on public.posts (room_id);
create index if not exists posts_author_id_idx on public.posts (author_id);

create table if not exists public.post_children (
  daycare_id      uuid        not null references public.daycares(id)  on delete cascade,
  post_id         uuid        not null references public.posts(id)     on delete cascade,
  child_id        uuid        not null references public.children(id)  on delete cascade,
  child_full_name text        not null,
  created_at      timestamptz not null default now(),
  primary key (post_id, child_id),
  constraint post_children_child_name_not_blank check (length(btrim(child_full_name)) > 0)
);

comment on table public.post_children is
  'Destinatarios de una entrada. child_full_name es snapshot; daycare_id denormalizado corta el ciclo RLS posts ↔ post_children.';

create index if not exists post_children_child_id_idx  on public.post_children (child_id);
create index if not exists post_children_daycare_id_idx on public.post_children (daycare_id);

create table if not exists public.post_photos (
  id         uuid                primary key default gen_random_uuid(),
  post_id    uuid                not null references public.posts(id) on delete cascade,
  url        text                not null,
  position   smallint            not null default 0,
  created_at timestamptz         not null default now(),
  constraint post_photos_position_check check (position >= 0 and position <= 3),
  constraint post_photos_url_not_blank  check (length(btrim(url)) > 0)
);

comment on table public.post_photos is
  'Fotos de una entrada: URL pública del bucket post-photos. Sin daycare_id: su visibilidad se delega en posts.';

create index if not exists post_photos_post_id_idx on public.post_photos (post_id);

-- 3. Trigger ------------------------------------------------------------
create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

-- 4. my_child_rooms() ---------------------------------------------------
-- SECURITY DEFINER: la política de posts para padres necesita
-- children.room_id y los padres no tienen política de select sobre
-- `children` (SPEC 12). Solo devuelve salas propias (scoped por auth.uid()
-- dentro del cuerpo), nunca filas de children.
create or replace function public.my_child_rooms()
  returns setof uuid
  language sql
  security definer
  set search_path = ''
as $$
  select distinct c.room_id
  from public.parent_children pc
  join public.children c on c.id = pc.child_id
  where pc.parent_id = (select auth.uid())
    and c.room_id is not null
$$;

-- Postgres otorga EXECUTE a PUBLIC por defecto: sin el revoke esto sería un
-- endpoint público vía /rest/v1/rpc/my_child_rooms (advisor de seguridad).
revoke execute on function public.my_child_rooms() from public, anon;
grant  execute on function public.my_child_rooms() to authenticated;

-- 5. RLS y políticas ----------------------------------------------------
alter table public.posts         enable row level security;
alter table public.post_children enable row level security;
alter table public.post_photos   enable row level security;

-- ── posts ──────────────────────────────────────────────────────────────
-- staff/admin activos: todas las entradas de su guardería (sin filtro de sala)
create policy posts_select_staff on public.posts
  for select
  to authenticated
  using (exists (
    select 1 from public.users u
    where u.daycare_id = posts.daycare_id
      and u.id = (select auth.uid())
      and u.status = 'active'
      and u.role in ('staff', 'admin')
  ));

-- padres: entradas de sus hijos + anuncios de sus salas
create policy posts_select_parent on public.posts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.post_children pc
      where pc.post_id = posts.id
        and exists (
          select 1 from public.parent_children link
          where link.child_id = pc.child_id
            and link.parent_id = (select auth.uid())
        )
    )
    or (
      posts.room_id is not null
      and posts.room_id in (select public.my_child_rooms())
    )
  );

-- insert como uno mismo, staff/admin de la guardería del post, y el room
-- (si va) debe ser de esa misma guardería
create policy posts_insert_staff on public.posts
  for insert
  to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.daycare_id = posts.daycare_id
        and u.status = 'active'
        and u.role in ('staff', 'admin')
    )
    and (
      room_id is null
      or exists (
        select 1 from public.rooms r
        where r.id = posts.room_id
          and r.daycare_id = posts.daycare_id
      )
    )
  );

-- Sin políticas UPDATE/DELETE: denegado por omisión (edición = spec futuro).

-- ── post_children ──────────────────────────────────────────────────────
-- staff: filas cuyo niño es de su guardería (children ya filtra por RLS)
create policy post_children_select_staff on public.post_children
  for select
  to authenticated
  using (exists (
    select 1 from public.children c
    where c.id = post_children.child_id
      and exists (
        select 1 from public.users u
        where u.id = (select auth.uid())
          and u.daycare_id = c.daycare_id
          and u.status = 'active'
          and u.role in ('staff', 'admin')
      )
  ));

-- padres: solo filas que apuntan a sus hijos vinculados
create policy post_children_select_parent on public.post_children
  for select
  to authenticated
  using (exists (
    select 1 from public.parent_children link
    where link.child_id = post_children.child_id
      and link.parent_id = (select auth.uid())
  ));

-- staff: insertar solo en posts de su guardería y con niños de esa guardería
create policy post_children_insert_staff on public.post_children
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts p
      where p.id = post_children.post_id
        and exists (
          select 1 from public.users u
          where u.id = (select auth.uid())
            and u.daycare_id = p.daycare_id
            and u.status = 'active'
            and u.role in ('staff', 'admin')
        )
    )
    and exists (
      select 1 from public.children c
      where c.id = post_children.child_id
        and c.daycare_id = (select p2.daycare_id from public.posts p2
                            where p2.id = post_children.post_id)
    )
  );

-- Sin políticas UPDATE/DELETE (misma razón que posts).

-- ── post_photos ────────────────────────────────────────────────────────
-- la visibilidad de la foto es la de su post (el RLS de posts filtra;
-- cubre staff y parent con una sola política, y posts nunca subqueriea
-- post_photos → sin ciclo)
create policy post_photos_select on public.post_photos
  for select
  to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_photos.post_id
  ));

create policy post_photos_insert on public.post_photos
  for insert
  to authenticated
  with check (exists (
    select 1 from public.posts p
    where p.id = post_photos.post_id
      and exists (
        select 1 from public.users u
        where u.id = (select auth.uid())
          and u.daycare_id = p.daycare_id
          and u.status = 'active'
          and u.role in ('staff', 'admin')
      )
  ));

-- Sin políticas UPDATE/DELETE (misma razón que posts).

-- 6. Storage: bucket y política ----------------------------------------
-- Path convention: {daycare_id}/{post_id}/{i}-nombre. El primer folder es el
-- daycare_id del publicador (lo garantiza la action de SPEC 17).
-- Límites server-side del bucket; la action valida además para error amigable.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- `storage.objects` ya tiene RLS habilitado por Supabase; no somos owners de
-- la tabla, así que no hay `alter table` acá (falla con 42501).

-- Solo insert: el bucket es público y lee por endpoint público (sin política
-- select). Sin update (no hay upsert) ni delete (sin UI de borrado).
create policy post_photos_insert_staff on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-photos'
    and exists (
      select 1 from public.users u
      where u.id = (select auth.uid())
        and u.status = 'active'
        and u.role in ('staff', 'admin')
        and u.daycare_id::text = (storage.foldername(name))[1]
    )
  );
