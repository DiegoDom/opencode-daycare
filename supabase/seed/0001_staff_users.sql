-- SPEC 09 — seed de usuarios de prueba.
--
-- Esto NO es una migración: se aplica con `execute_sql` (MCP) y nunca con
-- `apply_migration`, para que no entre en `list_migrations` ni en un `db push`.
-- Motivo: escribe en `auth.users` y `auth.identities`, tablas internas de GoTrue
-- cuya forma cambia entre versiones, y contiene credenciales de desarrollo. El
-- historial de migraciones es el registro de la forma del esquema.
--
-- El alta va por el mismo camino que un signup real: el trigger
-- `on_auth_user_created` crea cada perfil como `parent`/`pending`, y el `update`
-- final es la operación explícita de `service_role` que resuelve el rol.
--
-- Idempotente: los tres `insert` llevan `where not exists` y el `update` lleva
-- `where (p.role <> ... or p.status <> ...)`, así que una segunda corrida no crea
-- filas ni bumpea `updated_at`.
--
-- No usar `set search_path = ''` acá: depende del `search_path` de la sesión y
-- califica `extensions.crypt` / `extensions.gen_salt` explícitamente para no
-- depender del orden de esquemas.

-- 1. Segunda guardería, para poder probar aislamiento entre guarderías.
insert into public.daycares (name)
select 'Guardería Estrellas'
where not exists (select 1 from public.daycares where name = 'Guardería Estrellas');

-- 2. Los tres usuarios en `auth.users`.
--    `raw_app_meta_data` lo escribe el servidor y es de donde el trigger lee el
--    tenancy; `raw_user_meta_data` solo aporta `full_name`.
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
       v.email, extensions.crypt(v.password, extensions.gen_salt('bf')), now(),
       jsonb_build_object('provider', 'email', 'providers', array['email'], 'daycare_id', d.id::text),
       jsonb_build_object('full_name', v.full_name),
       now(), now(), '', '', '', ''
from (values
  ('admin@solas.test',     'Admin Soles',   'Guardería Sala Soles', 'solas-dev-password'),
  ('staff@solas.test',     'Staff Soles',   'Guardería Sala Soles', 'solas-dev-password'),
  ('parent@estrellas.test','Parent Estrellas','Guardería Estrellas', 'estrellas-dev-password')
) as v(email, full_name, daycare_name, password)
join public.daycares d on d.name = v.daycare_name
where not exists (select 1 from auth.users u where u.email = v.email);

-- 3. Una `auth.identities` por usuario: sin esto GoTrue no resuelve el login por
--    email. `provider_id` es el id de `auth.users` en texto.
insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', u.id::text, now(), now(), now()
from auth.users u
where u.email in ('admin@solas.test', 'staff@solas.test', 'parent@estrellas.test')
  and not exists (select 1 from auth.identities i where i.provider_id = u.id::text);

-- 4. Promoción de rol y estado. El trigger los dejó en `parent`/`pending`; el
--    alta de staff no es un signup, es esta operación explícita.
update public.users p
set role = v.role::public.user_role,
    status = 'active'
from auth.users u, (values
  ('admin@solas.test',      'admin'),
  ('staff@solas.test',      'staff'),
  ('parent@estrellas.test', 'parent')
) as v(email, role)
where u.email = v.email
  and p.id = u.id
  and (p.role is distinct from v.role::public.user_role or p.status is distinct from 'active');
