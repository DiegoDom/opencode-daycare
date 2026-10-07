# SPEC 17 — Creación de entradas del feed en Supabase (staff, con o sin fotos)

> **Estado:** Approved\
****Depende de:** SPEC 00 — Arquitectura, SPEC 01 — Feed home, SPEC 07 — Crear publicación, SPEC 09 — Tabla `users`, SPEC 10 — Autenticación y protección de rutas, SPEC 12 — Mantenimiento de niños y salas, SPEC 15 — `invitations`/`parent_children`, SPEC 18 — Tablas `posts`/`post_children`/`post_photos` (base de datos)\
****Fecha:** 2026-10-07\
****Objetivo:** Reemplazar la creación de entradas con localStorage por publicaciones reales en Supabase —con o sin fotos—, que solo el staff/admin publica y cuyo feed lee desde la base de datos.

> **Hijo de la parte de datos:** SPEC 18 — Tablas `posts`, `post_children`, `post_photos` y bucket `post-photos`. Ese spec es la fuente de verdad del esquema (migración, RLS, seed); esta spec cubre el código de la app. La SPEC 18 debe implementarse **primero**.

## Por qué existe este spec

La creación de entradas ya funciona (SPEC 07) pero vive en `localStorage["opdaycare.posts.v1"]`: las entradas no se comparten entre dispositivos ni sesiones, el feed muestra 3 posts mock que nadie creó, y cualquier sesión activa —incluidos padres— llega a `/publicar`. Este spec migra el feed a Supabase con permisos por rol: solo `staff`/`admin` publican, los padres ven solo lo que les corresponde (entradas de sus hijos + anuncios de su sala), y las fotos van a Storage en vez de inflar filas con dataURLs.

Estado verificado de la base al momento de escribir (2026-10-07):

- Tablas en `public`: `daycares`, `users`, `rooms`, `children`, `invitations`, `parent_children` (todas con RLS).
- Policy precedent: predicado `exists` sobre `public.users` con `daycare_id`, `id = auth.uid()`, `status = 'active'` y `role in ('staff','admin')`.
- `children` solo tiene política `select` para staff/admin: **un padre no puede leer filas de** `children`. Por eso la visibilidad del padre sobre anuncios de sala se resuelve con `my_child_rooms()` (SPEC 18) y no con una política sobre `children`.
- Existe `public.set_updated_at()` (SPEC 08) y la función de hash de invites (SPEC 13) no se reutiliza aquí.

## Alcance

**Incluye:**

- **Tipos de dominio del feed** en `lib/feed-types.ts` (nuevo): `PostType`, `Post` (mismos campos que hoy exporta `data/mock/feed.ts`, sin el placeholder `photo?`). `lib/feed.ts` los re-exporta, así los consumidores (`components/feed-shell.tsx`, `components/post-card.tsx`) no cambian sus imports.
- **Feed desde BD** en `lib/feed.ts`:
  - `getFeedDisplay(user)` pasa a `async` y consulta `posts` (+ `post_photos`, `post_children`) filtrando por `daycare_id`, ordenado por `published_at desc`. El RLS decide qué filas ve cada rol: no hay lógica de visibilidad en la app.
  - Mapeo fila → `Post`: `author_name` (snapshot de la BD) → `initials` + colores con el helper nuevo `avatarColors(name)`; `time` = `HH:MM` de `published_at`; `publishedBy` = `"publicado por vos"` si `author_id` es el usuario de sesión, si no `"publicado por {nombre}"`; `audience` con `buildAudience()` (existente) sobre `post_children.child_full_name`, o `"Para: toda la sala"` cuando `room_id` tiene valor; `photos[].src` = la URL pública guardada.
  - `childrenLine` se computa: `{n} niños · {fecha}` (`Intl.DateTimeFormat` en español). Para staff/admin, `n` = conteo de `children` del daycare (RLS-scoped); para parent, `n` = conteo de `parent_children` propios.
  - `composePlaceholder` deja de venir del mock: constante `"Compartí un momento…"` en `lib/feed.ts`.
  - Se elimina `getFeedData()` y `FeedData` (sin consumidores reales).
- **Server Action de creación** en `lib/post-actions.ts` (nuevo, capa Aplicación, precedente `lib/kids-actions.ts`):
  - `createPostAction(draft: CreatePostDraft): Promise<CreatePostState>` con `CreatePostDraft { type, description, roomId: string | null, childIds: string[], photos: File[] }`.
  - Valida con `validateDescription` (existente), `roomId` o `childIds` (exclusivos), max 4 fotos, ≤5 MB c/u y mime `image/png|image/jpeg|webp` (doble chequeo del límite del bucket).
  - Genera el `id` del post con `crypto.randomUUID()` **antes** de subir, sube las fotos al path `{daycare_id}/{post_id}/{i}-{nombre}` con el cliente de servidor (`data/supabase/server`, sesión del usuario → RLS de Storage), arma las URLs públicas, e inserta `posts` (+ `post_children` si hay destinatarios específicos, + `post_photos` si hay fotos).
  - Defensa en profundidad: exige sesión `active` con rol `staff`/`admin` y devuelve `{ ok: false, error }` amigable; la puerta real sigue siendo el RLS de SPEC 18.
  - `revalidatePath("/")` al salir bien.
- **Selector de sala dinámico** en `/publicar`: la página pasa `rooms` (`getRooms()`, ya existe en `lib/kids.ts`) y **todos** los `kids` del daycare; el shell mantiene `selectedRoom` (default: primera sala), filtra la grilla de niños por sala y envía `room_id` o `childIds` a la action. Se elimina el filtro hardcodeado `room === "Soles"`.
- **Guard de rol en** `/publicar`: nuevo `app/(app)/publicar/layout.tsx` espejando `app/(app)/kids/layout.tsx` (redirect a `/` si no hay sesión, `status !== 'active'` o `role === 'parent'`).
- **Sin puntos de composición para parent**: `app/(app)/page.tsx` no renderiza `ComposeCard` y se oculta el botón "Nuevo post" del sidebar cuando `role === 'parent'`.
- **Limpieza del mock y localStorage**: se elimina `data/mock/feed.ts`; `components/feed-shell.tsx` pierde `POSTS_KEY`/`useEffect`/`setTimeout` (render puro de `posts`); `components/post-card.tsx` pierde la rama del placeholder dashed `photo?`; `lib/post-utils.ts` pierde `buildPost`, `makePostId`, `currentTimeHHMM` y `WHOLE_ROOM_AUTHOR`, y pasa a importar tipos de `lib/feed-types.ts`.
- **SPEC 01 y SPEC 07** se marcan `Obsoleto` con nota de reemplazo por este spec.
- **Seed de entradas de ejemplo**: `supabase/seed/0004_dev_posts.sql` (parte de datos, ver SPEC 18).

**Fuera de alcance (specs futuros):**

- Editar y borrar entradas (el botón "Editar" sigue inerte).
- Reacciones y comentarios (likes/comentarios siguen en 0 e inertes).
- Notificaciones de entrada nueva (`users.notify_on_post` existe, no se usa) y Realtime.
- Anuncio a toda la guardería (sala única por entrada, como hoy).
- Subir/editar `avatar_url` de usuarios; el avatar del autor se deriva del nombre.
- Título de entrada (el campo `title` del schema de referencia no tiene UI).
- Migrar las entradas que existan en `localStorage` de algún navegador (se descarta: dataURLs de un solo device; el seed las reemplaza).
- Rate limiting de la Server Action; limpieza de archivos huérfanos en Storage.

## Modelo de datos

La parte de base de datos vive en SPEC 18 (enum `post_type` con los 7 valores del dominio, `posts`, `post_children`, `post_photos`, `my_child_rooms()`, bucket `post-photos`). Esta spec solo introduce estructuras de la app:

```ts
// lib/feed-types.ts (nuevo) — dominio puro, sin dependencias
export type PostType =
  | "comida" | "siesta" | "actividad" | "logro"
  | "animo" | "foto" | "anuncio";

export interface Post {
  id: string;
  type: PostType;
  author: { name: string; initials: string; avatarBg: string; avatarColor: string };
  time: string;              // "14:20" desde published_at
  publishedBy: string;       // "publicado por vos" | "publicado por {nombre}"
  audience: string;          // "Para: familia de X" | "Para: toda la sala"
  recipients?: { name: string; initials: string; avatarBg: string; avatarColor: string }[];
  body: string;
  photos?: { src: string }[]; // URL pública desde post_photos
  likes: number;              // siempre 0 (fuera de alcance)
  comments: number;           // siempre 0
}
// Sin `photo?` (placeholder del mock, se retira).

// lib/post-utils.ts (mod)
export interface CreatePostDraft {
  type: PostType;
  description: string;
  roomId: string | null;   // "Toda la sala" ⇒ roomId con valor y childIds vacío
  childIds: string[];      // destinatarios específicos ⇒ roomId null y ≥1 child
  photos: File[];          // 0..4, se suben como File (no dataURL)
}
export function avatarColors(name: string): { avatarBg: string; avatarColor: string };

// lib/post-actions.ts (nuevo)
export type CreatePostState = { ok: boolean; error?: string };
export async function createPostAction(draft: CreatePostDraft): Promise<CreatePostState>;

// lib/feed.ts (mod)
export interface FeedDisplay { /* igual que hoy, + posts desde BD, childrenLine computado */ }
export async function getFeedDisplay(user: SessionUser): Promise<FeedDisplay>;
```

Convenios:

- El autor y los destinatarios se muestran desde **snapshots** en la BD (`posts.author_name`, `post_children.child_full_name`): el feed es un registro del momento en que se publicó.
- Colores de avatar: paleta fija del mock + hash determinista del nombre (`avatarColors`), sin leer `users.avatar_url`.

## Arquitectura / Patrones

Sigue SPEC 00: la lectura/mapeo vive en `lib/` (Aplicación), el acceso a Supabase solo en `data/` (Infraestructura), `app/` y `components/` no importan de `data/`.

- **Server Action en** `lib/post-actions.ts` (no route handler), precedente `lib/kids-actions.ts` / SPEC 14. El `File` viaja como argumento de la action.
- **Upload desde el server con la sesión del usuario** (`data/supabase/server`): la política de Storage de SPEC 18 valida el path con el `daycare_id` del JWT; no hay cliente de Storage en el browser.
- **Orden anti-huérfanos**: validar → subir fotos → insertar `posts`/`post_children`/`post_photos`. Si el insert falla después del upload quedan archivos huérfanos en Storage (visibles solo por URL, sin fila que los referencie); es el mal menor porque no hay política `delete` (riesgos abajo).
- **Visibilidad = RLS, no código**: `getFeedDisplay` no filtra por rol. El padre ve lo que la política de SPEC 18 permite; el parent query con `.eq("daycare_id", ...)` se intersecta con RLS.
- **Embeds de PostgREST**: `post_photos(url, position)` y `post_children(child_full_name)` traen los nombres por snapshot — no se embeddea `children` (RLS de SPEC 12 no deja al padre leerlo) ni `users` (solo existe `users_select_own`).
- **Guard de rol**: layout de ruta espejando `app/(app)/kids/layout.tsx` (redirect a `/`).
- La action llama `revalidatePath("/")`; el shell navega con `router.push("/")`.

**Archivos por capa:**

| Capa | Archivo | Qué aporta |
| --- | --- | --- |
| Dominio | `lib/feed-types.ts` (nuevo) | `PostType`, `Post` |
| Aplicación | `lib/feed.ts` (mod) | Lectura desde BD, mapeo, `childrenLine`, tipos re-exportados |
| Aplicación | `lib/post-utils.ts` (mod) | `CreatePostDraft`, `validateDescription`, `buildAudience`, `avatarColors`; sin `buildPost`/`makePostId`/`currentTimeHHMM`/`WHOLE_ROOM_AUTHOR` |
| Aplicación | `lib/post-actions.ts` (nuevo) | Server Action `createPostAction` |
| Infraestructura | `data/mock/feed.ts` (eliminado) | Fin del mock |
| Presentación | `app/(app)/page.tsx` (mod) | `await getFeedDisplay`, oculta compose para parent |
| Presentación | `app/(app)/publicar/page.tsx` (mod) | `rooms` + todos los `kids`, sin filtro "Soles" |
| Presentación | `app/(app)/publicar/layout.tsx` (nuevo) | Guard de rol |
| Presentación | `components/create-post-shell.tsx` (mod) | Selector de sala, `File[]`, submit a la action |
| Presentación | `components/feed-shell.tsx` (mod) | Sin localStorage; render puro |
| Presentación | `components/post-card.tsx` (mod) | Sin rama `photo?` |
| Presentación | `components/compose-card.tsx` / `components/sidebar/new-post-button.tsx` (mod) | Ocultos para `parent` |
| Specs | `specs/01-feed-home.md`, `specs/07-crear-publicacion.md` (mod) | Estado → `Obsoleto` + nota de reemplazo |

## Plan de implementación

> Requiere la SPEC 18 aplicada y con su seed (migración + `supabase/seed/0004_dev_posts.sql`) antes de empezar.

1. **Tipos de dominio.** Crear `lib/feed-types.ts` con `PostType`/`Post` (sin `photo?`); `lib/feed.ts` deja de importar de `data/mock/feed` y re-exporta desde `feed-types`; `lib/post-utils.ts` importa de `feed-types`. El mock sigue alimentando el feed. Verify: `npm run lint && npm run build`.
2. **Feed desde BD.** `getFeedDisplay` async: query de `posts` con embeds, mapeo (autor/audience/fotos/`childrenLine`), `composePlaceholder` constante; `app/(app)/page.tsx` y `app/(app)/publicar/page.tsx` hacen `await`. Verify: `/` muestra las entradas del seed con autor real, hora y audience; sin posts mock.
3. **Creación end-to-end.** `lib/post-actions.ts` (`createPostAction`: validación → upload → inserts → `revalidatePath`) + rewiring de `create-post-shell.tsx` (`photos` como `File[]` con preview local, submit a la action, error en `persistError`, `router.push("/")` en `ok`). Verify: publicar **sin foto** y **con 1–4 fotos** desde `/publicar`; ambas entradas aparecen arriba del feed con la imagen visible.
4. **Selector de sala.** `/publicar/page.tsx` pasa `rooms` y todos los `kids`; el shell agrega el dropdown de sala, filtra la grilla y envía `room_id`. Verify: cambiar de sala cambia los niños listados; un anuncio "Toda la sala" queda con `room_id` de la sala elegida y su audience es "Para: toda la sala".
5. **Permisos de UI.** Nuevo `app/(app)/publicar/layout.tsx` (redirect de parent); `app/(app)/page.tsx` sin `ComposeCard` y botón "Nuevo post" del sidebar oculto para `parent`. Verify: con sesión `parent@estrellas.test`, `/publicar` redirige a `/` y no hay ningún entry point de composición; staff/admin sí lo ven.
6. **Retiro de mock y localStorage.** Eliminar `data/mock/feed.ts`, `getFeedData`/`FeedData`, el manejo de `opdaycare.posts.v1` en `feed-shell.tsx`, la rama `photo?` de `post-card.tsx` y las utilidades muertas de `post-utils.ts`. Verify: `grep -r "opdaycare.posts.v1\|data/mock/feed\|getFeedData" app components lib` sin resultados.
7. **Specs obsoletas.** `specs/01-feed-home.md` y `specs/07-crear-publicacion.md`: `Estado: Obsoleto` + nota "&gt; **Reemplazado por:** SPEC 17 — … (el mock y localStorage fueron retirados)". Verify: ambos headers actualizados.
8. **Verificación final.** `npm run lint && npm run build`, matriz Playwright de los criterios de aceptación (staff con/sin foto, sala, guard/ocultamiento de parent, visibilidad del parent, error de foto &gt;5 MB) y probes de RLS de la SPEC 18 sin regresiones nuevas.

## Criterios de aceptación

- [ ] `npm run lint` y `npm run build` pasan sin errores ni warnings.

- [ ] Un staff publica una entrada **sin foto** desde `/publicar` y aparece arriba del feed con su nombre real, hora y audience correctos.

- [ ] Un staff publica una entrada **con 1–4 fotos**; las imágenes se renderizan en el grid del `PostCard` desde URLs de Storage (bucket `post-photos`).

- [ ] Una foto de &gt;5 MB o con mime distinto de PNG/JPG/WebP muestra error amigable y **no** crea fila ni archivo.

- [ ] Con más de una sala, el dropdown de `/publicar` filtra la grilla de niños y el anuncio "Toda la sala" queda ligado a la sala elegida (se verifica por su audience en el feed).

- [ ] Un anuncio de sala se ve para los padres de esa sala y **no** para padres de otra sala.

- [ ] Una entrada con destinatarios específicos se ve para el padre de ese niño y **no** para padres de otros niños; el padre solo ve como destinatarios a sus propios hijos.

- [ ] El feed de un parent muestra `childrenLine` con el conteo de sus hijos vinculados (no 0, no el conteo del daycare).

- [ ] Con sesión `parent`: `/publicar` redirige a `/`, y en el feed no hay `ComposeCard` ni botón "Nuevo post".

- [ ] El autor de entradas ajenas muestra "publicado por {nombre}"; las propias muestran "publicado por vos".

- [ ] `grep -r "opdaycare.posts.v1\|data/mock/feed\|getFeedData" app components lib` sin resultados.

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (`grep` limpio).

- [ ] Los criterios de RLS de la SPEC 18 pasan (anon 0 filas, parent aislado, staff por daycare).

- [ ] Las SPEC 01 y 07 quedan en estado `Obsoleto` con nota de reemplazo.

## Decisiones

- **Sí:** Server Action en `lib/` (precedente SPEC 14 / `kids-actions`), no route handler — mismo patrón de validación y error-estado que el resto del producto.
- **Sí:** subir las fotos desde la action con el cliente de servidor (sesión del usuario) en vez de un cliente de Storage en el browser — valida una sola vez y la política de Storage decide por el `daycare_id` del JWT.
- **Sí:** generar el `id` del post antes del upload para armar el path `{daycare}/{post}/{i}-…`; el costo son archivos huérfanos si el insert falla después (ver riesgos).
- **Sí:** `author_name` y `child_full_name` como **snapshots** en la BD — evita políticas nuevas sobre `users`/`children` para mostrar nombres y es semántica correcta de "publicado el…" (precedente: `invitations.full_name`).
- **Sí:** tipos en `lib/feed-types.ts` con re-export desde `lib/feed.ts` — los consumidores no cambian imports y no hay ciclos con `post-utils`.
- **Sí:** los 7 `PostType` del front mapean 1:1 al enum de SPEC 18 (incluye `animo`).
- **Sí:** `avatarColors(name)` con paleta fija + hash determinista; `users.avatar_url` se ignora hasta un spec de perfiles.
- **Sí:** guard por layout de ruta (`publicar/layout.tsx`) espejando el de `/kids`, más ocultar los entry points de composición para `parent`.
- **Sí:** marcado de SPEC 01 y 07 como `Obsoleto` dentro de este plan (son las specs del mock y de localStorage).
- **No:** editar/borrar entradas, reacciones, comentarios, notificaciones y Realtime — cada uno en su propio spec si llega.
- **No:** migrar entradas del `localStorage` de los usuarios — dataURLs de un solo device; el seed de SPEC 18 reemplaza el mock con datos compartidos.
- **No:** leer `children` ni `users` desde el feed (embeds blocked por RLS): snapshots en las tablas del feed y `my_child_rooms()` (SPEC 18) para el room del padre.
- **No:** ampliar `children_select` a padres — daría a los padres `birth_date`/`medical_notes` de sus hijos, que hoy son superficie de staff; es un spec aparte si se quiere.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Changelog 2026-04-28: desde **2026-10-30** las tablas nuevas de `public` no se exponen al Data API por defecto | SPEC 18 agrega el probe de exposición/grants (precedente SPEC 08); el criterio final juega el flujo completo por UI, que fallaría si la tabla no es visible. |
| El insert falla después del upload → archivos huérfanos en Storage | Aceptado: sin política `delete` no hay forma segura de limpiar desde la app; el archivo no es servido por ninguna fila. Limpieza manual/futura. |
| Un padre ve nombres de otros niños en el audience | `post_children` filtra por hijo vinculado: el padre solo ve las filas de sus propios hijos; el staff ve todas. |
| Padre de sala ve anuncios de sala con destinatarios de otros hijos | Un anuncio de sala no lleva `post_children`; audience es "Para: toda la sala". |
| Formato de hora depende de la TZ del server | Mismo comportamiento que `currentTimeHHMM` de SPEC 07 (producto monozona, dev local). |
| La SPEC 18 no está aplicada | El plan la declara prerequisito; el paso 2 falla visiblemente (tabla inexistente). |

## Lo que **no** está en este spec

- Editar y borrar entradas.
- Reacciones (likes) y comentarios — siguen inertes en la UI.
- Notificaciones (`notify_on_post`) y Realtime.
- Anuncio a toda la guardería (sala única por entrada).
- Gestión de avatares (`users.avatar_url`) y perfiles de usuario.
- Migración de entradas guardadas en `localStorage` de usuarios.
- Título de entrada (`posts.title` del schema de referencia).
- Rate limiting y limpieza de archivos huérfanos de Storage.

Cada uno de esos, si llega, va en su propio spec.