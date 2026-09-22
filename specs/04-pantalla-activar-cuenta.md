# SPEC 04 — Pantalla Activar Cuenta desde el mockup `activar-cuenta.dc.html`

> **Estado:** Approved
> ****Depende de:** SPEC 00 — Arquitectura, SPEC 03 — Pantalla Login
> ****Fecha:** 2026-09-22
> ****Objetivo:** Replicar pantalla a pantalla `references/pantallas/activar-cuenta.dc.html` como la ruta `/activate-account` bajo un route group `(auth)`, con datos estáticos y sin DB, haciendo que el link "Activá tu cuenta" del login navegue a la nueva ruta.

## Alcance

**Incluye:**

- Crear el route group `app/(auth)/` y mover `app/login/page.tsx` → `app/(auth)/login/page.tsx` (la URL `/login` queda intacta; los paréntesis no entran en el path, ver docs de route groups).
- Nueva ruta `app/(auth)/activate-account/page.tsx` replicando `activar-cuenta.dc.html`: columna centrada `max-w-[440px]` sobre fondo `#FBF4EC`, logo en caja gradiente `#F8C3A8→#F2937A` reutilizando `LogoIcon`, h1 "Bienvenida a OpenDayCare" y subtítulo "Te invitaron a seguir el día de tu hijo. Creá tu contraseña para activar la cuenta.".
- Componente presentacional `components/activate-account-form.tsx` (Server Component, sin `"use client"`).
- Tarjeta de invitación: avatar "M" (`#A9D9E8`/`#1F7A93`), "Te invitaron a seguir a" + "Mateo · Sala Soles".
- Campos con valores estáticos: **CÓDIGO DE INVITACIÓN** `7K4P9` (Fredoka, `letter-spacing: 3px`), **EMAIL** `lucia.fernandez@gmail.com`, **CREAR CONTRASEÑA** `type="password"` con `defaultValue="contraseña"` (se ve enmascarado) y borde `#F2A78E`.
- Checkbox de autorización **decorativo** (span verde `#5FB97E` con check SVG sobre fondo `#FBF1D6`, texto `#8A7234` "Autorizo a la guardería…") con `aria-label`.
- Botón "Activar mi cuenta" **inerte** (`type="button"`, gradiente `#F4977E→#EE8164`, sin `<form>`).
- Link "Iniciar sesión" **real** → `/login`.
- En `components/login-form.tsx`: "Activá tu cuenta" pasa de botón inerte a `<Link href="/activate-account">` con la misma apariencia.
- Responsive: la columna centrada se mantiene en móvil sin scroll horizontal.

**Fuera de alcance (specs futuros):**

- Conexión a DB/API: validación del código, activación real de la cuenta, envío de password.
- Navegación del submit "Activar mi cuenta" (inerte; el redirect al feed llega con la DB).
- Persistir el consentimiento o estados del formulario.
- Flujo "recuperé mi contraseña", "recordarme", sesión.
- Modificar `/`, sidebar, kids, layouts globales o el feed de SPEC 01/02.

## Modelo de datos

**No se introduce ningún dato ni persistencia.** Los valores (código `7K4P9`, email, nombre/niño, contraseña) son estáticos inline en `components/activate-account-form.tsx`, igual que el email prellenado de la SPEC 03. No aparecen archivos nuevos en `data/` ni en `lib/`. Capa de presentación únicamente: `app/(auth)/activate-account/page.tsx` + `components/activate-account-form.tsx`. La regla de dependencia de SPEC 00 se cumple por ausencia.

## Plan de implementación

1. **Route group** `(auth)`**.** Crear la carpeta `app/(auth)/login/` y mover `app/login/page.tsx` ahí (sin cambios de contenido). Verify: `npm run build` y que `/login` siga respondiendo igual.
2. **Formulario.** Crear `components/activate-account-form.tsx` (Server Component): encabezado, tarjeta de invitación, campos con valores estáticos, checkbox decorativo + `aria-label`, botón "Activar mi cuenta" `type="button"` inerte y footer con `<Link href="/login">`. Verify: `npm run build`.
3. **Página** `/activate-account`**.** Crear `app/(auth)/activate-account/page.tsx` componiendo la columna centrada `max-w-[440px]`, la caja de logo con `LogoIcon` y `<ActivateAccountForm />`. Verify: `npm run build` + visual contra el mockup.
4. **Acceso desde el login.** En `components/login-form.tsx`, reemplazar el botón inerte "Activá tu cuenta" por `<Link href="/activate-account">` conservando clases y apariencia. Verify: `npm run build`.
5. **Chequeo final.** `npm run lint && npm run build` en limpio y revisión manual con Playwright MCP: desktop/mobile de `/activate-account`, inercia de Enter/clic en el botón verde, navegación `/login` → `/activate-account` → `/login`, ausencia de scroll horizontal y `/` intacto.

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores ni warnings.

- [ ] `npm run build` termina correctamente.

- [ ] `/login` sigue existiendo en la misma URL tras el movimiento a `app/(auth)/login/`.

- [ ] `/activate-account` renderiza el mockup: columna centrada `max-w-[440px]` sobre `#FBF4EC`, logo gradiente reutilizando `LogoIcon`, h1 "Bienvenida a OpenDayCare" y subtítulo exactos.

- [ ] La tarjeta de invitación muestra "Te invitaron a seguir a", "Mateo · Sala Soles" y el avatar "M" en `#A9D9E8`/`#1F7A93`.

- [ ] CÓDIGO DE INVITACIÓN muestra `7K4P9`; EMAIL muestra `lucia.fernandez@gmail.com`; CREAR CONTRASEÑA es `type="password"` con borde `#F2A78E`.

- [ ] El checkbox de autorización es decorativo (con `aria-label`) y muestra el texto exacto del mockup sobre fondo `#FBF1D6`.

- [ ] Clic en "Activar mi cuenta" y Enter sobre cualquier campo **no** navegan ni recargan (sin 404, URL intacta).

- [ ] "Iniciar sesión" navega a `/login`.

- [ ] En `/login`, clic en "Activá tu cuenta" navega a `/activate-account`.

- [ ] En viewport móvil no hay scroll horizontal.

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

## Decisiones

- **Sí:** route group `(auth)` conteniendo `login` y `activate-account` (pedido explícito). Los paréntesis no participan en la URL; es organización pura (docs Next 16).
- **Sí:** mover `app/login/page.tsx` a `app/(auth)/login/page.tsx`. Refactor de organización, cero cambios visuales ni de URL; se verifica con build.
- **Sí:** ruta en inglés `/activate-account` con UI en español ("toda ruta será en inglés"); slug del spec en español, siguiendo la convención de `02-ninos-perfil` y `03-pantalla-login`.
- **Sí:** "Activar mi cuenta" inerte. Consistente con el submit inerte de SPEC 03; la navegación post-activación llega con la DB/auth en su spec.
- **Sí:** "Iniciar sesión" como link real a `/login`. Coincide con el mockup (linkea a `login.dc.html`) y la ruta ya existe.
- **Sí:** "Activá tu cuenta" del login pasa a link real. **Supersede** la decisión "inerte" de SPEC 03 para ese único elemento, habilitando el flujo login → activar cuenta.
- **Sí:** valores estáticos inline en `components/activate-account-form.tsx`. Mismo patrón que el email de SPEC 03: cero capa de datos hasta que exista la DB.
- **Sí:** checkbox decorativo + `aria-label`. Fidelidad pixel al mockup, sin estado ni interacción no pedida.
- **No:** `<form>`, validación, mensajes de error, persistencia, sesión, envío del password.
- **No:** tocar `/`, sidebar, kids, layout global.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Mover el login al route group podría romper alguna referencia | Criterio explícito: `/login` intacto tras el movimiento + `npm run build`. |
| Fidelidad "igual al mockup" depende de comparación visual | Criterios booleanos + chequeo con Playwright MCP contra `activar-cuenta.dc.html`. |
| El botón inerte puede parecer un bug de click | Documentado como decisión; la activación real queda para el spec de DB/auth. |
| El `defaultValue` de password muestra texto enmascarado distinto al mockup estático | En cualquier render real `type="password"` enmascara; el valor del mockup se conserva como dato estático. |

## Lo que **no** está en este spec

- Conexión a DB/API, validación del código de invitación, activación real de la cuenta, envío y almacenamiento de contraseña.
- Navegación del submit "Activar mi cuenta" hacia el feed.
- Persistencia del consentimiento ni estados del formulario.
- Recuperación de contraseña y sesión.

Cada uno de esos, si llega, va en su propio spec.