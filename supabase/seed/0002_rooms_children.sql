-- SPEC 12 — seed de salas y niños de prueba.
--
-- Esto NO es una migración: se aplica con `execute_sql` (MCP) y nunca con
-- `apply_migration` (regla de AGENTS.md: el historial de migraciones es el
-- registro de la forma del esquema; un seed de demo no pertenece ahí).
--
-- Resuelve la guardería por nombre (patrón del seed 0001). Las 3 salas van en
-- "Guardería Sala Soles" (creada por la migración `create_daycares`).
--
-- Idempotente: los `insert` llevan `where not exists`, así que una segunda
-- corrida no crea filas ni bumpea `created_at`.
--
-- Mapeos desde el mock de SPEC 02 (`data/mock/kids.ts`):
--   - `enrolled_at`: el mock trae "feb 2025" → primer día de ese mes.
--   - `allergy_tags`: badge del mock → tag en inglés (`MANÍ` → `peanut`,
--     `LACTOSA` → `lactose`); sin badge → `{}`.
--   - `medical_notes`: el `note.text` del mock; sin nota → null.
--   - Padres: NO se siembran. El merge sigue en localStorage (SPEC 06) y
--     `parent_children` es otro spec.

-- 1. Tres salas ----------------------------------------------------------
insert into public.rooms (daycare_id, name)
select d.id, v.name
from public.daycares d
cross join (values ('Soles'), ('Estrellas'), ('Lunitas')) as v(name)
where d.name = 'Guardería Sala Soles'
  and not exists (
    select 1 from public.rooms r
    where r.daycare_id = d.id
      and r.name = v.name
  );

-- 2. Los ocho niños del mock, todos en la sala Soles ----------------------
insert into public.children (daycare_id, room_id, full_name, birth_date, enrolled_at, allergy_tags, medical_notes)
select d.id, r.id, v.full_name, v.birth_date, v.enrolled_at, v.allergy_tags, v.medical_notes
from public.daycares d
join public.rooms r
  on r.daycare_id = d.id
 and r.name = 'Soles'
cross join (values
  ('Mateo Fernández', date '2022-03-12', date '2025-02-01', array['peanut']::text[],
   'Alergia al maní. Evitar frutos secos. Lleva inhalador en la mochila.'),
  ('Sofía Méndez',    date '2023-11-14', date '2025-03-01', array[]::text[],      null::text),
  ('Benjamín Ruiz',   date '2022-02-02', date '2024-03-01', array[]::text[],      null::text),
  ('Valentina Soto',  date '2023-07-25', date '2024-08-01', array[]::text[],      null::text),
  ('Tomás Díaz',      date '2022-01-18', date '2025-02-01', array['lactose']::text[],
   'Intolerancia a la lactosa. Evitar lácteos y derivados. Tiene su propia leche sin lactosa.'),
  ('Emma Castro',     date '2023-10-09', date '2025-03-01', array[]::text[],      null::text),
  ('Lucas Romero',    date '2022-04-30', date '2024-08-01', array[]::text[],      null::text),
  ('Olivia Vega',     date '2023-06-21', date '2025-02-01', array[]::text[],      null::text)
) as v(full_name, birth_date, enrolled_at, allergy_tags, medical_notes)
where d.name = 'Guardería Sala Soles'
  and not exists (
    select 1 from public.children c
    where c.daycare_id = d.id
      and c.full_name = v.full_name
  );
