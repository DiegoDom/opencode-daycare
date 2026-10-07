-- SPEC 16 — `handle_new_user` tolera que el `daycare_id` de autorización lle­gue
-- en el UPDATE que GoTrue hace DESPUÉS del INSERT (admin.createUser).
-- Fix del contrato de `handle_new_user` (SPEC 09) detectado por la E2E de
-- SPEC 14. Análisis completo en `specs/database/16-...`.
-- Aplicar con el MCP de Supabase (`apply_migration`); nunca editar la base a mano.
--
-- Por qué: `adminUserCreate` de GoTrue inserta `auth.users` con solo
-- `user_metadata` y escribe `app_metadata` en un UPDATE posterior
-- (`UpdateOnly "raw_app_meta_data"`). El trigger AFTER INSERT original leía
-- `raw_app_meta_data` y abortaba la creación con
-- "falta daycare_id" por salud. El trigger AFTER UPDATE de abajo crea el perfil
-- recién cuando ese UPDATE aterriza. Los inserts SQL de staff (seeds) siguen
-- creando el perfil al INSERT, sin cambios.

-- 1. Rework de la función: idempotente y con creación diferida --------------
-- - Perfil ya existe -> early return (nunca pisa role/status: nacen
--   `parent`/`pending` y se gestionan por RPC, no se re-leen de metadata).
-- - `daycare_id` ausente al INSERT -> early return: GoTrue lo escribirá en un
--   UPDATE posterior (flujo admin.createUser de SPEC 14).
-- - `daycare_id` inválido o guardería inexistente -> se mantiene el RAISE
--   (indica un contrato roto: nosotros controlamos ese metadata).
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

  -- Idempotencia entre el INSERT y cada UPDATE posterior de auth.users
  -- (goTrue actualiza raw_app_meta_data, confirmation_token, phone, ...).
  if exists (select 1 from public.users u where u.id = new.id) then
    return new;
  end if;

  -- `daycare_id` se lee de `raw_app_meta_data`, que escribe el servidor.
  -- `raw_user_meta_data` lo puede editar el usuario: leer el tenancy de ahí
  -- permitiría que cualquiera se autoasigne a otra guardería. Si aún no está
  -- en este el UPDATE de GoTrue lo trae, y este mismo trigger creará el perfil
  -- en ese instante.
  v_raw := nullif(btrim(coalesce(new.raw_app_meta_data ->> 'daycare_id', '')), '');
  if v_raw is null then
    return new;
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

-- `create or replace` conserva la ACL anterior, pero el revoke es barato y
-- autodocumentado: Postgres otorga EXECUTE a PUBLIC en toda función nueva, y
-- `anon` y `authenticated` heredan de PUBLIC. Sin esto, `handle_new_user` es un
-- endpoint público que corre con privilegios de `postgres`.
revoke execute on function public.handle_new_user() from public, anon, authenticated, service_role;
revoke execute on function public.set_updated_at()   from public, anon, authenticated, service_role;

-- 2. Nuevo trigger AFTER UPDATE ---------------------------------------------
-- `adminUserCreate` (GoTrue) inserta el usuario y aplica `app_metadata` con un
-- UPDATE posterior. Sin este trigger, el perfil del padre activado por
-- SPEC 14 nunca se crearía. El trigger AFTER INSERT existente
-- (`on_auth_user_created`) sigue cubriendo los inserts SQL con daycare_id
-- presente (seed de staff).
create trigger on_auth_user_updated
  after update on auth.users
  for each row execute function public.handle_new_user();