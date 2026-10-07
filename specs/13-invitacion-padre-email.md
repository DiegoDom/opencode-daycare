# SPEC 13 — Vincular padre real: invitación en BD y email con Resend

> **Estado:** Approved **Depende de:** SPEC 00 — Arquitectura, SPEC 02 — Niños y Perfil, SPEC 05 — Agregar niño, SPEC 06 — Vincular padre, SPEC 09 — Tabla `users`, SPEC 10 — Autenticación y protección de rutas, SPEC 12 — Mantenimiento de niños y salas **Fecha:** 2026-10-06 **Objetivo:** Reemplazar el vínculo visual de SPEC 06 por uno real: crear `invitations` y `parent_children` con RLS, y que el modal de `/kids/[id]` cree la invitación en la BD y envíe el código por email con Resend desde Next.js.

## Alcance

**Incluye:**

- **Migración DDL** `supabase/migrations/<UTC>_create_invitations_parent_children.sql`: enums `invitation_status` (`pending`/`accepted`/`revoked`) y `parent_role` (`mama`/`papa`/`tutor`), tablas `invitations` y `parent_children`, índices, RLS habilitado, políticas, y la función `public.activate_invitation(uuid, uuid)` (usada por SPEC 14).
- **RLS de** `invitations`**:** `select`/`insert`/`update` solo para `role in ('staff','admin')` con `daycare_id` propio y `status='active'` (mismo predicado `exists` sobre `public.users` de SPEC 09/12). Sin política `DELETE`.
- **RLS de** `parent_children`**:** `select` para staff/admin de la guardería **y** `select` para el propio padre (`parent_id = (select auth.uid())`). Sin `insert`/`update`/`delete`: el vínculo lo escribe SPEC 14 con `service_role`.
- **Código de invitación server-side:** `lib/invite-code.ts` con `generateInviteCode()` (8 chars `A-Z0-9`, `crypto.randomInt`) y `hashInviteCode()` (`sha256`). Solo se guarda el hash; el texto plano existe únicamente en el correo y en la respuesta al modal.
- **Envío con Resend desde Next.js:** `npm install resend`, `lib/email/resend.ts` (cliente desde `RESEND_API_KEY`) y `lib/email/invitation.ts` (`renderInvitationEmail()` → `{ subject, html }`, HTML plano con la paleta cálida, el código y el enlace a `/activate-account?code=<CODE>`).
- **Server Action** `inviteParentAction` en `lib/invitations-actions.ts`: valida staff/admin activo, valida nombre/email, resuelve el niño por su `daycare_id`, hace upsert de la invitación pendiente (regenera código y `expires_at = now() + 7 días`), envía el correo y devuelve `{ code }`.
- **Modal real:** `components/link-parent-modal.tsx` deja de generar el código en el cliente; llama a la action con `useTransition`, muestra estado pendiente y, al volver `code`, lo pinta en el dashed box (fiel al mockup) con "Vence en 7 días". Errores de envío con `role="alert"`.
- **Card PADRES VINCULADOS desde la BD:** nuevo `lib/invitations.ts` con `getKidParents(childId)` que combina invitaciones pendientes (PENDIENTE) y vínculos aceptados (ACTIVA). `lib/kids.ts` deja de hardcodear `parents: []` en `getKidById` y los puebla.
- **Retiro de localStorage para padres:** `components/kid-profile-shell.tsx` pierde `STORAGE_KEY`, `PALETTE`, `initialsOf`, `handleSave` y la lectura de `opdaycare.kids.v1`; recibe `baseKid` con `parents` de la BD y tras invitar hace `router.refresh()`.
- **Seed de prueba** `supabase/seed/0003_dev_invitation.sql` (con `execute_sql`, nunca migración): una invitación pendiente del niño "Mateo Fernández" con código conocido `DEVCODE1` (hash con `extensions.digest`), para poder verificar SPEC 14 sin depender del modo test de Resend. Idempotente.
- **Verificación:** `npm run lint`, `npm run build`, chequeo manual con Playwright MCP y probes de RLS con `execute_sql` + `get_advisors`.

**Fuera de alcance (specs futuros):**

- **Activación/registro del padre:** validar el código, crear la cuenta, `app_metadata`, promover a `active` y escribir `parent_children` → SPEC 14.
- Vincular a un padre que ya tiene cuenta (solo padres nuevos).
- Editar, revocar o reenviar invitaciones desde la UI (reenviar reusa el alta, sin botón propio).
- UI del padre (ver sus hijos, feed del padre) y permisos de `parent` sobre el feed.
- Rate limiting, webhooks de Resend, plantillas gestionadas y dominio de envío verificado.
- Migración de los padres guardados en `localStorage["opdaycare.kids.v1"]`: se descartan.

## Modelo de datos

```sql
-- supabase/migrations/<UTC>_create_invitations_parent_children.sql
-- Enums con guardián `do $$` (no admiten `if not exists`).
do $$ begin
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'invitation_status' and n.nspname = 'public') then
    create type public.invitation_status as enum ('pending', 'accepted', 'revoked');
  end if;
  if not exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
                 where t.typname = 'parent_role' and n.nspname = 'public') then
    create type public.parent_role as enum ('mama', 'papa', 'tutor');
  end if;
end $$;

create table public.invitations (
  id           uuid                     primary key default gen_random_uuid(),
  daycare_id   uuid                     not null references public.daycares(id) on delete cascade,
  child_id     uuid                     not null references public.children(id) on delete cascade,
  email        text                     not null,
  full_name    text                     not null,
  relationship public.parent_role       not null,
  code_hash    text                     not null,
  status       public.invitation_status not null default 'pending',
  expires_at   timestamptz              not null,
  invited_by   uuid                     references public.users(id) on delete set null,
  accepted_at  timestamptz,
  created_at   timestamptz              not null default now(),
  updated_at   timestamptz              not null default now(),
  constraint invitations_email_not_blank     check (length(btrim(email)) > 0),
  constraint invitations_full_name_not_blank check (length(btrim(full_name)) > 0),
  constraint invitations_email_lowercase     check (email = lower(email))
);
create unique index invitations_pending_child_email_key
  on public.invitations (child_id, email) where status = 'pending';
create index invitations_daycare_id_idx on public.invitations (daycare_id);
create index invitations_child_id_idx   on public.invitations (child_id);
create index invitations_code_hash_idx  on public.invitations (code_hash);
create trigger invitations_set_updated_at
  before update on public.invitations
  for each row execute function public.set_updated_at();

create table public.parent_children (
  id           uuid               primary key default gen_random_uuid(),
  daycare_id   uuid               not null references public.daycares(id) on delete cascade,
  parent_id    uuid               not null references public.users(id) on delete cascade,
  child_id     uuid               not null references public.children(id) on delete cascade,
  relationship public.parent_role not null,
  created_at   timestamptz        not null default now(),
  constraint parent_children_parent_child_unique unique (parent_id, child_id)
);
create index parent_children_daycare_id_idx on public.parent_children (daycare_id);
create index parent_children_parent_id_idx  on public.parent_children (parent_id);
create index parent_children_child_id_idx   on public.parent_children (child_id);

alter table public.invitations     enable row level security;
alter table public.parent_children enable row level security;
```

```sql
-- Escritura atómica de la activación (la consume SPEC 14 con service_role).
create or replace function public.activate_invitation(p_user_id uuid, p_invitation_id uuid)
  returns void language plpgsql security definer set search_path = ''
as $$
declare v public.invitations;
begin
  select * into v from public.invitations
    where id = p_invitation_id and status = 'pending' and expires_at > now()
    for update;
  if not found then
    raise exception 'activate_invitation: invitación inexistente, vencida o ya usada';
  end if;

  update public.users set status = 'active' where id = p_user_id;

  insert into public.parent_children (daycare_id, parent_id, child_id, relationship)
    values (v.daycare_id, p_user_id, v.child_id, v.relationship)
    on conflict (parent_id, child_id) do nothing;

  update public.invitations
    set status = 'accepted', accepted_at = now()
    where id = p_invitation_id;
end;
$$;

-- Postgres otorga EXECUTE a PUBLIC: se revoca y se concede solo a service_role.
revoke execute on function public.activate_invitation(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.activate_invitation(uuid, uuid) to service_role;
```

```ts
// lib/kids.ts — ParentRole/ParentStatus/KidParent ya existen y no cambian de forma.
// getKidById() ahora puebla:
//   parents: KidParent[]        // pendientes (invitations) + aceptados (parent_children)
//   parentsCount: parents.length
// getKids() (listado) deja parents: [] como hoy.

// lib/invitations.ts
export async function getKidParents(childId: string): Promise<KidParent[]>;

// lib/invitations-actions.ts
export interface InviteParentDraft { childId: string; name: string; email: string; role: ParentRole; }
export interface InviteParentState { code?: string; error?: string; }
export async function inviteParentAction(draft: InviteParentDraft): Promise<InviteParentState>;

// lib/invite-code.ts
export function generateInviteCode(): string;         // 8 chars A-Z0-9
export function hashInviteCode(code: string): string; // sha256 hex
```

```ts
// lib/email/invitation.ts
export function renderInvitationEmail(input: {
  parentName: string; childName: string; daycareName: string; code: string; link: string;
}): { subject: string; html: string };
```

Variables de entorno (server-only, en `.env.example`):

- `RESEND_API_KEY` — clave de Resend, configurada en el entorno de Next.js.
- `RESEND_FROM` — default `OpenDayCare <onboarding@resend.dev>` en local; en prod, el remitente del dominio verificado.
- `APP_URL` — base del enlace de activación. **Default** `http://localhost:3000`; en prod, el dominio propio.

`APP_URL` no lleva prefijo `NEXT_PUBLIC_`: solo lo usa el correo en el servidor.

## Arquitectura / Patrones

Sigue SPEC 00 — Clean Architecture pragmática (regla de dependencia hacia adentro) y los precedentes de SPEC 12.

- El scoping por guardería y rol lo hace el RLS; `lib/invitations.ts` usa el cliente de servidor (`data/supabase/server.ts`) y las políticas del predicado `exists` sobre `public.users`.
- Las Server Actions viven en `lib/` (`lib/invitations-actions.ts`, precedente `lib/kids-actions.ts`): sin JSX ni `"use client"`, validación con `lib/kid-validation.ts` y `revalidatePath("/kids/<id>")`.
- El email es infraestructura aislada en `lib/email/`; la action es su único consumidor. El cliente no conoce Resend ni la API key.
- `components/kid-profile-shell.tsx` deja de ser la fuente de padres: recibe `baseKid` ya poblado por `getKidById` y refresca con `router.refresh()`; sin localStorage.
- La DDL va a `specs/database/15-invitaciones-parent-children.md` como fuente de verdad; esta spec de feature la referencia. Migración con `apply_migration`, seed con `execute_sql`.
- `app/` y `components/` siguen sin importar de `data/`.

**Archivos por capa:**

| Capa | Archivo | Qué aporta |
| --- | --- | --- |
| Infraestructura | `supabase/migrations/<UTC>_create_invitations_parent_children.sql` (nuevo) | DDL, RLS, `activate_invitation` |
| Infraestructura | `supabase/seed/0003_dev_invitation.sql` (nuevo) | Invitación pendiente de prueba |
| Infraestructura | `lib/email/resend.ts`, `lib/email/invitation.ts` (nuevos) | Cliente Resend + plantilla HTML |
| Aplicación | `lib/invite-code.ts` (nuevo) | Generación y hash del código |
| Aplicación | `lib/invitations.ts` (nuevo) | `getKidParents()` |
| Aplicación | `lib/invitations-actions.ts` (nuevo) | `inviteParentAction` |
| Aplicación | `lib/kids.ts` (mod) | `getKidById` puebla `parents` |
| Aplicación | `lib/kid-validation.ts` (mod) | Se retira `generateInviteCode` (ahora server-side) |
| Presentación | `components/link-parent-modal.tsx` (mod) | Llama a la action y muestra el código devuelto |
| Presentación | `components/kid-profile-shell.tsx` (mod) | Sin localStorage; `router.refresh()` |

## Plan de implementación

1. **Migración.** Escribir el DDL, los triggers, las políticas y `activate_invitation` con su `revoke`/`grant`. Aplicar con `apply_migration`; si la `version` devuelta no coincide con el prefijo, renombrar el archivo. Verify: `list_tables` muestra ambas tablas con RLS; `get_advisors('security')` sin hallazgos nuevos ni `anon_security_definer_function_executable`.
2. **Seed de prueba.** Crear `supabase/seed/0003_dev_invitation.sql` con una invitación pendiente del niño "Mateo Fernández" y `code_hash = encode(extensions.digest('DEVCODE1','sha256'),'hex')`; aplicar con `execute_sql`. Verify: 1 fila pendiente; segunda corrida no duplica.
3. **Código de invitación.** Crear `lib/invite-code.ts`; quitar `generateInviteCode` de `lib/kid-validation.ts`. Verify: `npm run build`.
4. **Email.** `npm install resend`; crear `lib/email/resend.ts` y `lib/email/invitation.ts`; sumar `RESEND_API_KEY`, `RESEND_FROM` y `APP_URL` (default `http://localhost:3000`) a `.env.example` y a la lectura de entorno. Verify: `npm run build`.
5. **Server Action.** Crear `lib/invitations-actions.ts` con `inviteParentAction` (auth staff/admin activo, validaciones, upsert de la invitación pendiente, envío con Resend, `revalidatePath`, devolver `{ code }`; error legible si el envío falla). Verify: `npm run build`.
6. **Consultas y card.** Crear `lib/invitations.ts` (`getKidParents`); en `lib/kids.ts`, `getKidById` puebla `parents`/`parentsCount`. Verify: `npm run build`; la card muestra la invitación del seed como PENDIENTE.
7. **Modal y shell.** En `components/link-parent-modal.tsx`, reemplazar la generación local por la llamada a la action (`useTransition`, estado pendiente, mostrar `code` al volver, error con `role="alert"`); en `kid-profile-shell.tsx`, quitar localStorage/`PALETTE`/`handleSave` y refrescar con `router.refresh()`. Verify: `npm run build`.
8. **Limpieza.** `grep` sin referencias a `opdaycare.kids.v1` ni a `generateInviteCode` en `app/`, `components/`, `lib/`. Verify: `grep` limpio.
9. **Chequeo final.** `npm run lint && npm run build`, Playwright (invitar desde `/kids/[id]`, ver PENDIENTE, reenviar regenera código, límite de 3) y probes RLS: `anon` ve 0 filas de `invitations`; un `parent` ve 0 invitaciones y solo sus filas de `parent_children`.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` pasan sin errores ni warnings.

- [ ] `invitations` y `parent_children` existen con RLS y `get_advisors('security')` no reporta hallazgos nuevos por este spec.

- [ ] El seed deja una invitación pendiente con `code_hash` del código `DEVCODE1` y una segunda corrida no duplica.

- [ ] Invitar desde `/kids/[id]` inserta/actualiza una fila `pending` con `daycare_id` de la sesión, `expires_at` a 7 días y `code_hash` no vacío.

- [ ] El correo se envía con Resend desde la Server Action de Next.js y contiene el código de 8 caracteres y el enlace a `/activate-account?code=…`.

- [ ] En local el enlace del correo usa `http://localhost:3000`; con `APP_URL` seteado a otro origen, el enlace usa ese origen sin tocar código.

- [ ] El modal muestra el código devuelto por el servidor y "Vence en 7 días"; el CTA queda deshabilitado durante el envío y no se dispara dos veces.

- [ ] Un error de Resend muestra un mensaje con `role="alert"` y la invitación queda `pending` (reintentar regenera el código).

- [ ] La card PADRES VINCULADOS muestra la invitación pendiente como PENDIENTE (`#F7E7A6/#9A7B1E`) y un vínculo aceptado como ACTIVA, sin `localStorage`.

- [ ] Con 3 padres (pendientes + activos) el botón "Vincular otro padre" queda deshabilitado con "Máximo 3 padres vinculados".

- [ ] Un `select` sobre `invitations` con rol `anon` o `parent` devuelve 0 filas; con `parent_children` el `parent` ve solo sus filas.

- [ ] No queda ninguna referencia a `opdaycare.kids.v1` en `app/`, `components/` ni `lib/` (`grep` limpio).

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (`grep` limpio).

## Decisiones

- **Sí:** DDL de ambas tablas en SPEC 13 (aunque `parent_children` se escriba en SPEC 14). Así SPEC 13 ya puede mostrar la card (pendientes + activos) y SPEC 14 es casi todo aplicación.
- **Sí:** `activate_invitation` en la migración de SPEC 13. Da atomicidad (promover + vincular + aceptar en una transacción) y evita estados a medias en SPEC 14.
- **Sí:** `code_hash` con `sha256` y solo 8 chars aleatorios de alta entropía (36⁸) con expiración de 7 días. No es una contraseña reutilizable; el hash evita que un dump de la BD revele códigos vivos.
- **Sí:** `parent_role` como enum (`mama`/`papa`/`tutor`) traducido a la UI. Persistir el parentesco es dato del producto, no cosmético.
- **Sí:** índice único parcial `(child_id, email) where status='pending'` + upsert (update-then-insert) en la action. Una sola invitación viva por niño y email; reinvitar regenera código y extiende vigencia.
- **Sí:** el email se envía desde la Server Action de Next.js con `resend` y `RESEND_API_KEY` en el entorno del servidor. No hay CLI ni Edge Functions montadas, y la clave nunca toca el cliente.
- **Sí:** la base del enlace se lee de `APP_URL` con default `http://localhost:3000`; el dominio propio de prod es un valor de entorno, no un cambio de código.
- **Sí:** `RESEND_FROM` configurable; `onboarding@resend.dev` en local, remitente del dominio verificado en prod.
- **Sí:** HTML plano en `lib/email/`. Cero dependencias nuevas más allá de `resend`.
- **Sí:** el servidor genera y el modal muestra el código. Coincide con el mockup y permite al staff leerlo en pantalla.
- **Sí:** la card migra a la BD y se retira `localStorage` para padres. Una sola fuente; SPEC 06 queda superseded en su persistencia.
- **Sí:** el vínculo real (`parent_children`) lo escribe solo `service_role`; sin políticas de escritura para staff. No hay UI para vincular usuarios existentes, así que una política de insert sería código muerto y superficie extra.
- **No:** revocar/editar invitaciones desde la UI. Reenviar cubre el caso real; revocar llega cuando haya necesidad.
- **No:** rate limiting ni webhooks. Endurecimiento posterior al MVP.
- **No:** migrar los padres del `localStorage` previo. Eran datos de demo sin identidad real.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El dominio real del enlace aún no existe (local) | `APP_URL` default `http://localhost:3000`; el swap a dominio propio es solo una variable de entorno al desplegar |
| En local el correo puede no entregarse a terceros (modo test de Resend) | Documentado como limitación de dev; el seed `DEVCODE1` permite verificar SPEC 14 sin depender del correo |
| El correo falla después de insertar la invitación | La fila queda `pending`; reintentar regenera código y extiende vigencia; el error se muestra con `role="alert"` |
| Carrera en el upsert de la invitación pendiente | El índice único parcial es la red; el peor caso es un error de conflicto que el reintento resuelve |
| `getKidById` suma consultas (invitaciones + vínculos) | Dos queries acotadas por RLS child-scoped; si el profiling lo pide, un solo query con joins sin cambiar la interfaz |
| El límite de 3 ahora cuenta pendientes + activos | Es el comportamiento mostrado; se documenta en la card y en esta spec |
| La plantilla HTML puede caer en spam sin dominio de envío verificado | `RESEND_FROM` por env; el dominio verificado es del deploy, no de este spec |

## Lo que **no** está en este spec

- Activación/registro del padre, validación del código, `app_metadata`, promoción a `active` y escritura de `parent_children` (SPEC 14).
- Vincular a un padre con cuenta existente.
- Editar, revocar o reenviar invitaciones desde la UI.
- UI del padre y permisos de `parent` sobre el feed.
- Rate limiting, webhooks de Resend y plantillas gestionadas.
- Migración de los padres que hoy viven en `localStorage`.

Cada uno de esos, si llega, va en su propio spec.