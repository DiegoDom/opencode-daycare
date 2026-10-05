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
