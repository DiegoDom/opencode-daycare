-- 0005_dev_parent_passwords.sql
-- Dev-only: fija contraseñas para padres vinculados a niños de Sala Soles.
-- Son los fixtures del flujo parent (ver SPEC 17, criterios de visibilidad):
--   mama.mateo@solas.test → Lucía Fernández → Mateo Fernández (Sala Soles)
-- El seed viaja con el repo y se aplica con execute_sql (nunca apply_migration).
--
-- Idempotente: solo escribe si la contraseña actual no verifica la nueva
-- (`crypt(password, hash_actual)` devuelve el mismo hash si coincide), así una
-- segunda corrida no recalcula ni bumpea `updated_at`.
update auth.users u
set encrypted_password = extensions.crypt(v.password, extensions.gen_salt('bf')),
    updated_at = now()
from (values
  ('mama.mateo@solas.test', 'mateo-dev-password')
) as v(email, password)
where u.email = v.email
  and u.encrypted_password is distinct from extensions.crypt(v.password, u.encrypted_password);