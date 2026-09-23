# SPEC 07 — Crear publicación desde el feed (`/publicar`)

> **Estado:** Approved **Depende de:** SPEC 00 — Arquitectura, SPEC 01 — Home Feed, SPEC 05 — Agregar niño, SPEC 06 — Vincular padre **Fecha:** 2026-09-23 **Objetivo:** Permitir crear una nueva publicación en `/publicar` (réplica de `crear-publicacion.dc.html`) con destinatario múltiple de niños de Sala Soles o "Toda la sala" (excluyentes), tipo y descripción obligatorios, fotos opcionales con upload/preview y validación inline, que al publicar persiste en localStorage y aparece al tope del feed de `/`.

## Alcance

**Incluye:**

- Nueva ruta `/publicar` (página standalone sin sidebar, réplica exacta de `crear-publicacion.dc.html`: card `max-w-[580px]` centrada sobre `#F6ECDF`, encabezado "Cancelar" / "Nueva publicación" / "Publicar").
- Entradas de navegación: el botón "Nueva publicación" del sidebar (desktop y drawer móvil) y la tarjeta "Compartí un momento…" del feed llevan a `/publicar`. "Cancelar" y "Publicar" vuelven a `/`.
- **PARA** como selector múltiple: pill por niño (inicial + nombre) de la sala actual — los 8 del mock más los agregados de SPEC 05 cuyo `room` sea "Soles", mezclados como en `/kids` — más la pill "Toda la sala".
- **Exclusividad**: activar "Toda la sala" deselecciona y deshabilita las pills de niños; desactivarla las restaura. Nunca se combinan.
- **TIPO**: 7 pills (Comida, Siesta, Actividad, Logro, Ánimo, Foto, Anuncio), una sola activa, ninguna por defecto.
- **DESCRIPCIÓN**: textarea ("Contá cómo le fue hoy…"), vacía por defecto.
- **FOTOS** opcionales: input `accept="image/*"`, slots con miniaturas (preview) y botón quitar, máximo 4, persistidas como `dataURL` dentro del post; el slot dashed "Agregar" es el último. Al llegar a 4 se oculta.
- Validación exacta al patrón SPEC 05/06: obligatorios TIPO, PARA (≥1 niño o Toda la sala) y DESCRIPCIÓN no vacía (trim); fotos nunca obligatorias ni con tipo Foto. "Publicar" deshabilitado hasta válido; errores inline tras `blur` o intento de publicar (Enter marca `touched`) con `aria-invalid`/`aria-describedby`/`role="alert"`. Mensajes: "Elegí un tipo", "Elegí al menos un destinatario", "Escribí una descripción".
- Al publicar: se construye el `Post`, se persiste en `localStorage["opdaycare.posts.v1"]` y se navega a `/`. El feed muestra los posts guardados al tope de "PUBLICADO HOY" mezclados con los 3 del mock (feed-shell client, patrón kids-shell).
- `PostType` ampliado a los 7 tipos en el dominio; `PostCard` con badge/color para los 4 nuevos y render de `photos`.
- Responsive: sin scroll horizontal en móvil; card full-width con padding `24px`.

**Fuera de alcance (specs futuros):**

- Editar/borrar publicaciones, detalle (`detalle-publicacion.dc.html`), likes/comentarios funcionales.
- Notificaciones a padres, backend/API, envío real de fotos a servidor.
- Grupos de feed por fecha ni fechas dinámicas en posts viejos; el mock conserva sus horas estáticas.
- Cambiar la sala del compositor o publicar para Estrellas/Lunitas.

## Modelo de datos

```ts
// data/mock/feed.ts
export type PostType =
  | "comida" | "siesta" | "actividad" | "logro" | "animo" | "foto" | "anuncio";
// reemplaza el union actual; "actividad"/"logro"/"anuncio" siguen válidos → el mock no cambia datos.

export interface Post {
  // …campos actuales sin cambios…
  photos?: { src: string }[]; // solo posts creados aquí (dataURL); photo? sigue para el placeholder del mock
}

// localStorage["opdaycare.posts.v1"] → Post[] (posts creados, nuevos primero)
// id: "post-" + Date.now().toString(36)
// author: { name, initials, avatarBg, avatarColor } del PRIMER niño seleccionado;
//          si es "Toda la sala" → { name: "Sala Soles", initials: "", avatarBg: "#CCD8F4", avatarColor: "#4E72C8" }
// time: hora actual "HH:MM"   publishedBy: "publicado por vos"
// audience: "Para: familia de {A}, {B} y {C}" (nombres de pila de los elegidos, en orden de selección)
//         | "Para: familia de {A}" (un niño) | "Para: toda la sala"
// body: descripción · photos?: [{ src: dataURL }] · likes: 0 · comments: 0
```

## Arquitectura / Patrones

Sigue la **SPEC 00** (Clean Architecture pragmática, dependencia hacia adentro).

- **Dominio:** `data/mock/feed.ts` — `PostType` ampliado y `Post.photos?`.
- **Aplicación:** `lib/post-utils.ts` (nuevo, puro, sin JSX ni `"use client"`, sin importar `data/`) — `validateDescription(value): string | null`, `buildAudience(names: string[]): string`, `buildPost(draft): Post`, `currentTimeHHMM(): string`, `makePostId(): string`.
- **Infraestructura (fuentes):** `localStorage["opdaycare.posts.v1"]` (posts) y `localStorage["opdaycare.kids.v1"]` (niños para el selector), leídas dentro de los únicos client shells que las tocan.
- **Presentación:** `app/publicar/page.tsx` (Server: layout del mockup + `baseKids` = `getKids().filter(room==="Soles")` + `currentUser` como props), `components/create-post-shell.tsx` (client: mezcla niños, estado del form, validación, exclusividad, fotos, persiste, `router.push("/")`, devuelve foco), `components/feed-shell.tsx` (client: `basePosts` + posts guardados), modificados `app/page.tsx`, `components/post-card.tsx`, `components/compose-card.tsx` (pasa a `<Link href="/publicar">`) y `components/sidebar/new-post-button.tsx` (`router.push("/publicar")`). Ningún archivo en `app/` ni `components/` importa desde `data/` (grep). `PostType` marcado `anuncio` sigue renderizando `MegaphoneIcon`; en posts "Toda la sala" no-anuncio el avatar con `initials === ""` también muestra el megáfono.

## Plan de implementación

1. **Dominio + card.** Ampliar `PostType` a los 7 y agregar `Post.photos?` en `data/mock/feed.ts`. En `components/post-card.tsx`, agregar los 4 `BADGES` nuevos (comida honey `#9A7B1E`, siesta lavanda `#7B5FC0`, animo rosa `#C56486`, foto coral `#D9684A` — tokens en `app/globals.css`), render de `post.photos` (grid de thumbnails `rounded-2xl` en vez del placeholder) y megáfono si `initials === ""`. Verify: `npm run build` y los 3 posts del mock intactos.
2. **Helpers de aplicación.** Crear `lib/post-utils.ts` con `validateDescription`, `buildAudience`, `buildPost`, `currentTimeHHMM`, `makePostId` (puros). Verify: `npm run build`.
3. **Ruta.** Crear `app/publicar/page.tsx` (server, standalone sin sidebar): fondo, card `max-w-[580px]`, encabezado "Cancelar" (`<Link href="/">`) / "Nueva publicación" / "Publicar" (inerte por ahora); renderiza `<CreatePostShell baseKids currentUser />`. Verify: `npm run build`; `/publicar` responde.
4. **Shell del compositor.** Crear `components/create-post-shell.tsx` (`"use client"`): en mount lee `opdaycare.kids.v1` (try/catch) y mezcla con `baseKids` filtrando `room === "Soles"`. Estado: `recipients: string[]` (ids), `wholeRoom: boolean`, `type: PostType | null`, `description`, `photos: string[]` (dataURL), `touched` por grupo. Exclusividad: setear `wholeRoom` deselecciona y deshabilita las pills de niños. Fotos: `<input type="file" accept="image/*" hidden>` → `FileReader` → dataURL; quitar por thumb; max 4. Validación inline (grupos PARA/TIPO/DESCRIPCIÓN con mensajes propios). `<form onSubmit>`: si válido → `buildPost` → `localStorage["opdaycare.posts.v1"]` (unshift) → `router.push("/")`; si no, marca `touched`. CTA "Publicar" deshabilitado hasta válido (Enter interceptado como en SPEC 05.2). Devuelve foco al entrar y al errar. Verify: `npm run build` + Playwright.
5. **Feed con posts nuevos.** Crear `components/feed-shell.tsx` (`"use client"`): props `{ basePosts, currentUser }`; en mount lee `opdaycare.posts.v1` y renderiza `[...stored, ...basePosts]` bajo el divisor "PUBLICADO HOY". `app/page.tsx` pasa `feed.posts` y usa el shell. Verify: `npm run build`; `/` sin-JS intacta (mismatch evitado con `useEffect`).
6. **Entradas de navegación.** `components/compose-card.tsx`: render como `<Link href="/publicar">` conservando estilos. `components/sidebar/new-post-button.tsx`: `onClick` → `router.push("/publicar")` (el sidebar ya es client). Verify: `npm run build`.
7. **Chequeo final.** `npm run lint && npm run build` en limpio + revisión manual con Playwright MCP: entrada desde ambos accesos, estado inicial vacío, validaciones (Publicar deshabilitado/Enter revela errores), exclusividad "Toda la sala", fotos (agregar, quitar, max 4), publicar → post al tope del feed, recarga que persiste, Cancelar/Publicar navegan, móvil sin scroll horizontal.

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores ni warnings.

- [ ] `npm run build` termina correctamente.

- [ ] Desde el botón "Nueva publicación" del sidebar (desktop y drawer) y desde "Compartí un momento…" se llega a `/publicar`; "Cancelar" y "Publicar" vuelven a `/`.

- [ ] `/publicar` replica el mockup: card `max-w-[580px]`, encabezado, secciones PARA / TIPO / DESCRIPCIÓN / FOTOS y el slot dashed "Agregar".

- [ ] El compositor abre vacío: sin pill de niño ni tipo seleccionada y descripción vacía; "Publicar" deshabilitado.

- [ ] El selector PARA muestra las pills de los niños de Sala Soles (los 8 del mock y los agregados de SPEC 05 en esa sala) + "Toda la sala".

- [ ] Al elegir varios niños se marcan múltiples pills a la vez; el resumen del destinatario usa "familia de {A}, {B} y {C}".

- [ ] Activar "Toda la sala" deselecciona y deshabilita las pills individuales; desactivarla las restaura; no puede quedar activo junto con ninguna pill de niño.

- [ ] TIPO permite exactamente una de las 7 pills; DESCRIPCIÓN no vacía (trim) es obligatoria.

- [ ] FOTOS son opcionales en todo caso (incluso con tipo Foto); permite subir 1–4 imágenes con preview y quitar; al llegar a 4 desaparece "Agregar".

- [ ] Blur o intento de publicar (Enter) en un grupo inválido muestra "Elegí un tipo", "Elegí al menos un destinatario" o "Escribí una descripción" con `aria-invalid`, `aria-describedby` y `role="alert"`.

- [ ] "Publicar" se habilita solo con TIPO, destinatario y descripción válidos; Enter publica si es válido y si no marca todos los grupos `touched`.

- [ ] Al publicar con destinatarios concretos, el post lleva author del primer niño seleccionado y `audience` con las familias; con "Toda la sala", author "Sala Soles" (avatar genérico) y `audience` "Para: toda la sala".

- [ ] Tras publicar se navega a `/` y el post aparece al tope de "PUBLICADO HOY" con el badge del tipo, hora actual, likes/comentarios en 0 y sus fotos renderizadas.

- [ ] Recargar `/` conserva los posts guardados (`localStorage["opdaycare.posts.v1"]`) y siguen primero que los del mock.

- [ ] Los 3 posts del mock y sus badges renderizan igual que antes de este spec.

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

- [ ] En viewport móvil no hay scroll horizontal y la card ocupa el ancho disponible.

## Decisiones

- **Sí:** `/publicar` como página standalone sin sidebar. El mockup es una card centrada sobre el fondo; replicar el mockup manda.
- **Sí:** entrada desde el sidebar y desde "Compartí un momento…". En `feed.dc.html` ambas apuntan a `crear-publicacion.dc.html` (5 `href`).
- **Sí:** selector PARA múltiple con opciones de la sala actual (Soles): mock + agregados de SPEC 05. La maestra es de Sala Soles; "Toda la sala" es ese salón. La mezcla ocurre client-side (los agregados solo existen en localStorage), mismo patrón que `kids-shell`.
- **Sí:** exclusividad "Toda la sala" vs. niños concretos. Pedido explícito; evita un post "a todos" ambiguo, y la audiencia del feed queda sin contradicción.
- **Sí:** destinatario obligatorio. Sin selección el post no tiene a quién llegar; validación con "Elegí al menos un destinatario".
- **Sí:** ampliar `PostType` a los 7 tipos con sus badges. El compositor ofrece 7 pills y mapearlas a 3 perdería fidelidad y semántica.
- **Sí:** descripción obligatoria y fotos nunca obligatorias (ni en tipo Foto). "Solo las fotos no son obligatorias pero sí hay que validar".
- **Sí:** estado inicial vacío. Prefill del mockup (Mateo + Comida) haría la validación cosmética; el usuario elige explícitamente.
- **Sí:** validación al patrón SPEC 05/06: "Publicar" deshabilitado hasta válido + errores inline tras blur/intento. Cero estados de error nuevos que inventar en el mockup.
- **Sí:** persistencia en `localStorage["opdaycare.posts.v1"]` y feed-shell que mezcla posts guardados con el mock. Mismo patrón que `kids-shell`; clave versionada esperando el spec de DB.
- **Sí:** un solo post con audiencia múltiple (author = primer niño; "Para: familia de {A}, {B}…"). Generar N posts por niño inflaría el feed; `Post` es de un solo `author`.
- **Sí:** fotos hasta 4, `dataURL` en el post guardado. Funciona sin backend; tope corto por la cuota de localStorage.
- **No:** editar/borrar posts, detalle, likes/comentarios funcionales. Cada uno merece su spec (`detalle-publicacion.dc.html` es otra pantalla).
- **No:** envío a padres / backend / servidor de imágenes. Llega con el spec de DB; aquí la fuente transitoria es localStorage.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Cuota de localStorage con 4 dataURL grandes | Máx 4 fotos; validar tamaño/`try/catch` al persistir con aviso si falla |
| Ampliar `PostType` rompe `BADGES` o comparaciones | TS estricto y el `Record` en `post-card.tsx` fuerzan cubrir los 7 en build |
| Mismatch de hidratación entre el feed server y el shell | Lectura de `opdaycare.posts.v1` en `useEffect`; render inicial solo con props |
| Posts de "Toda la sala" con `initials === ""` | `PostCard` muestra megáfono cuando `initials === ""`, no solo con tipo `anuncio` |
| Drawer/sidebar cerrando sin navegar | `new-post-button` dentro del drawer client: al navegar se cierra y `push` a `/publicar` |

## Lo que **no** está en este spec

- Editar, borrar o ver detalle de publicaciones; likes y comentarios funcionales.
- Backend/API y envío de posts o notificaciones a los padres.
- Subida real de fotos a servidor (dataURL en localStorage es transitorio).
- Publicar para Estrellas/Lunitas o cambiar la sala.
- Feed agrupado por fecha o fechas dinámicas en los posts del mock.

Cada uno de esos, si llega, va en su propio spec.