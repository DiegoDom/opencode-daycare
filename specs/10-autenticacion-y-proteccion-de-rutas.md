# SPEC 10 — Autenticación por email y password + protección de rutas

> **Estado:** Approved **Depende de:** SPEC 00 — Arquitectura, SPEC 01 — Feed Home, SPEC 03 — Pantalla Login, SPEC 04 — Pantalla Activar Cuenta, SPEC 09 — Tabla `users`, SPEC 11 — Seed de usuario `pending`**Fecha:** 2026-10-05 **Objetivo:** Implementar el login por email y password contra Supabase Auth con sesión en cookies vía `@supabase/ssr`, proteger toda ruta salvo `/login` y `/activate-account` con un gate rápido en `proxy.ts` más un layout autoritativo que valida el perfil en `public.users`, y mostrar el usuario real en el sidebar y en el encabezado del feed en lugar del `currentUser` mock.

## Alcance

**Incluye:**

- **Login funcional.** Server Action `loginAction` (`supabase.auth.signInWithPassword` contra el cliente de servidor) llamada desde `components/login-form.tsx`, que pasa a ser Client Component con `useActionState` y un `<form action>` real. Deja de ser el botón inerte de SPEC 03.
- **Logout funcional.** Server Action `logoutAction` (`signOut()` + `redirect("/login")`) conectada al `onAction` del `UserFooter` del sidebar, tanto en desktop como en el drawer móvil.
- **Gate rápido en el proxy.** `data/supabase/proxy.ts` reutiliza el `getClaims()` que ya corre hoy: si no hay claim verificado y la ruta no es pública, redirige a `/login?next=<pathname+search>` copiando sobre la respuesta de redirect las cookies refrescadas y los headers `cache-control`/`expires`/`pragma` de `supabaseResponse`.
- **Gate autoritativo en un layout.** Nuevo route group `app/(app)/` con `layout.tsx` que resuelve el perfil en `public.users`: sin sesión o sin perfil → `/login`; perfil con `status <> 'active'` → `/login?error=pending`. `/`, `/kids`, `/kids/[id]` y `/publicar` se mueven dentro del grupo (misma convención de route group que `(auth)` de SPEC 04).
- **Rutas públicas.** Solo `/login` y `/activate-account`. Con sesión y perfil `active`, entrar a cualquiera de las dos redirige a `/` (o al destino de `?next=` si viene).
- **Aviso de cuenta no activada.** Sin ruta nueva: `/login?error=pending` muestra un aviso inline arriba del formulario. Una sesión válida **sin** fila en `public.users` produce el mismo aviso.
- **Usuario real en la UI.** `lib/auth.ts` deriva `initials` de `full_name`, traduce el enum de rol (`staff` → "Maestra", `parent` → "Familia", `admin` → "Directora") y compone el label `"{traducción} · {guardería sin el prefijo Guardería}"`. `lib/feed.ts` deriva `greeting` ("Buenas, {primer nombre}") y `roomLabel` ("GUARDERÍA · {GUARDERÍA SIN EL PREFIJO}"). El `currentUser` mock ("Caro Giménez" / "C" / "Maestra · Soles") desaparece de `data/mock/feed.ts`.
- **Login sin credencial hardcodeada.** Se saca el `defaultValue="caro@opendaycare.com"` (ese usuario no existe en la BD) y queda el placeholder del mockup.
- **Errores de login.** Mensaje neutro inline ("Email o contraseña incorrectos") que no revela si el email existe, más errores por campo para email/password vacíos y botón con estado pendiente durante el submit.
- `?next=` **validado.** Solo se acepta un path relativo que empieza con `/` y no con `//`; cualquier otro valor (URL absoluta, protocolo, `//host`) se descarta y el destino es `/`.
- **Salida del prebuild.** Se quita `generateStaticParams()` de `app/(app)/kids/[id]/page.tsx`: el layout lee cookies, con lo cual todo el segmento pasa a render dinámico.
- **Cero DDL.** No hay migración, ni columnas nuevas, ni políticas nuevas. Se reutilizan `public.users` (política `users_select_own`), `public.daycares` (política `daycares_select_own`) y el trigger `on_auth_user_created` tal como están.

**Fuera de alcance (specs futuros):**

- **Signup público.** Imposible con el schema actual: `handle_new_user` lanza excepción si falta `raw_app_meta_data.daycare_id`, y `app_metadata` lo escribe el servidor, nunca el cliente. El alta de cuentas es por invitación y necesita una Edge Function o `service_role`.
- `/activate-account` **funcional** (SPEC 04 sigue siendo pantalla): validar el código de invitación, escribir `app_metadata.daycare_id` y promover el rol.
- **Recuperación de contraseña** (`resetPasswordForEmail` + pantalla de reset), verificación de email, magic link, OAuth y passkeys.
- **Permisos por rol.** Nada de lógica de "qué ve un `parent` vs. un `staff`"; el feed y los niños siguen siendo mock para cualquiera que esté logueado.
- **Migrar niños y publicaciones a la BD.** Este spec mueve el *usuario* del mock a Supabase; el resto de los datos sigue en `data/mock/` + localStorage.
- **Sesión multi-guardería** (cambiar de guardería en caliente), "recordarme", y cualquier ajuste de cuenta.
- **Tests automatizados.** El repo no tiene runner; la verificación es `npm run lint`, `npm run build` y chequeo manual con Playwright MCP.
- **Onboarding de la cuenta pendiente**: el aviso es texto estático, sin reintento ni contacting a la guardería.

## Modelo de datos

No hay DDL ni migraciones. Este spec introduce tipos de aplicación y cambia la forma de un mock.

```ts
// lib/auth.ts — espejo de los enums de SPEC 09. La UI nunca ve el valor crudo.
export type UserRole = "staff" | "parent" | "admin";
export type UserStatus = "pending" | "active";

export interface SessionUser {
  id: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  daycareId: string;
  daycareName: string; // "" si el embed de daycares no resuelve (ver Riesgos)
}

// lib/auth.ts — formatters puros, sin dependencias
export const ROLE_LABELS: Record<UserRole, string> = {
  staff: "Maestra",
  parent: "Familia",
  admin: "Directora",
};
export function initialsFrom(fullName: string): string;    // "Staff Soles" → "SS"
export function firstName(fullName: string): string;       // "Staff Soles" → "Staff"
export function shortDaycareName(daycareName: string): string; // "Guardería Sala Soles" → "SALA SOLES"

export type SignInResult =
  | { ok: true }
  | { ok: false; reason: "invalid-credentials" | "unexpected" };

// lib/auth-actions.ts — contrato de la Server Action
export interface LoginState {
  fieldErrors?: { email?: string; password?: string };
  error?: string; // ya localizado, listo para renderizar
}
```

```ts
// data/mock/feed.ts — FeedData pierde los 3 campos que ahora se derivan
export interface FeedData {
  // roomLabel, greeting y currentUser salen del mock: se calculan en lib/feed.ts
  childrenLine: string;
  composePlaceholder: string;
  posts: Post[];
}
```

```sql
-- Seeds de prueba (SPEC 11 los documenta). Solo se leen desde la app:
-- select id, full_name, role, status, daycare_id, daycares(name) from public.users where id = <claim.sub>
--   staff@solas.test      / solas-dev-password     → staff  / active / Guardería Sala Soles
--   admin@solas.test      / solas-dev-password     → admin  / active / Guardería Sala Soles
--   parent@estrellas.test / estrellas-dev-password → parent / active / Guardería Estrellas
--   pending@solas.test    / solas-dev-password     → parent / pending / Guardería Sala Soles
```

## Arquitectura / Patrones

Sigue los principios de caso **SPEC 00 — Arquitectura** (Clean Architecture pragmática, dependencia siempre hacia adentro).

**Dos gates, cada uno con lo que sabe hacer.** El proxy conoce el path de la request y verifica el JWT sin tocar la BD: es el gate barato que evita hasta el render. El layout del grupo es la autoridad: consulta `public.users` porque el RLS de `daycares` exige `status = 'active'` y solo un perfil de la BD puede distinguir "sesión válida" de "usuario que puede usar la app". Un usuario no activo pasa el proxy (tiene claim) y muere en el layout.

`lib/` **sin framework.** Los casos de uso viven en `lib/auth.ts` sin `"use client"`, sin JSX y sin `redirect()`: devuelven datos o un resultado discriminado, y las decisiones de navegación las toman `app/`. Las Server Actions van en `lib/auth-actions.ts` con `"use server"`, que sigue cumpliendo el invariante de SPEC 00 (compatible con Server Components) y le permite importarse tanto desde `app/` como desde un Client Component del sidebar.

**Archivos por capa:**

| Capa | Archivo | Qué aporta |
| --- | --- | --- |
| Dominio | `data/mock/feed.ts` (mod) | `FeedData` sin los 3 campos derivados |
| Aplicación | `lib/auth.ts` (nuevo) | `getCurrentUser()`, `signIn()`, `signOut()`, formatters, `SessionUser` |
| Aplicación | `lib/auth-actions.ts` (nuevo) | `"use server"`: `loginAction`, `logoutAction` |
| Aplicación | `lib/feed.ts` (mod) | `getFeedData(user)` deriva `greeting`, `roomLabel`, `currentUser` |
| Infraestructura | `data/supabase/server.ts` | Sin cambios: el ejemplo canónico ignora el 2º arg de `setAll` |
| Infraestructura | `data/supabase/proxy.ts` (mod) | Gate rápido + redirect con cookies y headers copiados |
| Infraestructura | `supabase/seed/0001_staff_users.sql` (mod) | Cuarto usuario `pending` (documentado en SPEC 11) |
| Presentación | `app/(app)/layout.tsx` (nuevo) | Gate autoritativo |
| Presentación | `app/(app)/page.tsx`, `app/(app)/kids/**`, `app/(app)/publicar/page.tsx` (nuevos por movimiento) | Rutas del producto dentro del grupo protegido |
| Presentación | `app/(auth)/login/page.tsx` (mod) | `await searchParams`, pasa `next`/`notice`, redirect si hay sesión activa |
| Presentación | `components/login-form.tsx` (mod) | `"use client"` + `useActionState` + `<form action>` + error inline |
| Presentación | `components/sidebar/index.tsx` (mod) | Conecta el logout en desktop y drawer |

`proxy.ts` (raíz) no cambia: sigue siendo la entrada de Next.js que solo delega a `updateSession()`, y su matcher ya excluye los estáticos. Ningún archivo en `app/` ni `components/` importa desde `data/`; el único que llega a Supabase es `lib/auth.ts`, igual que `lib/feed.ts` llega al mock.

## Plan de implementación

 1. **Formatters de identidad.** Crear `lib/auth.ts` con `ROLE_LABELS`, `initialsFrom()`, `firstName()`, `shortDaycareName()` y los tipos `UserRole`/`UserStatus`/`SessionUser`, sin tocar Supabase todavía. Verify: `npm run build`.
 2. **Casos de uso contra Supabase.** En `lib/auth.ts`, `getCurrentUser()` (envuelto en `cache()` de React), `signIn()` y `signOut()` sobre `createClient()` de `data/supabase/server.ts`. `getCurrentUser()` lee `getClaims()`, y con el `sub` hace `select("id, full_name, role, status, daycare_id, daycares(name)")` sobre `public.users`; devuelve `null` si no hay claim, si el perfil no existe, o si el select falla, y cae a `daycareName: ""` cuando el embed viene `null`. Verify: `npm run build`.
 3. **Server Actions.** Crear `lib/auth-actions.ts`: `loginAction(prev, formData)` valida email y password no vacíos, devuelve `fieldErrors` o el mensaje neutro mapeado desde el error de GoTrue, y en el éxito redirige al `next` validado. `logoutAction()` llama `signOut()` y redirige a `/login`. En ambos, `redirect()` va **fuera** del `try/catch` que envuelve las llamadas a Supabase. Verify: `npm run build`.
 4. **Login funcional.** `components/login-form.tsx` pasa a `"use client"` con `useActionState(loginAction, {})` y `<form action={formAction}>`; saca el `defaultValue` del email, mantiene el placeholder y el resto de la fidelidad visual del mockup; muestra el error inline con `role="alert"` y el botón en estado pendiente con `aria-busy`. `app/(auth)/login/page.tsx` lee `await searchParams`, valida `next` y lo pasa como input hidden. Verify: `npm run build`; login con `staff@solas.test` deja cookie de sesión y devuelve `success`.
 5. **Logout.** En `components/sidebar/index.tsx`, el `onAction` del `UserFooter` pasa a ser un `useTransition` que llama `logoutAction` y sigue cerrando el drawer móvil. Verify: `npm run build`; cerrar sesión devuelve a `/login` y `getCurrentUser()` queda en `null`.
 6. **Grupo** `(app)`**.** Mover `app/page.tsx` → `app/(app)/page.tsx`, `app/kids/` → `app/(app)/kids/`, `app/publicar/` → `app/(app)/publicar/`, y crear `app/(app)/layout.tsx` con el gate: `null` → `/login`; `status !== "active"` → `/login?error=pending`. Quitar `generateStaticParams()` de `app/(app)/kids/[id]/page.tsx`. Verificar que los parenthesis no entran en el path. Verify: `npm run build`; las 4 rutas responden igual que antes del movimiento.
 7. **Gate rápido en el proxy.** En `data/supabase/proxy.ts`, guardar el resultado de `getClaims()`, consultar una lista explícita de rutas públicas (`/login`, `/activate-account`) y, si no hay claim y la ruta no es pública, construir el `NextResponse.redirect()` con `?next=` y copiarle `supabaseResponse.cookies.getAll()` más `cache-control`, `expires` y `pragma`. `proxy.ts` no se toca. Verify: `npm run build`; deslogueado, `/kids/5` aterriza en `/login?next=%2Fkids%2F5`.
 8. **Login fuera de alcance con sesión activa.** `app/(auth)/login/page.tsx` consulta `getCurrentUser()`: si el perfil está `active`, redirige a `next` o `/`; si no está `active`, renderiza `/login` con el aviso y **no** redirige. El parámetro `?error=pending` se traduce al texto del aviso. Verify: `npm run build`; con `pending@solas.test` no hay loop de redirects.
 9. **Usuario real en las pantallas.** `getFeedData(user)` en `lib/feed.ts` arma `greeting`, `roomLabel` y `currentUser`; `data/mock/feed.ts` pierde los 3 campos del mock. Cada una de las 4 páginas llama a `getCurrentUser()` y pasa el resultado a `<Sidebar>` y a los shells que ya reciben `currentUser`. Verify: `npm run build`; el sidebar y el encabezado muestran los datos de la sesión.
10. **Chequeo final.** `npm run lint && npm run build` en limpio, `get_advisors('security')` + `get_advisors('performance')`, y revisión manual con Playwright MCP: matriz de las 4 cuentas seed, deep link con `?next`, `?next` malicioso descartado, logout, aviso pending, refresh de sesión al navegar varias pantallas seguidas, fidelidad visual de `/login` contra `login.dc.html`, y greps de invariantes (ningún import de `data/` desde `app/` o `components/`; nada de JSX ni `"use client"` en `lib/`).

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores ni warnings.

- [ ] `npm run build` termina correctamente.

- [ ] `staff@solas.test` + `solas-dev-password` entra a `/` y queda con cookie de sesión.

- [ ] Logueado, el sidebar muestra el nombre real del perfil ("Staff Soles"), iniciales derivadas del nombre ("SS") y el label de rol traducido ("Maestra · Sala Soles").

- [ ] Logueado, el encabezado del feed muestra "GUARDERÍA · SALA SOLES" y un saludo con el primer nombre del perfil; ninguno de los dos dice "Caro".

- [ ] Con `admin@solas.test` el label de rol dice "Directora"; con `parent@estrellas.test` dice "Familia · ESTRELLAS" y el `roomLabel` dice "GUARDERÍA · ESTRELLAS".

- [ ] Email o password incorrectos muestran "Email o contraseña incorrectos" inline, sin navegar y sin revelar si el email existe.

- [ ] Email vacío o password vacío muestran error en el campo correspondiente sin llegar a llamar a Supabase.

- [ ] Durante el submit el botón queda en estado pendiente y no se puede disparar dos veces.

- [ ] El campo EMAIL ya no trae `caro@opendaycare.com` precargado.

- [ ] Sin sesión, `/`, `/kids`, `/kids/[id]` y `/publicar` redirigen a `/login?next=<path>`; `/login` y `/activate-account` responden sin sesión.

- [ ] Deslogueado en `/kids/5`, un login exitoso deja al usuario en `/kids/5`.

- [ ] `?next=https://example.com`, `?next=//example.com` y `?next=login` se descartan y el destino final es `/`.

- [ ] Con sesión de un perfil `active`, entrar a `/login` o a `/activate-account` redirige a `/` sin bucles.

- [ ] Con sesión de `pending@solas.test`, entrar a `/` rebota a `/login?error=pending`, se ve el aviso de cuenta no activada y no hay bucle de redirects.

- [ ] Una sesión válida sin fila en `public.users` produce el mismo aviso que el caso pending.

- [ ] El botón "Cerrar sesión" del sidebar cierra sesión en desktop y en el drawer móvil, y `/` vuelve a pedir login.

- [ ] Tras refrescar o navegar varias pantallas seguidas con la misma sesión, el usuario sigue logueado (no hay deslogueos intermitentes).

- [ ] `/login` conserva la fidelidad visual de SPEC 03: split de 2 columnas, panel degradado, `max-w-[392px]`, mismo acento y tipografías, sin scroll horizontal en móvil.

- [ ] El feed, `/kids`, `/kids/[id]` y `/publicar` renderizan los mismos datos mock que antes de este spec (posts, niños y persistencia en localStorage intactos).

- [ ] `generateStaticParams` ya no está en `app/(app)/kids/[id]/page.tsx`.

- [ ] Ninguna migración nueva: `list_migrations` no cambia y `get_advisors('security')` no reporta nada nuevo.

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

- [ ] `lib/` no contiene JSX ni `"use client"` (verificable con grep).

## Decisiones

- **Sí:** solo email y password, sin signup público. El trigger `on_auth_user_created` exige `raw_app_meta_data.daycare_id` y el cliente nunca puede escribir `app_metadata`, así que un formulario de registro rompería en el alta. El alta de cuentas es por invitación y llega con su propio spec.
- **Sí:** Server Action + `useActionState` en vez de Client Component con `createBrowserClient`. Es el patrón de la guía de Next.js: la cookie de sesión se escribe en el server y el password nunca pasa por el bundle del navegador.
- **Sí:** dos gates. El proxy es barato y conoce el path (único que puede armar `?next=`); el layout es la autoridad porque el RLS exige `status = 'active'` y solo `public.users` distingue "sesión válida" de "usuario que puede usar la app". Con uno solo, un `pending` entraría y vería la app vacía.
- **Sí:** las Server Actions en `lib/auth-actions.ts` con `"use server"`, separadas de `lib/auth.ts`. Los casos de uso quedan sin `redirect()` ni `"use server"`, y el archivo de actions es importable desde un Client Component sin alcanzar `app/`. Cumple el invariante de SPEC 00 (compatible con Server Components).
- **Sí:** `app/(app)/layout.tsx` con un grupo de rutas, moviendo las 4 pantallas. Replica la convención de `(auth)` que ya existe (SPEC 04) y deja un solo lugar donde el chequeo puede olvidarse, en vez de cuatro.
- **Sí:** solo `/login` y `/activate-account` son públicas. `/activate-account` es el alta de cuentas: protegerla la dejaría inalcanzable sin sesión, que es lo contrario de su propósito.
- **Sí:** con sesión `active`, `/login` y `/activate-account` redirigen a `/` (o al `next`). Evita el clásico form loop en el que el login manda a la home y la home vuelve a mandar al login.
- **Sí:** un perfil no `active` ve un aviso en `/login?error=pending` en vez de una ruta nueva. El aviso aparece exactamente donde el usuario ya está, y evita una pantalla que solo existiría para un caso borde.
- **Sí:** sesión válida sin perfil = mismo aviso que `pending`. Mismo síntoma (no puede usar la app) y una sola taxonomía de errores. Ocurre de verdad: el trigger lanza excepción cuando falta `daycare_id`, así que puede haber un `auth.users` sin fila en `public.users`.
- **Sí:** el caso `pending` **no** invalida la sesión. Un layout no puede escribir cookies (el `setAll` de `data/supabase/server.ts` se traga el error a propósito), y no debe hacerlo: si la guardería activa la cuenta después, no debería exigir un re-login. Por eso `/login` no auto-redirige a un perfil no activo — sin esa regla, el pending entra a `/login`, ve la sesión y rebota a `/`, que lo devuelve a `/login?error=pending`.
- **Sí:** mensaje de credenciales neutro. Distinguir "no existe" de "contraseña mal" convierte el login en un enumerador de emails.
- **Sí:** sacar el `defaultValue` del email. `caro@opendaycare.com` no existe en la BD; el placeholder del mockup es lo que el usuario ve en producción.
- **Sí:** `?next=` validado a path relativo sin `//`. Sin esa validación, `/login?next=https://evil.com` es un open redirect con la marca de la app arriba.
- **Sí:** `getCurrentUser()` envuelto en `cache()` de React. El layout y la página lo llaman en el mismo request; sin `cache()`, son dos consultas idénticas a `public.users` por navegación.
- **Sí:** `daycares(name)` embebido en el select de `public.users`, con `daycareName: ""` como fallback. La política `daycares_select_own` exige `status = 'active'`, así que para un `pending` el embed resuelve `null` y el código tiene que sobrevivirlo.
- **Sí:** `shortDaycareName()` quita el prefijo "Guardería " y pasa a mayúsculas, para que "Guardería Sala Soles" rinda "SALA SOLES" como el mockup en vez de "GUARDERÍA · GUARDERÍA SALA SOLES". El mismo helper alimenta el `roomLabel` del feed y el `role` del sidebar.
- **Sí:** labels de rol en femenino ("Maestra", "Directora"). Es el copy que ya usa el mockup; no se infiere el género del nombre de la persona.
- **Sí:** `initialsFrom()` toma las iniciales de las dos primeras palabras ("SS", no "C"). Un avatar de 38px las admite y "SS" distingue un usuario de otro, que es justo lo que sirve cuando el nombre real reemplazó al mock.
- **Sí:** el saludo queda fijo en "Buenas, …". El mockup es estático y derivar "Buenos días / Buenas tardes" por hora es otra spec.
- **Sí:** quitar `generateStaticParams()`. Con el layout leyendo cookies el segmento entero es dinámico; dejarlo sería código muerto que sugiere una optimización que ya no ocurre.
- **No:** permisos por rol. Nada de "un `parent` no ve X": el feed y los niños son mock y se muestran igual para cualquiera. Es una spec con el modelo de datos de niños y publicaciones.
- **No:** migrar niños y publicaciones a la BD. Este spec mueve solo el usuario; el resto sigue en `data/mock/` + localStorage.
- **No:** "recordarme", verificación de email, magic link, OAuth, passkeys ni MFA.
- **No:** tests automatizados. El repo no tiene runner; agregar uno es una decisión de proyecto, no de este spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| El redirect del proxy armado como respuesta nueva pierde el refresh de `setAll` y desloguea al usuario en el request siguiente | Copiar `supabaseResponse.cookies.getAll()` y `cache-control`/`expires`/`pragma` sobre la respuesta de redirect, como pide la guía y AGENTS.md. Criterio de aceptación explícito |
| `redirect()` dentro del `try/catch` que envuelve las llamadas a Supabase se traga como si fuera un error de red | `redirect()` siempre después del `try`, nunca adentro. El criterio "credenciales malas muestran el error" falla ruidosamente si se rompe |
| Loop de redirects entre `/login` y `/` con un perfil no `active` | El layout manda a `/login?error=pending` y la página de login solo auto-redirige con perfil `active`. Criterio de aceptación específico del caso pending |
| El embed `daycares(name)` resuelve `null` para un `pending` porque `daycares_select_own` exige `status = 'active'` | `getCurrentUser()` devuelve `daycareName: ""` en vez de romper, y el label degrada a solo el rol traducido |
| Dos consultas idénticas a `public.users` por request (layout + página) | `cache()` de React envolviendo `getCurrentUser()` |
| Mock de Sala Soles visible para un usuario de Guardería Estrellas | Fuera de alcance y registrado: este spec autentica, no aísla datos. Llega con los niños en la BD |
| El grupo `(app)` rompe una ruta o una referencia al mover 4 carpetas | Los paréntesis no entran en el path; build + las 4 rutas respondiendo igual en el chequeo final |
| El prefill de `caro@opendaycare.com` se usaba como referencia visual en el mockup | Se conserva el placeholder y todo el resto del layout; el criterio de fidelidad visual de `/login` cubre el resultado |
| El proxy ahora decide sobre el acceso, así que un error de orden se manifiesta como deslogueo aleatorio | Un solo `getClaims()` cuyo resultado se guarda, sin código entre `createServerClient()` y la llamada; verificación navegando varias pantallas con la misma sesión |
| El seed con el usuario `pending` no está aplicado y el caso queda sin probar | Seed idempotente en `supabase/seed/` documentado en SPEC 11, aplicado con `execute_sql`; paso 10 lo verifica con una query |

## Lo que **no** está en este spec

- Signup público y alta de cuentas por invitación (`/activate-account` funcional, código de invitación, Edge Function que escriba `app_metadata`).
- Recuperación de contraseña, verificación de email, magic link, OAuth, passkeys, MFA y "recordarme".
- Autorización por rol: qué ve un `parent`, qué ve un `staff`, qué ve un `admin`.
- Niños, publicaciones y salas en la base: siguen siendo mock y localStorage.
- Datos del perfil (nombre, avatar, preferencias de notificación) más allá de leerlos.
- Multi-guardería en una misma sesión y cualquier gestión de la cuenta del usuario.
- Suite de tests automatizados.

Cada uno de esos, si llega, va en su propio spec.