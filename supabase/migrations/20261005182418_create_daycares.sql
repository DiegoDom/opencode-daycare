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