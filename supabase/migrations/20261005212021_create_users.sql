-- SPEC 09 — tabla `users`, sus enums y el RLS de ownership.
-- Cierra el contrato de SPEC 08: `daycares` queda con las dos políticas que
-- aquella spec especificó sin aplicar.
-- Aplicar con el MCP de Supabase (`apply_migration`); nunca editar la base a mano.
-- El seed de usuarios de prueba NO vive acá: va en `supabase/seed/`.

-- 1. Enums --------------------------------------------------------------
-- `create type` no admite `if not exists`, así que el guardián es un `do $$`.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_role'
      and n.nspname = 'public'
  ) then
    create type public.user_role as enum ('staff', 'parent', 'admin');
  end if;

  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'user_status'
      and n.nspname = 'public'
  ) then
    create type public.user_status as enum ('pending', 'active');
  end if;
end
$$;

-- 2. Tabla e índice ----------------------------------------------------
create table if not exists public.users (
  id                     uuid                 primary key references auth.users(id) on delete cascade,
  daycare_id             uuid                 not null references public.daycares(id) on delete restrict,
  role                   public.user_role     not null,
  status                 public.user_status   not null default 'active',
  full_name              text                 not null,
  avatar_url             text,
  notify_on_post         boolean              not null default true,
  daily_summary_enabled  boolean              not null default true,
  created_at             timestamptz          not null default now(),
  updated_at             timestamptz          not null default now(),
  constraint users_full_name_not_blank check (length(btrim(full_name)) > 0)
);

comment on table public.users is 'Perfil de aplicación vinculado a Supabase Auth; el email y la contraseña viven en auth.users.';

-- Índice por la regla de FK: sin él, borrar una guardería hace un seq scan
-- sobre `users`. El predicado de ownership de `daycares` resuelve `id` por la
-- PK, así que no hace falta un índice compuesto (ver Decisiones de SPEC 09).
create index if not exists users_daycare_id_idx on public.users (daycare_id);

-- 3. Funciones y triggers ---------------------------------------------
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

-- `SECURITY DEFINER` no es estilo: GoTrue inserta en `auth.users` con el rol
-- `supabase_auth_admin`, que tiene `rolbypassrls = false` y no está en los
-- `default privileges` de `public`. Sin definer, el trigger no puede escribir
-- en `public.users`. El dueño de la función es `postgres`, que sí bypasea RLS.
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

-- Postgres otorga EXECUTE a PUBLIC en toda función nueva, y `anon` y
-- `authenticated` heredan de PUBLIC: sin estos revoke, `handle_new_user` es un
-- endpoint público que corre con privilegios de `postgres`.
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function public.set_updated_at()   from public, anon, authenticated, service_role;

create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4. RLS y políticas ---------------------------------------------------
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

-- Las dos que SPEC 08 especificó y dejó sin aplicar, copiadas textuales de su
-- sección de diseño de RLS. Sin cambios: el predicado ahora sí tiene la tabla
-- que consulta.
--
-- El subquery se evalúa con los privilegios de quien llama, así que el RLS de
-- `users` se le aplica encima: con `users_select_own` el `exists` queda reducido
-- a `u.id = auth.uid()`, que es lo que el predicado ya exige (fail-closed).
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

-- Cierre de la escalada de privilegios: la parte que el RLS solo no resuelve.
-- `users_update_self` con `with check (id = auth.uid())` deja a un padre
-- actualizar su propia fila, y con UPDATE de tabla eso incluye `role = 'admin'`
-- sobre sí mismo. El `with check` no lo detiene porque `id` no cambia. El
-- privilegio por columna sí. Orden importa: el revoke va primero.
revoke update on table public.users from anon, authenticated;

grant update (full_name, avatar_url, notify_on_post, daily_summary_enabled)
  on table public.users to authenticated;
