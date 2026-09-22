# SPEC 01 — Home Feed desde el mockup `feed.dc.html`

> **Estado:** Implementado **Depende de:** SPEC 00 — Arquitectura **Fecha:** 2026-09-18 **Objetivo:** Replicar pixel a pixel la pantalla `references/pantallas/feed.dc.html` como el home (`/`) del proyecto Next.js con Tailwind, sin autenticación ni base de datos.

## Alcance

**Incluye:**

- Reescritura de `app/page.tsx` para renderizar el feed del mockup (sidebar, saludo, tarjeta "compartí un momento…", sección "PUBLICADO HOY", 3 posts: logro, actividad con foto, anuncio).
- Datos ficticios en `data/mock/feed.ts` (perfil Caro, posts de Mateo, contadores de likes/comentarios).
- Tipografías Fredoka + Nunito globales vía `next/font/google` y tokens de la paleta cálida (fondo `#F6ECDF`, tarjetas `#FFFDF9`, acentos `#E0654A`, etc.) en `app/globals.css`.
- Enlaces de navegación (Niños, Avisos, Mi cuenta, Nueva publicación, Editar, cerrar sesión, like/comentario) como **elementos inertes** sin navegación.
- Sidebar responsive: en viewports `< lg` (1024px) el aside fijo se oculta y aparece una barra superior con botón hamburguesa + marca "OpenDayCare · Sala Soles"; el clic abre el sidebar como drawer deslizante sobre un backdrop.
- Textos y fechas estáticos idénticos al mockup ("Buenas, Caro", "12 niños · martes 17 jun", "PUBLICADO HOY").
- `lang="es"` y `title` "OpenDayCare" en `app/layout.tsx`.

**Fuera de alcance (specs futuros):**

- Autenticación y login.
- Base de datos / API / persistencia.
- Las demás pantallas (Niños, Avisos, Mi cuenta, crear/publicar, detalle publicación).
- Cualquier navegación real entre rutas.
- Fechas calculadas dinámicamente.
- Modo oscuro (se elimina el boilerplate).

## Modelo de datos

Se introduce una sola fuente de datos estáticos. (No hay persistencia.)

```ts
// data/mock/feed.ts
export type PostType = "logro" | "actividad" | "anuncio";

export interface Post {
  id: string;
  type: PostType;
  author: { name: string; initials: string; avatarBg: string; avatarColor: string };
  time: string;          // "14:20"
  publishedBy: string;   // "publicado por vos"
  audience: string;      // "Para: familia de Mateo"
  body: string;
  photo?: { label: string }; // placeholder "Foto · pintando con témperas"
  likes: number;
  comments: number;
}

export interface FeedData {
  roomLabel: string;      // "GUARDERÍA · SALA SOLES"
  greeting: string;       // "Buenas, Caro"
  childrenLine: string;   // "12 niños · martes 17 jun"
  composePlaceholder: string; // "Compartí un momento…"
  currentUser: { name: string; initials: string; role: string };
  posts: Post[];          // 3 posts del mockup, en ese orden
}
```

Convención: `FeedData` se exporta como constante `feedData`. Los nombres de hijos/autor navegan igual que en el mockup (Mateo, avatar "M" `#A9D9E8`/`#1F7A93`, anuncio con avatar genérico `#CCD8F4`/`#4E72C8`).

La capa de aplicación expone la costura que las pantallas consumen (nunca `data/` directo, ver SPEC 00):

```ts
// lib/feed.ts
import { feedData, type FeedData } from "@/data/mock/feed";

export function getFeedData(): FeedData {
  return feedData;
}
```

## Arquitectura / Patrones

Sigue los principios de la **SPEC 00 — Arquitectura** (Clean Architecture pragmática a 4 capas, regla de dependencia hacia adentro). Archivos por capa:

- **Dominio:** tipos `Post`, `PostType`, `FeedData` en `data/mock/feed.ts` (puros, sin dependencias).
- **Aplicación:** `lib/feed.ts` → `getFeedData()`. Sin JSX ni `"use client"`.
- **Infraestructura:** `data/mock/feed.ts` → constante `feedData`. Única capa reemplazable por una fuente real en un spec futuro.
- **Presentación:** `app/` (rutas Server Component) + `components/` (presentacionales, sin lógica de negocio). Los botones y enlaces son **inertes** (no navegan). Única excepción de estado: `sidebar.tsx` (drawer abierto/cerrado), marcado `"use client"`.

Regla de flujo de datos: `app/page.tsx` importa `getFeedData()` desde `lib/feed.ts` y lo pasa como props; los componentes no importan datos por su cuenta. Ningún archivo en `app/` ni `components/` importa desde `data/`. Los mocks se pueden reemplazar por una fuente real en un spec futuro sin tocar el render.

## Plan de implementación

1. **Tipografías y tema.** En `app/layout.tsx`: `Fredoka` + `Nunito` con `next/font/google`, `lang="es"`, metadata con título "OpenDayCare". En `app/globals.css`: tokens de la paleta del mockup dentro de `@theme inline`, fondo base `#F6ECDF`, cuerpo `#3F362E`, y se elimina el modo oscuro y la configuración Geist. Verify: `npm run build`.
2. **Datos ficticios.** Crear `data/mock/feed.ts` con los tipos y `feedData` copiando exactamente textos, avatares, contadores y orden del mockup. Crear también `lib/feed.ts` (capa de aplicación) con `getFeedData()` que retorna `feedData`. Verify: `npm run build` (TS estricto).
3. **Iconos.** Crear `components/icons.tsx` con los SVG inline del mockup (logo, home, niños, campana, usuario, logout, plus, cámara, corazón, comentario, menú hamburguesa, close), como componentes React. Verify: `npm run build`.
4. **Sidebar.** Crear `components/sidebar.tsx` como Client Component (`"use client"`) con brand "OpenDayCare / Sala Soles", botón "Nueva publicación" (inert, gradiente `#F4977E→#EE8164`), nav con Feed activo resaltado, footer de usuario "Caro Giménez / Maestra · Soles" con botón logout inert. Tres piezas responsivas: aside fijo desktop (`hidden lg:flex`, 248px pegajoso), barra superior móvil (`lg:hidden`, hamburguesa + marca), y drawer de 248px que desliza desde la izquierda sobre backdrop `#000/40`. El drawer se cierra al: clic en un ítem, clic sobre el backdrop, tecla Esc o botón X; mientras está abierto se bloquea el scroll del cuerpo. El botón hamburguesa expone `aria-expanded`/`aria-controls`. Verify: build + inspección visual en viewport desktop y móvil.
5. **Tarjeta de post.** Crear `components/post-card.tsx` que renderice un `Post` según su tipo: badge (LOGRO/ACTIVIDAD/ANUNCIO con su color), audiencia, cuerpo, placeholder de foto (borde dashed) cuando exista, y fila de acciones inertes (corazón + contador, comentario + contador, "Editar"). Verify: build + inspección visual.
6. **Home.** Reescribir `app/page.tsx` componiendo saludo/encabezado, tarjeta "Compartí un momento…", divisor "PUBLICADO HOY" y los 3 posts consumiendo `getFeedData()` desde `lib/feed.ts` (nunca `data/` directo) dentro del layout del mockup (sidebar 248px pegajosa a la izquierda, main con scroll propio, contenido centrado `max-width: 760px`). Verify: `npm run lint && npm run build` y chequeo manual en navegador.

## Criterios de aceptación

- [x] `npm run lint` termina sin errores ni warnings.

- [x] `npm run build` termina correctamente.

- [x] `app/page.tsx` consume el feed vía `getFeedData()` de `lib/feed.ts`; ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

- [x] `app/page.tsx` ya no contiene el boilerplate de create-next-app.

- [x] En `/` se ve el fondo `#F6ECDF` y una sidebar de 248px `#FFFDF9` fija a la izquierda con los 4 ítems de nav (Feed resaltado en `#FBE3D8`/`#D9583C`).

- [x] El saludo muestra "GUARDERÍA · SALA SOLES", "Buenas, Caro" y "12 niños · martes 17 jun" exactos.

- [x] La tarjeta "Compartí un momento…" aparece con el avatar "C" y el icono de cámara.

- [x] Aparece el divisor "PUBLICADO HOY" con su línea.

- [x] Los 3 posts renderizan el contenido exacto del mockup: badge y color correctos por tipo, audiencia, hora, cuerpo, y contadores de corazón/comentario.

- [x] El post de actividad muestra el placeholder de foto con texto "Foto · pintando con témperas".

- [x] Clic en cualquier elemento de la sidebar, "Nueva publicación", "Editar", corazón, comentario y botón de logout **no** produce navegación ni 404.

- [x] Títulos en Fredoka y textos en Nunito (vía `next/font`).

- [x] `<html lang="es">` y `<title>OpenDayCare</title>`.

- [x] En viewport `< lg` (1024px) no hay scroll horizontal ni sidebar apilada: se ve la barra superior con botón hamburguesa y la marca "OpenDayCare · Sala Soles".

- [x] El clic en la hamburguesa abre el drawer con los 4 ítems de nav, "Nueva publicación" y el footer de usuario, idénticos a la sidebar desktop.

- [x] El drawer se cierra al hacer clic en un ítem, al hacer clic sobre el backdrop, al presionar Esc o al tocar el botón X.

- [x] El botón hamburguesa expone `aria-expanded`/`aria-controls` y el panel del drawer tiene `role="dialog"` con `aria-label`.

- [x] Con el drawer abierto, el contenido detrás no scrollea.

- [x] En viewport `≥ lg` (1024px) el sidebar se muestra fijo a la izquierda, idéntico al mockup desktop.

## Decisiones

- **Sí:** Clean Architecture pragmática a 4 capas según la SPEC 00 (dominio, aplicación, infraestructura, presentación) con regla de dependencia hacia adentro. Sin folders estrictos `domain/`/`application/`/`infra/` por ahora.
- **Sí:** costura `getFeedData()` en `lib/feed.ts` (capa de aplicación). `app/page.tsx` consume el contrato, nunca `data/` directo; el swap a una fuente real toca solo `data/`.
- **Sí:** datos ficticios en `data/mock/feed.ts` (infraestructura). Separa UI de datos para conectar una fuente real en un spec futuro sin tocar el render.
- **No:** datos embebidos en el JSX o archivo JSON suelto. El módulo TS tipado es más legible y reutilizable.
- **Sí:** enlaces inertes (span/div/button sin href). Evita 404 y mantiene el alcance en `/`.
- **Sí:** textos y fecha estáticos idénticos al mockup. Fidelidad visual máxima y cero lógica temporal.
- **Sí:** Fredoka + Nunito reemplazando Geist. Son las fuentes del diseño.
- **Sí:** iconos SVG propios inline (sin dependencia de librería de iconos). El mockup ya los trae y evita sumar peso/lineamientos de terceros.
- **Sí:** arquitectura centralizada en `specs/00-arquitectura.md` (SPEC 00). Fija la convención CA para el resto de las specs y deslinda los mocks del render; este spec solo declara sus archivos por capa.
- **No:** atomic design ni carpetas por feature. Sobre-ingeniería para una app de menos de 10 pantallas.
- **Sí:** breakpoint `lg` (1024px) para el drawer. El layout desktop necesita \~1008px (760 de contenido + 248 de sidebar); debajo de eso el drawer es la navegación natural.
- **Sí:** barra móvil con solo hamburguesa + marca. "Nueva publicación" queda dentro del drawer, con el mismo orden que desktop.
- **Sí:** `sidebar.tsx` como único Client Component. Es la primera interacción del proyecto; el resto sigue inert.
- **Sí:** cierre del drawer por ítem, backdrop, Esc y X; bloqueo de scroll del fondo mientras está abierto.
- **No:** estado global (Context) ni librería de drawer (headless-ui, vaul). Hay una sola pantalla; el estado local alcanza.
- **No:** botón "Nueva publicación" fijo visible fuera del drawer en móvil.
- **No:** autenticación, base de datos, resto de pantallas, navegación entre rutas, fechas dinámicas, modo oscuro. Cada uno merece su propio spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| `next/font/google` descarga Fredoka/Nunito durante `npm run build`; sin red el build falla | Documentado; build requiere red la primera vez. La app igualmente usa fallback `system-ui`. |
| Fidelidad "igual al mockup" depende de comparación visual manual | Criterios de aceptación booleanos + chequeo con Playwright MCP contra el mockup. |
| SVGs copiados del mockup podrían verse distintos a escala | Se reutilizan los `viewBox` y trazos originales tal cual. |
| El drawer requiere comportamiento accesible y sin bugs en viewports angostos, sujeto a QA manual | Criterios de aceptación booleanos + chequeo con Playwright MCP en viewport móvil y desktop. |

## Lo que **no** está en este spec

- Autenticación y login.
- Base de datos o API propia.
- Pantallas Niños, Avisos, Mi cuenta, crear/editar publicación, detalle.
- Navegación real y routing entre secciones.
- Fechas reales calculadas.
- Folders estrictos `domain/` / `application/` / `infra/` (la regla vive en SPEC 00, que los descarta mientras no haya complejidad real).

Cada uno de esos, si llega, va en su propio spec.