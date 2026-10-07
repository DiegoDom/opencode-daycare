-- SPEC 18 — seed de entradas de prueba para el feed.
--
-- Esto NO es una migración: se aplica con `execute_sql` (MCP) y nunca con
-- `apply_migration` (regla de AGENTS.md: el historial de migraciones es el
-- registro de la forma del esquema; un seed de demo no pertenece ahí).
--
-- Deja 2 entradas en el daycare "Guardería Sala Soles" para que el feed de
-- SPEC 17 no arranque vacío (reemplazan a los 3 posts del mock de SPEC 01):
--
--   1. Anuncio a toda la sala "Soles" (`type = 'anuncio'`, `room_id` = la sala,
--      body = el anuncio del parque del mock).
--   2. Entrada a destinatarios específicos (`type = 'logro'`, `room_id` nulo y
--      1 fila en `post_children` con "Mateo Fernández", snapshot `child_full_name`).
--
-- Ambas con `author_id`/`author_name` = el staff del seed 0001 ("Staff Soles").
-- No hay foto: los bytes de una imagen no se pueden crear por SQL (una fila en
-- `storage.objects` no sube el archivo al backend y la URL pública daría 404).
-- El caso con foto se valida por UI (criterios de SPEC 17).
--
-- Idempotente: `where not exists` por `(daycare_id, author_id, body)` en `posts`
-- y por `(post_id, child_id)` en `post_children` — una segunda corrida no crea
-- filas ni bumpea `updated_at`.

-- 1. Anuncio a toda la sala "Soles" ----------------------------------------
insert into public.posts (daycare_id, author_id, author_name, room_id, type, body)
select d.id, s.id, s.full_name, r.id, 'anuncio', 'El viernes salimos al parque por la mañana. Recuerden mandar gorra y una botellita de agua.'
from public.daycares d
join public.users s
  on s.daycare_id = d.id
 and s.role = 'staff'
 and s.status = 'active'
join public.rooms r
  on r.daycare_id = d.id
 and r.name = 'Soles'
where d.name = 'Guardería Sala Soles'
  and not exists (
    select 1 from public.posts p
    where p.daycare_id = d.id
      and p.author_id = s.id
      and p.body = 'El viernes salimos al parque por la mañana. Recuerden mandar gorra y una botellita de agua.'
  );

-- 2. Entrada a destinatarios específicos (Mateo Fernández) -----------------
insert into public.posts (daycare_id, author_id, author_name, room_id, type, body)
select d.id, s.id, s.full_name, null, 'logro', '¡Usó el orinal solito por primera vez! Estaba feliz de contárselo a todos. Un gran paso.'
from public.daycares d
join public.users s
  on s.daycare_id = d.id
 and s.role = 'staff'
 and s.status = 'active'
where d.name = 'Guardería Sala Soles'
  and not exists (
    select 1 from public.posts p
    where p.daycare_id = d.id
      and p.author_id = s.id
      and p.body = '¡Usó el orinal solito por primera vez! Estaba feliz de contárselo a todos. Un gran paso.'
  );

insert into public.post_children (daycare_id, post_id, child_id, child_full_name)
select d.id, p.id, c.id, c.full_name
from public.daycares d
join public.users s
  on s.daycare_id = d.id
 and s.role = 'staff'
 and s.status = 'active'
join public.posts p
  on p.daycare_id = d.id
 and p.author_id = s.id
 and p.body = '¡Usó el orinal solito por primera vez! Estaba feliz de contárselo a todos. Un gran paso.'
join public.children c
  on c.daycare_id = d.id
 and c.full_name = 'Mateo Fernández'
where d.name = 'Guardería Sala Soles'
  and not exists (
    select 1 from public.post_children pc
    where pc.post_id = p.id
      and pc.child_id = c.id
  );