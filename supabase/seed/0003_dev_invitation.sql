-- SPEC 13 — seed de la invitación pendiente de prueba.
--
-- Esto NO es una migración: se aplica con `execute_sql` (MCP) y nunca con
-- `apply_migration` (regla de AGENTS.md: el historial de migraciones es el
-- registro de la forma del esquema; un seed de demo no pertenece ahí).
--
-- Deja una invitación `pending` para el niño "Mateo Fernández" (seed 0002) con
-- código conocido `DEVCODE1`, para poder verificar SPEC 14 (activación) sin
-- depender del modo test de Resend. El `code_hash` se calcula con el mismo
-- algoritmo que `hashInviteCode()` de `lib/invite-code.ts` (sha256 hex), de modo
-- que el texto plano `DEVCODE1` verifica contra esta fila.
--
-- Idempotente: el `insert` lleva `where not exists`, así que una segunda corrida
-- no crea filas. La guarda mira el índice único parcial `(child_id, email)
-- where status='pending'`: si la corrida anterior ya dejó la invitación viva,
-- la segunda no inserta.
--
-- `invited_by` es el usuario "Staff Solas" (seed 0001): quien "invitó" fue el
-- staff de la guardería, coherente con lo que hará la Server Action.

-- 1. La invitación pendiente -------------------------------------------------
insert into public.invitations (daycare_id, child_id, email, full_name, relationship,
                                code_hash, status, expires_at, invited_by)
select d.id, c.id, v.email, v.full_name, v.relationship::public.parent_role,
       encode(extensions.digest('DEVCODE1', 'sha256'), 'hex'),
       'pending', now() + interval '7 days', s.id
from public.daycares d
join public.children c
  on c.daycare_id = d.id
 and c.full_name = 'Mateo Fernández'
join public.users s
  on s.daycare_id = d.id
 and s.role = 'staff'
cross join (values
  ('mama.mateo@solas.test', 'Lucía Fernández', 'mama')
) as v(email, full_name, relationship)
where d.name = 'Guardería Sala Soles'
  and not exists (
    select 1 from public.invitations inv
    where inv.child_id = c.id
      and inv.email = v.email
      and inv.status = 'pending'
  );