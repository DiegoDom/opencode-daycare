# SPEC 14 — Activación y registro de la cuenta del padre

> **Estado:** Approved **Depende de:** SPEC 00 — Arquitectura, SPEC 04 — Pantalla activar cuenta, SPEC 09 — Tabla `users`, SPEC 10 — Autenticación y protección de rutas, SPEC 13 — Invitación en BD y email con Resend **Fecha:** 2026-10-06 **Objetivo:** Hacer funcional `/activate-account`: el padre confirma el código de la invitación, crea su cuenta (Supabase Auth + fila en `public.users`), se vincula al niño (`parent_children`) y queda logueado. El vínculo inicia en SPEC 13; esta spec lo resuelve.

## Alcance

**Incluye:**

- `lib/activate.ts` — consultas para los pasos 1 y 2 del flux:
  - `lookupInvitationByCodePrefix(code, email)`: como la BD solo guarda el hash, se trae por prefijo de 6 del hash de `sha256(code)` y se confirma con `timingSafeEqual` sobre el hash completo (`constraint_invitations_code_hash_idx`).
  - `getActivationInvitation(email)`: invitación `pending` más reciente para el email (para el estado "seleccioná tu cuenta").
- **Envío del correo de verificación** (`lib/activate-actions.ts` → `lib/email/invitation.ts`):
  - `resendVerificationEmail({ email })` (paso 1): reenvía el email con `code` y `link` para ese email. Mayor seguridad que la confirmación por link.
  - `sendActivationEmail` (paso 2): mismo correo con los `interface` del padre.
- **Server Actions en** `lib/activate-actions.ts`:
  - `verifyActivationEmail(state, formData)` (paso 1): valida el email, reenvía el correo de verificación y devuelve `{ ok: true, email }`.
  - `createParentAccountAction` (paso 2): valida los `interface` del padre, la contraseña y el código, crea la cuenta con `admin.createUser({ email_confirm: true, app_metadata, user_metadata })`, promueve a `active` y vincula con `parent_children` de forma atómica, y **loguea** al padre (`signInWithPassword`) para redirigir a `/`.
- **Formulario funcional:** `app/(auth)/activate-account/page.tsx` usa `useFormState` para las dos pantallas del mockup; `components/pages/activate-account.tsx` recibe `firstStep: boolean` y un `PrefilledValues` por searchParams; `components/activate-account-form.tsx` se convierte en solo presentacional (extrae `activateInputs` y `activateLabels` a `lib/activation-strings.ts`).
- **Supabase Admin API:** nuevo `data/supabase/admin.ts` con `createClient()` server-only (secret key `SUPABASE_SECRET_KEY`, variable por env validado en `config.ts`). `service_role` omite RLS y es lo único autorizado a escribir `parent_children`. **No** usa el patrón "supabase=true" con `an`/`anon`, ni claves de acceso innecesarias.
- **Prefill:** `searchParams.code` → campo "Código de invitación"; `searchParams.email` → campo "Email"; si ambos llegan, se salta directo al paso 2. El código se muestra en dos chips con undo.
- **Retiro de código muerto:** `lib/register.ts`, `lib/state/register-store.ts` (y la UI de tarjeta del mockup que solo añade "E-mail" y "Contraseña") si son solo vestigios de SPEC 03/04; si no, se marcan para el spec de registro de guardianes.
- **Contraseña y RLS/CLI:** Reglas de contraseña en `lib/activate.ts` (`isPasswordValidAndConfirmed`). No se usa la CLI de Supabase para esto.
- **Nueva migración (opcional, decidir en fase 1):** `migration_14_activate` — si `activate_activation` no es viable por no tener `community`/`invitation`, ver `APPENDICES` para reescribir `activate_invitation` a discutir en fase 1. Su DDL pertenece a SPEC 13 (así siguió en fase 2), así que **sin cambios**: `activate_invitation` ya vive en la migración de SPEC 13.

**Fuera de alcance (specs futuros):**

- **Vincular a un padre que ya tiene cuenta:** el `lookup` solo considera invitaciones; si el email ya tiene cuenta se muestra "este email ya está registrado — iniciá sesión" con link a la pantalla de login.
- **Cambiar o recuperar la contraseña** (flux de "olvidé mi contraseña").
- **Registro independiente de guardianes** (registro sin invitación, en `/register`).
- **Editar perfil del padre**, ver sus hijos en un dashboard propio, y permisos de `parent` sobre datos del feed.
- **Rate limiting** de las Server Actions.

## Modelo de datos

Dependencias de estado y funciones:

```ts
// data/supabase/admin.ts — SERVIDOR de produccción exclusivo.
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl, getSupabaseSecretKey } from "./config";
export function createClient(): SupabaseClient { return createSupabaseClient(getSupabaseUrl(), getSupabaseSecretKey(), { auth: { autoRefreshToken: false, persistSession: false } }); }

// lib/activate.ts
export interface PrefilledValues { code?: string; email?: string; }
export type ActivationView = "enter-email" | "create-account";
export interface ParentProfile { name: string; email: string; password: string; }
export function isPasswordValidAndConfirmed(password: string, confirmation: string): boolean;
export function assertParentProfile(profile: unknown): asserts profile is ParentProfile;
export async function lookupInvitationByCodePrefix(code: string, email: string): Promise<InvitationScan[]>;
export async function getActivationInvitation(email: string): Promise<InvitationScan | null>;
export interface InvitationScan { id: string; childName: string; daycareName: string; codeHash: string; relationship: string; }

// lib/activate-actions.ts
export type VerifyEmialActionState = { ok: boolean; error?: string; email?: string };
export type CreateParentAccountState = { error?: string };
export async function verifyActivationEmail(state: VerifyEmialActionState, formData: FormData): Promise<VerifyEmialActionState>;
export async function createParentAccountAction(state: CreateParentAccountState, formData: FormData): Promise<CreateParentAccountState>;
```

Patrón de creación de cuenta y activación:

```ts
// createParentAccountAction — paso 2
const admin = createClient();
const { data: user, error: signUpError } = await admin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { full_name: name },
  app_metadata: { role: "parent", status: "pending", daycare_id },
});
if (signUpError) throw signUpError;

const { error: activateError } = await admin.rpc("activate_invitation", {
  p_user_id: user.id,
  p_invitation_id: invitation.id,
});
if (activateError) throw activateError;

// login del padre (cliente de servidor normal, browser client):
const browser = createClient();
signInWithPassword({ email, password });
redirect("/");
```

**Reglas de App Metadata (reforzadas):**

| Campo | Valor | Fuente | ¿Editable por el usuario? |
| --- | --- | --- | --- |
| `role` | `"parent"` | servidor | No |
| `status` | `"pending"` → `"active"` | servidor (SPEC 12 / 13) | No |
| `daycare_id` | id de la guardería | servidor | No |
| `parent_children` | `[{ child_id, relationship }]` | servidor | No |
| `full_name` | nombre del padre | de `user_metadata` | Sí (usuario) |

Fase 1 pregunta: ¿autorizamos a los usuarios a auto-editar `app_metadata`? Si no — decisión segura — se añade la política a `app_metadata` para denegar:

```sql
-- paras la edición desde el navegador: el rol/status del usuario no es decidido por él.
revoke update on profile_data from ...; -- o, más simple: NUNCA escribir app_metadata desde el cliente.
```

**Stored Procedure (de la migración de SPEC 13):** `activate_invitation(uuid, uuid)` — promueve al usuario, escribe `parent_children` y acepta la invitación, todo atómico.

## Arquitectura / Patrones

Sigue SPEC 00 y los precedentes recientes:

- La creación de cuenta usa **Supabase Auth Admin API** (server-only) ya disponible en `@supabase/supabase-js`. `daycare_id`, `role` y `status` se escriben únicamente en `app_metadata` por el servidor.
- **Auto-login** con `signInWithPassword` inmediatamente después de activar, con `data/supabase/backend.ts` pasando la sesión al navegador (patrón de `proxy.ts`); se prefiere sobre una ruta separada con token firmado.
- `verifyActivationEmail` no depende de la accesibilidad del enlace (mayor seguridad). Pasos: (1) el padre pide el email de verificación; (2) recibe el código + link; (3) crea la cuenta con el código.
- **FILO (función de 1 argu.)** no aplica aquí — `admin.createUser` no usa `createClient` con RLS; la atomicidad la da la transacción de `activate_invitation`.
- `app/` y `components/` siguen sin importar de `data/`.
- Las Server Actions viven en `lib/`.
- **Sin vuelta atrás para REACT 19** `useActionState` (reemplaza `useFormState`), según las guías de React/Supabase.

**Archivos por capa:**

| Capa | Archivo | Qué aporta |
| --- | --- | --- |
| Infraestructura | `data/supabase/admin.ts` (nuevo) | Cliente Admin server-only |
| Infraestructura | `data/supabase/config.ts` (mod) | Lee `SUPABASE_SECRET_KEY` |
| Aplicación | `lib/activate.ts` (nuevo) | Lógica de activación + prefetch de invitación |
| Aplicación | `lib/activate-actions.ts` (nuevo) | Server Actions de pasos 1 y 2 |
| Aplicación | `lib/activation-strings.ts` (nuevo) | Strings de la UI extraídos del formulario |
| Aplicación | `lib/email/invitation.ts` (mod) | Reusa para el correo de verificación |
| Presentación | `app/(auth)/activate-account/page.tsx` (mod) | RecordStream con `useFormState` + prefilled |
| Presentación | `components/pages/activate-account.tsx` (nuevo) | Orquesta pasos 1/2 |
| Presentación | `components/activate-account-form.tsx` (mod) | Solo presentacional |
| Presentación | `app/(auth)/login/page.tsx` (mod) | Link "no recibí el correo" al paso 1 |
| Presentación | `app/(auth)/activate-account/success/page.tsx` (nuevo) | Éxito → CTA "Ir a mi cuenta" |

## Plan de implementación

Migración: en SPEC 13 ya está la DDL (esta fase no la reescribe).

1. **Envio de email de verificación (paso 1).** Implementar `verifyActivationEmail` (valida email, `resendVerificationEmail` reenvía correo con `interface` del padre y link). Verify: `npm run typecheck` (build), el correo llega a la bandeja.
2. **Consultas de invitación.** `lib/activate.ts`: `lookupInvitationByCodePrefix` y `getActivationInvitation` con `timingSafeEqual` sobre el hash. Verify: probe con el seed `DEVCODE1` de SPEC 13 devuelve la invitación.
3. **Client Admin.** `data/supabase/admin.ts` + `SUPABASE_SECRET_KEY` en `config.ts`/`.env.example`. Verify: `createUser` + `rpc("activate_invitation")` crea el usuario y lo vincula.
4. **Accion paso 2.** `createParentAccountAction`: valida perfil/contraseña/código, `admin.createUser`, `activate_invitation`, auto-login, `redirect("/")`. Verify: cuenta creada, rol `parent` activo, vínculo en `parent_children`, sesión iniciada.
5. **UI de** `/activate-account`**.** `useFormState` + dos pantallas, prefilled por searchParams, chips de código con undo. Verify: `npm run build`; con el link del correo (código+email) salta al paso 2.
6. **Conexiones de login.** Link "no recibí el correo" → paso 1 para el email predicho. Verify: navegación.
7. **Retiro de cierre.** `lib/register.ts` / `register-store.ts` (si son vestigios) se marcan/retiran; grep limpio. Verify: `grep` sin referencias.
8. **Verificación final.** `npm run lint && npm run build`, Playwright (flux completo con `DEVCODE1` y con código real del correo, duplicado, código inválido, vencido, ya-usado) y probes RLS del lado seguidor.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` pasan sin errores ni warnings.

- [ ] Con `DEVCODE1` del seed de SPEC 13: crear cuenta, entrar en "Mi cuenta" y ver el niño vinculado.

- [ ] El correo de verificación (paso 1) llega con código y link; el link pre-filled salta al paso 2.

- [ ] `admin.createUser` escribe `role="parent"`, `status="active"` y `daycare_id` en `app_metadata`, y la fila existe en `public.users`.

- [ ] Después de activar, la sesión queda iniciada y `/` muestra la app sin pantalla de login.

- [ ] Reusar el mismo código devuelve un error claro ("invitación ya utilizada o vencida") y no crea un segundo vínculo.

- [ ] Un email con cuenta ya existente muestra "este email ya está registrado — iniciá sesión" con CTA a `/login`.

- [ ] Un código inválido o vencido muestra error con `role="alert"` y vuelve al paso de ingreso de código.

- [ ] La contraseña cumple las reglas compartidas; dos contraseñas distintas muestran error de confirmación.

- [ ] Con RLS: `anon` devuelve 0 filas de `parent_children`; el padre activado ve solo sus filas; un staff de otra guardería no ve las suyas.

- [ ] No queda ninguna referencia a `opdaycare.kids.v1` ni a `localStorage` de padres en `app/`/`components/`/`lib/` (`grep` limpio).

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (`grep` limpio).

## Decisiones

- **Sí:** usar `APP_URL` server-only desde el lado de la infra (SPEC 13); default `http://localhost:3000` y la app funciona en local sin configuración.
- **Sí:** configurar la API key de Resend en el entorno de Next.js (`process.env.RESEND_API_KEY`), nunca en el cliente.
- **Sí:** el flujo de activación es 2 pasos (email → código) en `/activate-account`.
- **Sí:** auto-login (`signInWithPassword`) tras activar, con `data/supabase/backend.ts` para pasar la sesión al navegador; `redirect("/")`.
- **Sí:** la UI usa `useActionState` (React 19) para los pasos 1 y 2 en vez de gestión local de formularios — alineado con el mockup y la plataforma actual.
- **Sí:** `verifyActivationEmail` reenvía el correo de verificación (independiente de la accesibilidad del enlace en local).
- **Sí:** la atomicidad la garantiza `activate_invitation` (SPEC 13): promover + vincular + aceptar en una transacción.
- **Sí:** el código se verifica por hash con `timingSafeEqual` para evitar ataques de timing; lookup por prefijo de 6 chars del hash para permitir el grep por índice.
- **Sí:** autorizar a los usuarios a editar `app_metadata` es solo el control de acceso de RLS; el rol del usuario nunca se decide desde el cliente.
- **Sí:** no modificar `handle_new_user` técnicamente — este spec no altera la lógica de registro. (La cuenta la crea el Admin API con `email_confirm: true`.)
- **Sí:** se mantienen los `interface` del mockup en `lib/` (extraídos con `lib/activation-strings.ts`) para no duplicar strings en el formulario y el correo.
- **No:** políticas de escritura en `parent_children` (SPEC 13 ya lo fijó): solo `service_role` escribe.
- **No:** vincular a un email con cuenta existente — se muestra error con CTA a login.
- **No:** rate limiting de los pasos 1 y 2 en este spec (endurecimiento futuro).

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El email no se entrega en local (Resend test mode) | El seed `DEVCODE1` de SPEC 13 válida el flux sin correo real |
| Fuga de seguridad: secret key en el cliente | Solo `data/supabase/admin.ts` (server) la usa; `NEXT_PUBLIC_*` nunca la expone |
| `admin.createUser` con `email_confirm: true` dispara emails no deseados | Cambiar a `email_confirm: false` y enviar el correo por `resendVerificationEmail` en su lugar; el enlace de activación no depende del dominio |
| Carrera en el upsert al crear el vínculo | Guardado preventivo de `on conflict (parent_id, child_id) do nothing` en `activate_invitation`; código inválido/vencido/ya-usado son errores con mensaje claro |
| Un staff de otra guardería inserta un vínculo ajeno | No hay política de escritura de `parent_children` para staff; solo `service_role` (SPEC 13) |
| Reusar un código activado crea un vínculo duplicado | `activate_invitation` valida `status='pending'` y el unique `(parent_id, child_id)` lo bloquea |
| UI sin prefilled salta pasos sin código | El paso 2 valida el código en la action con `timingSafeEqual`; error con `role="alert"` |
| Código en la URL (searchParams) queda en historial/logs | Es el mal menor frente a UX de mockup; el hash nunca viaja nunca en la URL, solo el texto plano, y es de un uso |

## Apéndice — Verificación del código

Nunca comparar `code === submitted`. Igualar en tiempo constante:

```ts
// lib/invite-code.ts (SPEC 13) — helper usado aquí
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;

// activación
const candidateHash = hash(sha256, submittedCode);          // hash del candidato
const storedHash = await getCodeHashForApplication(prefix(candidate, 6)); // por prefijo indexado
if (!storedHash || !timingSafeEqual(candidateHash, Uint8Array.from(storedHash))) throw ActivationError("Código inválido o vencido");
```

## Lo que **no** está en este spec

- Vincular a un padre con cuenta ya existente (muestra "ya te registraste — iniciá sesión").
- Cambio/recuperación de contraseña.
- Registro independiente de guardianes (`/register`, sin invitación).
- Dashboard del padre, edición de perfil y permisos de `parent` sobre el feed.
- Rate limiting de las Server Actions.
- Política de escritura de `parent_children` y su DDL (ya en SPEC 13).