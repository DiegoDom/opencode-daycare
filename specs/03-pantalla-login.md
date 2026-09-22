# SPEC 03 — Pantalla Login desde el mockup `login.dc.html`

> **Estado:** Implemented \*\***Depende de:** SPEC 00 — Arquitectura \*\***Fecha:** 2026-09-22 \*\***Objetivo:** Replicar la pantalla `references/pantallas/login.dc.html` como la ruta `/login`, omitiendo la sección "INGRESO COMO", sin autenticación ni base de datos, dejando `/` como el feed actual.

## Alcance

**Incluye:**

- Ruta `app/login/page.tsx` replicando `login.dc.html` **sin la sección "INGRESO COMO"** ni los botones de rol Personal/Familia.
- Split desktop (`≥ lg`, 1024px) en 2 columnas `1.05fr 1fr`: panel izquierdo degradado (`linear-gradient(155deg,#F6A98E,#F2937A 45%,#EC7E62)`) con círculos decorativos `rgba(255,255,255,…)`, logo + "OpenDayCare", titular "El día de cada niño, compartido con su familia.", párrafo descriptivo y footer "🌿 Guardería Sala Soles". Panel derecho centrado `max-w-[392px]` con el formulario.
- Formulario: encabezado "Iniciar sesión" + subtítulo "Ingresá para ver el día de hoy.", campo **EMAIL** prellenado `caro@opendaycare.com`, campo **CONTRASEÑA** (`type="password"`, placeholder `••••••••`), link "¿Olvidaste tu contraseña?" inerte alineado a la derecha (`#C5503A`), botón "Iniciar sesión" (gradiente `#F4977E→#EE8164`, sombra `#EE8164` al 70%) **inerte** (`type="button"`, sin navegación ni recarga), y footer "¿Te invitó la guardería? *Activá tu cuenta*" inerte.
- Responsive: en `< lg` el panel izquierdo se oculta (`hidden lg:flex`) y el formulario se muestra solo con una barra superior compacta de marca (logo + "OpenDayCare").
- Componente presentacional `components/login-form.tsx` (Server Component, sin `"use client"`) y logo SVG nuevo en `components/icons.tsx` (círculo + rayos, `viewBox 0 0 24 24`, trazos del mockup).
- Inputs con `aria-label` (los labels visuales son texto decorativo como en el mockup). Textos y colores estáticos idénticos al mockup; `lang="es"` y fonts Fredoka/Nunito ya globales (SPEC 01).

**Fuera de alcance (specs futuros):**

- Autenticación, sesión, conexión a DB/API y validación de credenciales (se suma después).
- Navegación real del submit (redirect a `/` o feed del usuario activo).
- La pantalla `activar-cuenta` (link inerte; es otro mockup).
- Flujo funcional "olvidé mi contraseña".
- Modificar `/`, el sidebar, kids, layout global o cualquier pantalla existente.

## Modelo de datos

**No se introduce ningún dato ni persistencia.** El email prellenado es un valor estático inline en `components/login-form.tsx`. No aparecen archivos nuevos en `data/` ni en `lib/` (esta sección se omite: no hay capa de dominio, infraestructura ni aplicación involucrada).

Capa de presentación (única): `app/login/page.tsx` (Server Component) + `components/login-form.tsx` (presentacional). Cero componentes client. La página no importa datos (no los hay); la regla de dependencia de SPEC 00 se cumple por ausencia.

## Plan de implementación

1. **Icono del logo.** Agregar a `components/icons.tsx` el SVG del logo OpenDayCare (círculo + 8 rayos, trazos del mockup). Verify: `npm run build`.
2. **Formulario.** Crear `components/login-form.tsx` (Server Component): encabezado, campo EMAIL con valor estático, campo CONTRASEÑA, links inertes y botón `type="button"` inerte; sin `<form>` para que Enter no provoque navegación/reload. Verify: `npm run build`.
3. **Página** `/login`**.** Crear `app/login/page.tsx` componiendo el panel izquierdo (marca + titular + decoración, `hidden lg:flex`) y `<LoginForm/>` en el grid `lg:grid-cols-[1.05fr_1fr]`, con la barra compacta de marca para móvil. Verify: `npm run build` + visual.
4. **Chequeo final.** `npm run lint && npm run build` en limpio y revisión manual con Playwright MCP (desktop/mobile, inercia de clics y Enter, ausencia de scroll horizontal, `/` intacto).

## Criterios de aceptación

- [x] `npm run lint` termina sin errores ni warnings.

- [x] `npm run build` termina correctamente.

- [x] `/login` renderiza la pantalla del mockup; `/` sigue mostrando el feed de SPEC 01/02.

- [x] En `≥ lg` se ve el split 2 columnas con el panel degradado (logo, titular "El día de cada niño,\
  compartido con su familia.", párrafo y "🌿 Guardería Sala Soles") y el formulario centrado de `max-w-[392px]`.

- [x] No existe la sección **INGRESO COMO** ni los botones Personal/Familia en el DOM (verificable con snapshot).

- [x] El campo EMAIL muestra `caro@opendaycare.com`; CONTRASEÑA es `type="password"` con placeholder `••••••••`.

- [x] Clic en "¿Olvidaste tu contraseña?", "Activá tu cuenta" y "Iniciar sesión" **no** navega ni recarga (URL y página intactas).

- [x] Pulsar Enter sobre los campos no navega ni recarga.

- [x] En `< lg` no hay scroll horizontal: se oculta el panel izquierdo y queda la barra compacta con logo + "OpenDayCare" sobre el formulario.

- [x] Inputs expuestos con `aria-label`; fonts Fredoka/Nunito y paleta del mockup (fondo `#FBF4EC`, texto `#3F362E`, acento `#C5503A`, gradientes del botón y panel).

- [x] Ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

## Decisiones

- **Sí:** nueva ruta `app/login/page.tsx` → `/login`, dejando `/` como home. El feed ya está implementado; el login es una pantalla standalone que en un spec futuro se conecta a auth/DB.
- **Sí:** omitir "INGRESO COMO" y los botones de rol (pedido explícito del usuario). En el mockup el rol elegía `loginHref`; sin rol y sin auth, el submit es inerte.
- **Sí:** "Iniciar sesión" inerte (`<button type="button">`, sin `<form>`). Enter no dispara nada y clic no navega ni recarga; coherente con el patrón de enlaces inertes de SPEC 01/02 y con "solo quiero la pantalla". Cero JS cliente.
- **Sí:** email prellenado estático `caro@opendaycare.com` y contraseña vacía con placeholder. Fidelidad pixel al mockup.
- **Sí:** "¿Olvidaste tu contraseña?" y "Activá tu cuenta" inertes. No hay ruta real; `activar-cuenta` es otro mockup fuera de alcance.
- **Sí:** panel izquierdo `hidden lg:flex` y barra compacta de marca en móvil. Coherente con el breakpoint `lg` del drawer de SPEC 01.
- **Sí:** `components/login-form.tsx` como único componente nuevo de presentación y el logo del mockup en `components/icons.tsx`. Sin datos ni `lib/` nuevos.
- **No:** validación, mensajes de error, "recordarme", persistencia ni sesión. Todo eso llega con la DB/auth en su propio spec.
- **No:** redirección del submit ni pantalla de activar cuenta funcional.
- **No:** tocar `/`, sidebar, kids, ni el layout global.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Fidelidad "igual al mockup" depende de comparación visual manual | Criterios de aceptación booleanos + chequeo con Playwright MCP contra `login.dc.html`. |
| SVGs copiados del mockup podrían verse distintos a escala | Se reutilizan `viewBox` y trazos originales tal cual. |
| El botón inerte puede parecer un bug de click | Documentado como decisión; la navegación real del submit queda para el spec de auth/DB. |
| Scroll horizontal accidental frente al valor estático del email largo | Chequeo visual en viewport móvil (criterio booleano). |

## Lo que **no** está en este spec

- Auth, sesión, DB/API, validación de credenciales, flujo de olvido de contraseña, pantalla de activar cuenta, redirect post-login.

Cada uno de esos, si llega, va en su propio spec.