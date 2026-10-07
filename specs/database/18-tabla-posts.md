# SPEC 18 — Tablas `posts`, `post_children`, `post_photos` y bucket `post-photos`

> **Estado:** Approved\
****Depende de:** SPEC 08 — `daycares`, SPEC 09 — `users`, SPEC 12 — `children`/`rooms`, SPEC 15 — `invitations`/`parent_children`, SPEC 17 — Creación de entradas (feature)\
****Fecha:** 2026-10-07\
****Objetivo:** Parte de base de datos de la SPEC 17: crear el enum `post_type`, las tablas `posts`, `post_children` y `post_photos`, la función `my_child_rooms()` y el bucket `post-photos`, con RLS de lectura para staff/admin y para los padres vinculados. La feature spec **referencia** este documento como fuente de verdad del esquema.

> **Hijo de:** [SPEC 17 — Creación de entradas del feed en Supabase (staff, con o sin fotos)](../17-crear-publicacion-supabase.md). Este spec solo cubre lo que toca a la base de datos (migración + seed); el código de la app (Server Action, feed, guard, UI) pertenece a la feature spec.

## Por qué existe este spec

El feed vive en mocks (SPEC 01) y las entradas nuevas en `localStorage` (SPEC 07). Este spec aterriza el feed en la BD siguiendo el patrón fijado por SPEC 08/09/12/15 (migración en `supabase/migrations/` aplicada vía MCP), con la restricción de diseño central: **el padre no puede leer** `children` (solo existe `children_select_staff`, SPEC 12), así que la visibilidad de anuncios por sala no puede asomarse a esa tabla desde una política de `posts` sin abrir `birth_date`/`medical_notes` a los padres. Se resuelve con `my_child_rooms()` (`SECURITY DEFINER`, scoped a `auth.uid()`).

Estado verificado de la base al momento de escribir (2026-10-07):

- Tablas en `public`: `daycares`, `users`, `rooms`, `children`, `invitations`, `parent_children` (todas con RLS).
- `children`: solo `children_select_staff`; `parent_children`: `select` staff + propio; `users`: solo `select own`.
- Existe `public.set_updated_at()` (SPEC 08). No existe ninguna tabla de entradas.
- Diseño de referencia: `../07-DB-Schema/opendaycare-database-schema.md` §7–11 (`posts`, `post_children`, `post_photos`), con las diferencias anotadas en Decisiones (enum en español de 7 valores, sin `title`, sin `width`/`height`).

## Alcance

**Incluye:**

- `supabase/migrations/<UTC>_create_posts_feed.sql` (nuevo):
  - Enum `post_type` con los 7 valores del dominio, guardián `do $$`.
  - Tablas `posts`, `post_children`, `post_photos` con índices, constraints y trigger `posts_set_updated_at`.
  - `public.my_child_rooms()` (`SECURITY DEFINER`, `set search_path = ''`, `revoke` a `public`/`anon`, `grant` a `authenticated`).
  - RLS en las 3 tablas + **8 políticas** (3 en `posts`, 3 en `post_children`, 2 en `post_photos`).
  - Bucket `post-photos` (público, ≤5 MB, PNG/JPG/WebP) + política `insert` sobre `storage.objects`.
  - Reconciliación del nombre del archivo con la `version` que devuelve `apply_migration`.
- **RLS de** `posts` **(SELECT):**
  - `posts_select_staff`: predicado estándar sobre `daycare_id` — staff/admin activos ven **todas** las entradas de su guardería (sin filtro de sala).
  - `posts_select_parent`: entradas que incluyen a uno de sus hijos (`post_children` ∩ `parent_children`) **o** entradas con `room_id` de una sala donde tiene hijos (`my_child_rooms()`).
  - Sin `UPDATE`/`DELETE` (denied by default; no hay UI de edición en SPEC 17).
- **RLS de** `posts` **(INSERT):** `author_id = auth.uid()` + predicado staff/admin sobre `daycare_id` + `room_id` nulo o de una sala **de la misma guardería** (evita que un staff publique en salas ajenas).
- **RLS de** `post_children`**:** `select` staff (vía fila de `children` del mismo daycare + predicado de rol) y `select` parent (solo filas de sus hijos vinculados); `insert` exige que el post y el niño pertenezcan al mismo daycare y que el viewer pueda insertar en ese post. Sin `update`/`delete`.
- **RLS de** `post_photos`**:** `select` delegado en la visibilidad del post (`exists posts`, el RLS de `posts` hace el filtrado — cubre staff y parent con una sola política); `insert` exige poder insertar en el post dueño. Sin `update`/`delete` (no hay upsert: `storage` necesita `insert` solo, ver skill de Supabase).
- **Storage:** bucket `post-photos` con `file_size_limit = 5242880` y `allowed_mime_types = ['image/png','image/jpeg','image/webp']` (validación server-side del bucket); política `insert` solo para staff/admin activos cuyo `daycare_id` coincide con `(storage.foldername(name))[1]` (path `{daycare_id}/{post_id}/{i}-{nombre}`). Lectura vía endpoint público del bucket (sin política `select`); sin `delete` ni `update`.
- **Seed** `supabase/seed/0004_dev_posts.sql`: 2 entradas de texto (una anuncio a toda la sala "Soles", una a destinatarios específicos), idempotente, aplicado con `execute_sql`.
- **Probe de exposición al Data API** de las 3 tablas nuevas (changelog 2026-04-28: desde 2026-10-30 no se exponen por defecto; precedente SPEC 08).

**Fuera de alcance (specs futuros):**

- Reacciones (`reactions`) y comentarios (`comments`) del schema de referencia.
- `posts.title`, `post_photos.width`/`height` (sin UI).
- Editar/borrar entradas: las políticas `UPDATE`/`DELETE` llegan con ese spec (el estado `revoked`/borrado lógico está por verse).
- Notificaciones, Realtime, `cron` de limpieza de archivos huérfanos.
- Ampliar la lectura de `children` a padres (perfil del niño para la familia).
- Toda la parte de app (Server Action, feed, UI, guard): SPEC 17.

## Modelo de datos

El SQL exacto se aplica y se commitea en `supabase/migrations/<UTC>_create_posts_feed.sql` (el nombre se reconcilia con la `version` devuelta, patrón SPEC 08). Sección por sección:

### 1. Enum

```sql
do $$
begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'post_type' and n.nspname = 'public') then
    create type public.post_type as enum
      ('comida', 'siesta', 'actividad', 'logro', 'animo', 'foto', 'anuncio');
  end if;
end $$;
```

Los valores son los del dominio del front (`PostType` de SPEC 01/07) — mapeo 1:1, sin traducción en la app.

### 2. Tabla `posts`

```sql
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

create index if not exists posts_daycare_published_idx on public.posts (daycare_id, published_at desc);
create index if not exists posts_room_id_idx  on public.posts (room_id);
create index if not exists posts_author_id_idx on public.posts (author_id);

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();
```

- `room_id` con valor = "Toda la sala"; `room_id` nulo = destinatarios específicos en `post_children`. La exclusividad la valida la app (SPEC 17); no hay constraint cross-tabla.
- `author_name` es **snapshot** del `users.full_name` al publicar (el feed no embeddea `users`: solo existe `users_select_own` y abrirlo daría nombres de padres al staff de paso).
- `on delete cascade` en `room_id`: borrar una sala borra sus anuncios (no hay UI de borrado de salas, SPEC 12).

### 3. Tabla `post_children`

```sql
create table if not exists public.post_children (
  daycare_id      uuid        not null references public.daycares(id)  on delete cascade,
  post_id         uuid        not null references public.posts(id)     on delete cascade,
  child_id        uuid        not null references public.children(id)  on delete cascade,
  child_full_name text        not null,
  created_at      timestamptz not null default now(),
  primary key (post_id, child_id),
  constraint post_children_child_name_not_blank check (length(btrim(child_full_name)) > 0)
);

create index if not exists post_children_child_id_idx  on public.post_children (child_id);
create index if not exists post_children_daycare_id_idx on public.post_children (daycare_id);
```

- PK compuesta `(post_id, child_id)`: una entrada no puede repetir al mismo niño (patrón del schema de referencia; sin columna `id`, a diferencia de `parent_children`).
- `child_full_name` snapshot (mismo motivo que `author_name`; el padre no puede leer `children`).
- `daycare_id` denormalizado: permite la política `select` de staff como predicado hoja sobre `users` **sin** subquery a `posts` (evita recursión entre políticas, ver Arquitectura).

### 4. Tabla `post_photos`

```sql
create table if not exists public.post_photos (
  id         uuid                primary key default gen_random_uuid(),
  post_id    uuid                not null references public.posts(id) on delete cascade,
  url        text                not null,
  position   smallint            not null default 0,
  created_at timestamptz         not null default now(),
  constraint post_photos_position_check check (position >= 0 and position <= 3),
  constraint post_photos_url_not_blank  check (length(btrim(url)) > 0)
);

create index if not exists post_photos_post_id_idx on public.post_photos (post_id);
```

- `url` = URL pública completa del objeto en el bucket (`getPublicUrl` en la action), como en el schema de referencia. Sin `width`/`height` (no los usa la UI).
- Sin `daycare_id`: su visibilidad se delega en `posts` (subquery con el RLS de `posts`), y como las políticas de `posts` nunca subqueriean `post_photos`, no hay ciclo.

### 5. `my_child_rooms()` — habitación de los hijos del padre

```sql
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

revoke execute on function public.my_child_rooms() from public, anon;
grant  execute on function public.my_child_rooms() to authenticated;
```

- `SECURITY DEFINER` porque el predicado de `posts_select_parent` necesita `children.room_id` y **no** existe política de `select` de `children` para padres. La función solo devuelve salas propias (scoped por `auth.uid()` dentro del cuerpo), no filas de `children`.
- El `revoke` va en la **misma** migración (skill de Supabase: `EXECUTE` a `PUBLIC` por defecto → endpoint público en `/rest/v1/rpc/my_child_rooms`; advisor `anon_security_definer_function_executable`).
- `set search_path = ''` hace explícito el schema en cada objeto.

### 6. RLS y políticas

```sql
alter table public.posts         enable row level security;
alter table public.post_children enable row level security;
alter table public.post_photos   enable row level security;

-- ── posts ──────────────────────────────────────────────────────────────
-- staff/admin activos: todas las entradas de su guardería
create policy posts_select_staff on public.posts for select to authenticated
  using (exists (select 1 from public.users u
    where u.daycare_id = posts.daycare_id and u.id = (select auth.uid())
      and u.status = 'active' and u.role in ('staff', 'admin')));

-- padres: entradas de sus hijos + anuncios de sus salas
create policy posts_select_parent on public.posts for select to authenticated
  using (
    exists (select 1 from public.post_children pc
      where pc.post_id = posts.id
        and exists (select 1 from public.parent_children link
          where link.child_id = pc.child_id
            and link.parent_id = (select auth.uid())))
    or (posts.room_id is not null
        and posts.room_id in (select public.my_child_rooms()))
  );

-- solo staff/admin de la guardería publicando como ellos mismos,
-- y el room (si va) debe ser de la misma guardería
create policy posts_insert_staff on public.posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.users u
      where u.id = (select auth.uid()) and u.daycare_id = posts.daycare_id
        and u.status = 'active' and u.role in ('staff', 'admin'))
    and (room_id is null or exists (select 1 from public.rooms r
      where r.id = posts.room_id and r.daycare_id = posts.daycare_id))
  );

-- ── post_children ──────────────────────────────────────────────────────
-- staff: filas cuyo niño es de su guardería (children ya filtra por RLS)
create policy post_children_select_staff on public.post_children for select to authenticated
  using (exists (select 1 from public.children c
    where c.id = post_children.child_id
      and exists (select 1 from public.users u
        where u.id = (select auth.uid()) and u.daycare_id = c.daycare_id
          and u.status = 'active' and u.role in ('staff', 'admin'))));

-- padres: solo filas que apuntan a sus hijos
create policy post_children_select_parent on public.post_children for select to authenticated
  using (exists (select 1 from public.parent_children link
    where link.child_id = post_children.child_id
      and link.parent_id = (select auth.uid())));

-- staff: insertar solo en posts de su guardería y con niños de esa guardería
create policy post_children_insert_staff on public.post_children for insert to authenticated
  with check (
    exists (select 1 from public.posts p
      where p.id = post_children.post_id
        and exists (select 1 from public.users u
          where u.id = (select auth.uid()) and u.daycare_id = p.daycare_id
            and u.status = 'active' and u.role in ('staff', 'admin')))
    and exists (select 1 from public.children c
      where c.id = post_children.child_id
        and c.daycare_id = (select p2.daycare_id from public.posts p2
                            where p2.id = post_children.post_id))
  );

-- ── post_photos ────────────────────────────────────────────────────────
-- la visibilidad de la foto es la de su post (RLS de posts decide)
create policy post_photos_select on public.post_photos for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_photos.post_id));

create policy post_photos_insert on public.post_photos for insert to authenticated
  with check (exists (select 1 from public.posts p
    where p.id = post_photos.post_id
      and exists (select 1 from public.users u
        where u.id = (select auth.uid()) and u.daycare_id = p.daycare_id
          and u.status = 'active' and u.role in ('staff', 'admin'))));
```

Puntos no negociables (heredados de SPEC 08/09/15):

- `to authenticated`, nunca `auth.role()`. Todo predicado exige `status = 'active'`.
- Sin políticas `UPDATE`/`DELETE` en las 3 tablas: ausencia = denegado. La edición llegará con su spec (y ahí `UPDATE` necesita `USING` + `WITH CHECK` y su `select` correspondiente — ya existe).
- Un `insert` con `WITH CHECK` sin `select` previo funciona (RLS de insert no exige select), pero el `select` de staff va en la misma migración igual: la app lee.
- `posts_insert_staff` valida el `room_id` contra `rooms` del mismo daycare: sin eso, un staff podría publicar "toda la sala" apuntando a una sala ajena y los padres de esa sala la verían.

### 7. Storage: bucket y política

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

alter table storage.objects enable row level security;

create policy post_photos_insert_staff on storage.objects for insert to authenticated
  with check (
    bucket_id = 'post-photos'
    and exists (select 1 from public.users u
      where u.id = (select auth.uid())
        and u.status = 'active' and u.role in ('staff', 'admin')
        and u.daycare_id::text = (storage.foldername(name))[1])
  );
```

- Path convention: `{daycare_id}/{post_id}/{i}-{nombre-archivo}`. El primer folder debe ser el `daycare_id` del publicador — la action de SPEC 17 lo garantiza.
- **No hay política** `select`: el bucket es público y la lectura pasa por `/object/public/...` (sin auth, sin RLS). **No hay** `update` (la action no hace upsert; el skill de Supabase recuerda que upsert necesitaría `insert`+`select`+`update`, no es nuestro caso).
- **No hay** `delete`: no hay UI de borrado; los archivos huérfanos (riesgo de SPEC 17) quedan hasta limpieza manual.
- Los límites de tamaño/mime del bucket son server-side reales; la action valida además para devolver error amigable.

## Arquitectura / Patrones

Este spec es **Infraestructura pura** de BD (SPEC 00): no toca Dominio, Aplicación ni Presentación. La feature spec (SPEC 17) es la única consumidora y **referencia este documento**.

- **Nuevo (infra):** `supabase/migrations/<UTC>_create_posts_feed.sql`.
- **Nuevo (infra, seed):** `supabase/seed/0004_dev_posts.sql` — aplicado con `execute_sql`, nunca con `apply_migration`.
- **Sin cambios:** `data/`, `lib/`, `app/`, `components/`.

### Anti-recursión de RLS (por qué cada política subqueriea lo que subqueriea)

Postgres lanza `42P17 infinite recursion detected in policy` si las políticas de dos tablas se referencian en ciclo. El grafo de este spec es un DAG:

```
posts → { users, rooms, post_children → { children → users, parent_children → users }, my_child_rooms() }
post_children → { posts (solo en INSERT), children, users, parent_children }
post_photos → { posts, users }
storage.objects → { users }
```

- `posts_select_parent` subqueriea `post_children`, cuyas políticas de `select` **no** tocan `posts` (por eso `post_children` lleva `daycare_id` denormalizado para el predicado de staff).
- `post_photos` delega en `posts` pero `posts` nunca subqueriea `post_photos`.
- `my_child_rooms()` es `SECURITY DEFINER`: entra a `children`/`parent_children` por fuera de sus políticas, sin disparar recursión.
- `users` y `parent_children` son hojas (sus políticas no apuntan a estas tablas).

Patrón de migraciones (SPEC 08): escribir el `.sql` commiteado, aplicarlo con `apply_migration`, renombrar el archivo si la `version` difiere, verificar con probes + advisors. Seeds en `supabase/seed/` con `execute_sql` e idempotencia (`where not exists` / `is distinct from`).

## Seed de prueba

`supabase/seed/0004_dev_posts.sql` deja 2 entradas en el daycare del seed de SPEC 09 para que el feed no arranque vacío:

1. **Anuncio a toda la sala "Soles"** (`type = 'anuncio'`, `room_id` = la sala, `body` = el anuncio del parque del mock de SPEC 01).
2. **Entrada a destinatarios específicos** (`type = 'logro'`, `room_id` null + 1 fila en `post_children` con el niño "Mateo Fernández" del seed 0002, snapshot `child_full_name`).

Ambas con `author_id`/`author_name` = "Staff Solas" (seed 0001). Idempotente: `where not exists` por `(daycare_id, author_id, body)` en `posts`, y lo mismo por `(post_id, child_id)` en `post_children` — una segunda corrida no crea filas. Aplicado con `execute_sql`.

**Por qué no hay foto en el seed:** los bytes de una imagen no se pueden crear por SQL (insertar una fila en `storage.objects` no sube el archivo al backend y la URL pública devolvería 404). El caso **con** foto se valida por UI en los criterios de SPEC 17.

## Plan de implementación

1. **Migración.** Escribir el `.sql` de arriba (enum → tablas → índices → trigger → `my_child_rooms` → RLS → bucket + política de storage) y aplicarlo con `apply_migration`; si la `version` devuelta no coincide con el prefijo del archivo, renombrar el archivo. Verify: `list_tables` muestra las 3 tablas con `relrowsecurity = true`; `pg_policies` lista 3+3+2 políticas en `public` y 1 en `storage.objects`; `get_advisors('security')` sin `anon_security_definer_function_executable` ni hallazgos nuevos; `get_advisors('performance')` limpio.
2. **Exposición al Data API.** Probe de que `authenticated` puede consultar `posts` por la Data API (precedente SPEC 08, changelog 2026-10-30); si la tabla no está expuesta, grant explícito anotado en la migración. Verify: query REST de `posts` como `authenticated` devuelve filas (0 o las del seed), no error de esquema.
3. **Seed.** Escribir `supabase/seed/0004_dev_posts.sql` y aplicarlo con `execute_sql`. Verify: 2 filas en `posts`, 1 en `post_children`; segunda corrida no duplica.
4. **Probes de RLS** (bloque con `set local role authenticated` + `request.jwt.claims`, con `rollback`, patrón SPEC 15):
   - `anon`: 0 filas en las 3 tablas (aunque `has_table_privilege` sea `true`).
   - Staff de la guardería A: ve las 2 entradas del seed; 0 de otra guardería.
   - Staff intenta `insert` con `room_id` de otra guardería o `child_id` ajeno → rechazado.
   - Parent vinculado al niño del seed: ve la entrada dirigida a su hijo y el anuncio de su sala; **no** ve entradas de otras salas ni de otros niños; en la entrada propia solo ve sus filas de `post_children`; intento de `insert` en `posts` → 0 filas.
   - `my_child_rooms()`: como parent devuelve sus salas; `anon` sin `EXECUTE`.
   - Policies de `storage.objects` presentes (`pg_policies`); el upload real se prueba por UI (SPEC 17).

## Criterios de aceptación

- [ ] `posts`, `post_children` y `post_photos` existen en `public` con `relrowsecurity = true` y `list_tables` las muestra.

- [ ] El enum `post_type` existe con los 7 valores (`comida`, `siesta`, `actividad`, `logro`, `animo`, `foto`, `anuncio`); la migración es re-aplicable (guardián `do $$` + `if not exists`).

- [ ] Existen los índices `(daycare_id, published_at desc)` en `posts`, `child_id` en `post_children` y `post_id` en `post_photos`.

- [ ] `pg_policies` lista 3 políticas en `posts` (2 select + 1 insert, todas `to authenticated`), 3 en `post_children` (2 select + 1 insert) y 2 en `post_photos` (1 select + 1 insert). Cero políticas `UPDATE`/`DELETE` en las 3 tablas.

- [ ] `pg_policies` lista la política `insert` de `storage.objects` para `post-photos`; el bucket existe con `public = true`, `file_size_limit = 5242880` y los 3 mimes.

- [ ] `public.my_child_rooms()` existe; `has_function_privilege('authenticated', ..., 'EXECUTE')` es `true`; `anon` y `public` no tienen `EXECUTE`.

- [ ] `has_table_privilege('anon', 'posts', 'SELECT')` es `true` (default privileges) y aun así `anon` ve 0 filas en las 3 tablas por RLS.

- [ ] Probe como `parent`: ve la entrada que apunta a su hijo y el anuncio de su sala; 0 filas de entradas de otras salas/niños ajenos; 0 filas al intentar `insert`.

- [ ] Probe como staff de otra guardería: 0 filas de las entradas ajenas; `insert` con `room_id`/`child_id` ajeno rechazado.

- [ ] Probe como staff propio: ve las 2 entradas del seed con sus `post_children`/`post_photos` completos.

- [ ] `get_advisors('security')` no reporta `anon_security_definer_function_executable` ni hallazgos nuevos atribuibles a este spec; `get_advisors('performance')` sin hallazgos nuevos.

- [ ] `supabase/seed/0004_dev_posts.sql` deja 2 filas en `posts` y 1 en `post_children`; una segunda corrida no duplica ni bumpea `updated_at`.

## Decisiones

- **Sí:** enum `post_type` con los **7 valores en español** del dominio del front (no los 6 ingleses `meal/nap/...` del schema de referencia): mapeo 1:1 con `PostType`, cero código de traducción, y precedente de enums en español (`parent_role`).
- **Sí:** `author_name` y `child_full_name` como snapshots — evita crear políticas nuevas sobre `users` (daría nombres de padres al staff) y sobre `children` (daría `birth_date`/`medical_notes` a los padres). Precedente: `invitations.full_name`.
- **Sí:** `my_child_rooms()` `SECURITY DEFINER` en vez de `children_select` para padres: superficie mínima (solo sala, solo propios) y el feed no necesita más.
- **Sí:** `daycare_id` denormalizado en `post_children` — permite el `select` de staff como predicado hoja sobre `users` y corta el ciclo `posts ↔ post_children` (anti-recursión, arriba).
- **Sí:** `post_photos` sin `daycare_id`: su `select` delega en `posts` (`exists`), que nunca lo subqueriea.
- **Sí:** visibilidad del padre como `OR` en `posts_select_parent` (destinatarios propios o anuncio de sus salas) — es la regla del schema de referencia §7 traducida a políticas.
- **Sí:** bucket **público** con límites declarativos (5 MB, 3 mimes) y path por `{daycare_id}/{post_id}` — lectura simple por `<img src>` sin firmar URLs.
- **Sí:** `on delete cascade` en `room_id`: borrar una sala (sin UI) no deja anuncios huérfanos invisibles para padres.
- **Sí:** seed solo de texto (2 entradas): los bytes de una imagen no se crean por SQL; el caso con foto es criterio de UI de SPEC 17.
- **No:** `title`, `width`/`height`, `reactions`, `comments` — sin UI, llegan con sus specs.
- **No:** políticas `UPDATE`/`DELETE` en `posts`/`post_children`/`post_photos` — sin UI de edición; ausencia = denegado (precedente `parent_children`).
- **No:** política `select` en `storage.objects` — bucket público lee por endpoint público; política de `select` solo haría falta para buckets privados.
- **No:** guardar `post_photos` como dataURL/base64 en la columna — infla la tabla y viola las prácticas de Postgres; por eso SPEC 17 sube a Storage.
- **No:** indexar `post_photos(url)` — no hay búsquedas por URL.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| **Changelog 2026-04-28:** desde **2026-10-30** las tablas nuevas de `public` dejan de exponerse al Data API por defecto (hoy es opt-in) | Paso 2 del plan: probe de exposición con el cliente de SPEC 17 y grant explícito si hace falta (precedente SPEC 08). El RLS sigue siendo la puerta de filas. |
| `42P17 infinite recursion` si una política subqueriea en ciclo | Grafo DAG verificado (Arquitectura); `post_children` denormalizado y `my_child_rooms()` definer rompen los únicos ciclos posibles. El paso 1 lo prueba al aplicar. |
| Un `SECURITY DEFINER` sin `revoke` deja `my_child_rooms` como RPC público | `revoke` de `public`/`anon` en la misma migración + criterio con `has_function_privilege` + advisor. |
| Parent sin filas de `children` no ve anuncios de sala | Resuelto por `my_child_rooms()`; probe del paso 4 verifica anuncio visible/invisible por sala. |
| Borrado de una sala o de un niño deja sin entrada a los padres | `on delete cascade` documentado; sin UI de borrado hoy (SPEC 12). |
| Subida exitosa + insert fallido deja archivos huérfanos en Storage | Aceptado y anotado en SPEC 17: sin política `delete` no hay limpieza automática; ningún feed los referencia. |
| El subquery del predicado consulta `children`/`users`, cuyo RLS se aplica encima (fail-closed) | Precedente SPEC 09/15: funciona porque los predicados exigen `u.id = auth.uid()` o pasan por `children_select_staff` del mismo daycare. Se prueba en el paso 4. |

## Lo que **no** está en este spec

- Toda la app: Server Action, lectura del feed, guard de rol, selector de sala, ocultamiento para padres (SPEC 17).
- Reacciones y comentarios (`reactions`, `comments` del schema de referencia).
- `posts.title`, `post_photos.width`/`height`.
- Editar/borrar entradas (políticas `UPDATE`/`DELETE` cuando haya UI).
- Notificaciones (`notify_on_post`), Realtime, limpieza de archivos huérfanos.
- Ampliar la lectura de `children` o `users` a padres/staff más allá de lo que el feed necesita.

Cada uno de esos, si llega, va en su propio spec.