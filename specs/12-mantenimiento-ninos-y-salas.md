# SPEC 12 — Mantenimiento de niños y salas en `/kids` (`children` + `rooms`)

> **Estado:** Approved **Depende de:** SPEC 00 — Arquitectura, SPEC 02 — Niños y Perfil, SPEC 05 — Agregar niño, SPEC 06 — Vincular padre, SPEC 07 — Crear publicación, SPEC 08 — Tabla `daycares`, SPEC 09 — Tabla `users`, SPEC 10 — Autenticación y protección de rutas **Fecha:** 2026-10-06 **Objetivo:** Crear las tablas `rooms` y `children` con RLS en Supabase, sembrar 3 salas por defecto (Soles, Estrellas, Lunitas) y unos niños de prueba, y migrar `/kids` —listado, alta y edición desde `/kids/[id]`— para que la base de datos sea la única fuente de datos de niños y salas.

## Alcance

**Incluye:**

- **Migración DDL** `supabase/migrations/<UTC>_create_children_rooms.sql`: enum `child_status` (`active`/`archived`), tablas `rooms` y `children` (con `daycare_id`), trigger `updated_at` (reutiliza `public.set_updated_at()`), RLS habilitado y políticas.
- **RLS de** `children`**:** `select`/`insert`/`update` solo para `role in ('staff','admin')` con `daycare_id` propio y `status='active'` (mismo patrón de subquery sobre `public.users` que fijó SPEC 09). Sin política `DELETE` → denegado por omisión. `parent` queda con 0 filas vía API también.
- **RLS de** `rooms`**:** `select` para staff/admin de la guardería; sin `insert`/`update` (no hay CRUD de salas en UI; el seed escribe como dueño de la BD y no pasa por RLS).
- **Guard de rol en** `/kids` **y** `/kids/[id]`**:** `role = 'parent'` (o `pending`) → redirect a `/`. Nueva `app/(app)/kids/layout.tsx` con la validación, reutilizando el `getCurrentUser()` de SPEC 10.
- **Seed** `supabase/seed/0002_rooms_children.sql` (con `execute_sql`, nunca migración): 3 salas —`Soles`, `Estrellas`, `Lunitas`— en "Guardería Sala Soles" resuelta por nombre (patrón del seed 0001), más los niños del mock de SPEC 02 mapeados a `children` (nombre, `birth_date`, `enrolled_at`, `room_id`, `allergy_tags`, `medical_notes`), idempotente.
- `lib/kids.ts` **como única fuente:** lee de Supabase con el cliente de servidor (`data/supabase/server.ts`, RLS hace el scoping por sesión), mapea fila → view model `Kid`, y expone `getKids()`, `getKidById()`, `searchKids()` (fetch del total de la guardería y filtrado en memoria con el `matchesName` actual — preserva la búsqueda insensible a acentos) + `getRooms()`. Los tipos `Kid`/`KidParent`/`KidNote` se mudan de `data/mock/kids.ts` a `lib/kids.ts` (los componentes ya importan desde `@/lib/kids`; nadie importa `data/mock/kids` salvo `lib/kids.ts`).
- **Alta de niño en la BD:** Server Action `addChildAction` en `lib/kids-actions.ts` (validación reutilizando `lib/kid-validation.ts`, `daycare_id` de la sesión, `room_id` por nombre, `enrolled_at = today`, `photo_consent = true`, `status = 'active'`) llamada desde `add-kid-modal.tsx`; el modal recibe `rooms` como prop en vez del hardcode `ROOMS`.
- `kids-shell.tsx` **deja de ser client:** sin lectura de `opdaycare.kids.v1`, sin `buildKid`; agrupa por la prop `rooms` (los niños sin sala caen en un grupo "Sin sala") y reacciona al alta con `router.refresh()`. El listado pasa a ser Server Component de verdad.
- **Edición desde** `/kids/[id]`**:** el perfil lee el niño de la BD (`notFound()` si no existe); nuevo `edit-kid-modal.tsx` (mismos campos que el alta: nombre, fecha de nacimiento, sala, alergias, notas) que llama a `updateKidAction`.
- **Cero lectura de niños en localStorage:** `create-post-shell.tsx` deja de mezclar `opdaycare.kids.v1` (usa solo `baseKids`, que ahora viene de la BD vía `getKids()`). La clave sigue viva únicamente para los padres de SPEC 06.
- **Borrado de** `data/mock/kids.ts` una vez que `lib/kids.ts` deja de importarlo.
- **Verificación:** `npm run lint`, `npm run build`, chequeo manual con Playwright MCP y probes de RLS con `execute_sql` + `get_advisors`.

**Fuera de alcance (specs futuros):**

- `parent_children`: la card PADRES VINCULADOS sigue haciendo merge desde localStorage (SPEC 06 intacta); el vínculo real en BD es su propio spec.
- Archivado de niños (`child_status = 'archived'`) y borrado físico: el enum existe pero no hay UI ni flujo.
- CRUD de salas desde la UI (crear/renombrar/eliminar): las 3 vienen del seed.
- Que un `parent` vea `/kids` (o solo sus hijos): hoy entra solo `staff`/`admin`.
- Migración a BD de los niños ya guardados en `localStorage["opdaycare.kids.v1"]` y de los padres mock del seed: no se migran.
- Posts/publicaciones (`opdaycare.posts.v1`) y el resto del feed: siguen mock + localStorage.
- `/publicar` como pantalla: solo cambia su fuente de niños por efecto de `lib/kids.ts`; permisos de publicación por rol no entran.
- Alta de salas para guarderías nuevas y edición de la guardería.

## Modelo de datos

```sql
-- Migración (nuevo archivo supabase/migrations/<UTC>_create_children_rooms.sql)
create type public.child_status as enum ('active', 'archived');  -- guardado en do $$ como user_role

create table public.rooms (
  id         uuid primary key default gen_random_uuid(),
  daycare_id uuid not null references public.daycares(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  constraint rooms_name_not_blank check (length(btrim(name)) > 0),
  constraint rooms_daycare_name_unique unique (daycare_id, name)
);

create table public.children (
  id            uuid primary key default gen_random_uuid(),
  daycare_id    uuid not null references public.daycares(id) on delete restrict,  -- desvío ver Decisiones
  room_id       uuid references public.rooms(id) on delete set null,              -- nullable (schema de referencia)
  full_name     text not null,
  birth_date    date not null,
  enrolled_at   date not null default current_date,
  medical_notes text,
  allergy_tags  text[] not null default '{}',
  photo_consent boolean not null default true,
  status        public.child_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint children_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint children_birth_date_not_future check (birth_date <= current_date)
);
-- trigger children_set_updated_at → public.set_updated_at() (función ya existente)
```

```ts
// lib/kids.ts — el view model que la UI ya conoce (mismos campos que el mock)
export interface Kid {
  id: string;            // uuid de la BD
  name: string;
  initials: string;      // derivado del nombre
  avatarBg: string;      // PALETTE[hash(id) % 5], determinista
  avatarColor: string;
  age: number;           // calculado de birth_date
  parentsCount: number;  // length(parents) tras el merge de localStorage
  birthDate: string;     // "12 mar 2022"
  room: string;          // join con rooms; "" si room_id es null → grupo "Sin sala"
  enrollmentDate: string;// "feb 2025"
  badge?: { label: string; bg: string; text: string };  // primer allergy_tags traducido
  note?: { title: string; text: string };               // medical_notes
  parents: KidParent[];  // siempre []; el merge por id lo hace kid-profile-shell
}
```

Catálogo de alergias (lib/kids.ts): `peanut → MANÍ`, `lactose → LACTOSA`, `gluten → GLUTEN`, `egg → HUEVO`, `soy → SOJA`; valor no reconocido se muestra en mayúsculas tal cual.

## Arquitectura / Patrones

- El scoping por guardería lo hace el RLS, no el código: `lib/kids.ts` usa el cliente de servidor (`createClient()` de `data/supabase/server.ts`) con las cookies de la sesión, y `auth.uid()` dentro de las políticas resuelve el `daycare_id` y el `role`. Mismo patrón que `lib/auth.ts` (SPEC 10).
- Las políticas siguen el patrón de SPEC 09: subquery `exists (select 1 from public.users u where u.daycare_id = <tabla>.daycare_id and u.id = (select auth.uid()) and u.status = 'active' and u.role in ('staff','admin'))`. El RLS de `users` se aplica encima del subquery (fail-closed).
- Las Server Actions viven en `lib/` (`lib/kids-actions.ts`, precedente `lib/auth-actions.ts`): sin JSX ni `"use client"`, validación pura con `lib/kid-validation.ts` y `revalidatePath("/kids")` tras escribir.
- `app/` y `components/` siguen sin importar de `data/`: todo fluye por `lib/kids.ts`. El único importador de `data/mock/kids.ts` era `lib/kids.ts`, así que el archivo se borra entero.
- El seed sigue el patrón de AGENTS.md: `supabase/seed/<NNN>_<nombre>.sql` + `execute_sql`, idempotente (`where not exists`), resolviendo el daycare por nombre como hace `0001_staff_users.sql`.

## Plan de implementación

1. **Migración.** Escribir `supabase/migrations/<UTC>_create_children_rooms.sql` con el DDL de arriba + `alter table ... enable row level security` + políticas (`children_select_staff`, `children_insert_staff`, `children_update_staff`, `rooms_select_staff`, predicado `exists` sobre `public.users` con `role in ('staff','admin')`). Aplicar con `apply_migration`; si la `version` devuelta no coincide con el prefijo, renombrar el archivo. Verify: `list_tables` muestra ambas con `rls_enabled`; `get_advisors('security')` sin hallazgos nuevos.
2. **Seed.** Crear `supabase/seed/0002_rooms_children.sql` y aplicarlo con `execute_sql`: 3 salas + los niños del mock (nombre, fechas, alergias `'{peanut}'`/`'{lactose}'`, notas) en Soles, resolviendo el daycare por nombre. Verify: 3 filas en `rooms`, ≥6 en `children`; segunda corrida no duplica.
3. **Fuente de datos.** Mover los tipos `Kid`/`KidParent`/`KidNote` a `lib/kids.ts`, reimplementar `getKids`/`getKidById`/`searchKids` contra Supabase (cliente de servidor, filtrado en memoria con `matchesName`) y sumar `getRooms()`. Borrar `data/mock/kids.ts`. `/kids` y `/publicar` pasan a BD; `kids-shell` sigue client y sigue mezclando localStorage (transición). Verify: `npm run build` y `/kids` muestra los niños del seed.
4. **Alta.** Crear `lib/kids-actions.ts` con `addChildAction` (valida, inserta, `revalidatePath("/kids")`); `add-kid-modal.tsx` recibe `rooms` como prop y llama a la action; `kids-shell.tsx` pierde `STORAGE_KEY`/`buildKid`/lectura de localStorage y el merge de niños. Verify: alta en `/kids` sobrevive recarga (aparece en `execute_sql`).
5. **Guard de rol.** Crear `app/(app)/kids/layout.tsx` que redirige a `/` si el perfil no es `staff`/`admin` activo. Verify: con `parent@estrellas.test`, `/kids` y `/kids/[id]` redirigen.
6. **Edición.** `app/(app)/kids/[id]/page.tsx` lee de BD (`notFound()` si no hay fila); nuevo `components/edit-kid-modal.tsx` + `updateKidAction`; `kid-profile-shell.tsx` abre el modal desde el encabezado y mantiene el merge de parents por `kid.id`. Verify: editar sala/notas persiste tras recargar.
7. **Limpieza del selector.** Quitar a `create-post-shell.tsx` la mezcla de `opdaycare.kids.v1` (usa solo `baseKids`). Verify: `/publicar` lista los niños de Soles desde la BD.
8. **Verificación final.** `npm run lint`, `npm run build`, recorrido con Playwright (listado, búsqueda, alta, edición, redirect de parent) y probes RLS: `execute_sql` con rol `parent` sobre `children` → 0 filas.

## Criterios de aceptación

- [ ] `rooms` y `children` existen con RLS habilitado; `get_advisors('security')` no reporta hallazgos nuevos por este spec.

- [ ] El seed crea exactamente 3 salas (`Soles`, `Estrellas`, `Lunitas`) y una segunda corrida no duplica filas ni bump `created_at`.

- [ ] `/kids` muestra los niños sembrados agrupados bajo encabezados de sala, con las 3 salas presentes aunque alguna esté vacía.

- [ ] Recargar `/kids` conserva el listado sin `localStorage` de por medio (viene de la BD).

- [ ] Agregar un niño desde el modal lo persiste en `children` con `daycare_id` de la sesión y aparece en el listado tras recargar.

- [ ] Editar nombre, fecha, sala, alergias o notas desde `/kids/[id]` persiste en la BD y se ve en el listado.

- [ ] Con sesión `parent` o `pending`, `/kids` y `/kids/[id]` redirigen a `/`.

- [ ] Una consulta `select` sobre `children` con el rol `parent` devuelve 0 filas (RLS).

- [ ] `select`/`insert`/`delete` sobre `children` desde `anon` no produce filas ni filas afectadas.

- [ ] No queda ninguna referencia a `data/mock/kids` ni lectura de `opdaycare.kids.v1` para niños (`grep` limpio en `app/`, `components/`, `lib/`).

- [ ] La card PADRES VINCULADOS sigue funcionando: vincular un padre desde el perfil sobrevive recarga.

- [ ] `npm run lint` y `npm run build` pasan; feed, login y `/publicar` siguen operativos.

## Decisiones

- **Sí:** la BD es la única fuente de `/kids` (mock eliminado). Mezclar mock + BD duplicaría niños fantasma.
- **Sí:** seed de niños del mock en `supabase/seed/`. Sin esto `/kids` arrancaría vacía y la pantalla no sería demostrable.
- **Sí:** salas `Soles`, `Estrellas`, `Lunitas` (los nombres del hardcode actual; "Soles" sin el prefijo "Sala" — "Sala" es el prefijo del nombre de la guardería, no de la sala).
- **Sí:** salas y niños en un **seed** (`execute_sql`), no en una migración. Regla de AGENTS.md: el seed no es migración; `db push` no debe re-sembrar datos de demo.
- **Sí:** alta + edición básica de niño. **No:** archivado ni CRUD de salas (sin UI, sin pedido).
- **Sí:** `/kids/[id]` migra a la BD en este spec. Si el listado migra y el perfil no, el perfil mostraría datos que ya no existen.
- **Sí:** `parent` no entra a `/kids` (guard de rol + RLS). Sin `parent_children` no hay forma de mostrar solo *sus* hijos; filtrar a nivel de RLS por padre requiere la tabla de vínculos (otro spec).
- **Sí:** `children.daycare_id NOT NULL`. El schema de referencia scopes por `room_id` nullable: un niño sin sala quedaría invisible al RLS y sin guardería. Desvío anotado aquí, no en el schema de referencia.
- **Sí:** los niños de `localStorage["opdaycare.kids.v1"]` dejan de leerse, sin migración one-shot. La clave queda solo para los padres (SPEC 06).
- **Sí:** card PADRES VINCULADOS igual que hoy (merge por `kid.id` desde localStorage). `parent_children` es otro spec.
- **Sí:** alergias → `allergy_tags text[]` con catálogo corto traducible; notas → `medical_notes`. Fiel al schema; badge "MANÍ" se deriva del primer tag.
- **Sí:** editables: nombre, fecha de nacimiento, sala, alergias, notas. `enrolled_at`, `photo_consent` y `status` se fijan al alta y no se editan.
- **Sí:** tipos `Kid` viven ahora en `lib/kids.ts`. Solo `lib/kids.ts` importaba `data/mock/kids.ts`, y `Kid` ya es un view model derivado, no un tipo de dominio crudo.
- **Sí:** `kids-shell` deja de ser `"use client"`: sin localStorage que leer, la agrupación y el filtrado viven en el Server Component; el alta refresca con `router.refresh()`.
- **Sí:** paleta de avatar derivada por índice determinista del `id` (mismo `PALETTE` de 5 colores actual). La BD no guarda colores.
- **No:** política `DELETE` en `children`. El borrado lógico (`archived`) llega cuando haya UI para ello.
- **No:** fetch de niños por `ILIKE` en la query. Se trae el total de la guardería (RLS-scoped, decenas de filas) y se filtra en memoria con `matchesName`, preservando la búsqueda insensible a acentos sin código nuevo.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Los padres mock de los niños sembrados desaparecen de la card (SPEC 06 clava ids string, los nuevos son uuid) | Documentado: se re-vinculan con el modal de SPEC 06; no hay migración de padres |
| `/publicar` con sesión `parent` muestra selector vacío (RLS de `children` le da 0 filas) | Esperado: publicar es acción de staff; se anota aquí, permisos por rol son otro spec |
| `room_id` nullable → niño sin sala en el agrupado | Grupo propio "Sin sala" en `kids-shell`; el modal siempre exige sala |
| URL con id que no es uuid | `getKidById` trata el error de formato como `notFound()` |
| Dos round-trips (niños + salas) por render | Una query `join` en `lib/kids.ts` si el profiling lo justifica; sin cambio de interfaz |

## Lo que **no** está en este spec

- `parent_children` / vínculos reales de padres (SPEC 06 sigue en localStorage).
- Archivar o eliminar niños.
- Crear/renombrar salas desde la UI.
- Acceso de `parent` a `/kids`.
- Migración de los niños y padres ya guardados en el navegador.
- Posts, feed y fotos (siguen mock + localStorage).