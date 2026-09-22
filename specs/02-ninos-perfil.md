# SPEC 02 — Pantallas Niños y Perfil de niño

> **Estado:** Implementado
> ****Depende de:** SPEC 00 — Arquitectura, SPEC 01 — Home Feed
> ****Fecha:** 2026-09-22 
> ****Objetivo:** Implementar las pantallas Niños (listado) y Perfil de niño replicando los mockups `ninos.dc.html` y `perfil-nino.dc.html`, con datos mock de los 8 niños y navegación real desde el listado al perfil (`/kids/[id]`), reutilizando el layout y sidebar existentes, sin agregar funcionalidad extra.

## Alcance

**Incluye:**

- Ruta `app/kids/page.tsx` replicando `ninos.dc.html`: encabezado "GESTIÓN / Niños", botón "Agregar niño" inerte, input "Buscar niño…" con búsqueda funcional, sección "SALA SOLES" con "8 niños" y grid de 2 columnas con las 8 tarjetas (avatar, nombre, edad, padres vinculados, badge MANÍ/LACTOSA o chevron).
- Búsqueda funcional por nombre **con debounce as-you-type**: el input "Buscar niño…" vive en un Client Component `components/kid-search.tsx` que debouncea (\~300 ms) las teclas y navega con `router.replace` actualizando la URL a `/kids?q=<texto>` (o `/kids` si queda vacío); la página filtra los niños por nombre (substring, case-insensitive). El `<form>` GET con submit (Enter) se mantiene como fallback sin-JS (progressive enhancement).
- Estado vacío: cuando la búsqueda no tiene resultados se muestra un mensaje ("No se encontraron niños") y se mantiene el layout.
- Ruta `app/kids/[id]/page.tsx` replicando `perfil-nino.dc.html`: link "Volver a Niños" (real → `/kids`), encabezado con avatar + nombre + "X años · Sala Soles", botón "Editar" inerte, card de alergias/notas, card de datos (fecha de nacimiento, sala, ingreso), botón "Resumen del día" inerte y card "PADRES VINCULADOS" con parents (badge ACTIVA/PENDIENTE) + link "Vincular otro padre" inerte.
- Navegación real: cada tarjeta del listado navega a `/kids/[id]`; "Volver a Niños" vuelve a `/kids`.
- Sidebar: items **Feed →** `/` y **Niños →** `/kids` se convierten en links reales (`next/link`) con estado activo según la ruta actual; Avisos, Mi cuenta, "Nueva publicación" y logout siguen inertes.
- Datos mock de dominio en `data/mock/kids.ts`: los 8 niños con datos completos (avatar, edad, badges, alergias/notas, fechas, padres con estado) según el listado del mockup.
- Costura de aplicación `lib/kids.ts`: `getKids()`, `getKidById(id)` y `searchKids(query)`. Ningún archivo en `app/` ni `components/` importa desde `data/`.
- Componentes presentacionales en `components/` (tarjetas de niño y secciones del perfil).
- Responsive con el sidebar existente: grid del listado a 1 columna en viewports pequeños, columnas del perfil apiladas, drawer móvil igual que en `/`.
- Iconos SVG nuevos en `components/icons.tsx` según necesidad (chevron derecha, alerta, flecha izquierda, más punteado, etc.).
- Manejo de id inexistente en el perfil con `notFound()` de Next.js.

**Fuera de alcance (specs futuros):**

- CRUD de niños (Agregar, Editar, Vincular padre).
- Las pantallas `resumen-dia`, `vincular-padre`, `agregar-nino` (los enlaces quedan inertes).
- Autenticación, persistencia o API.
- Avisos, Mi cuenta, crear publicación, login.
- Fechas calculadas dinámicamente.

## Modelo de datos

Se introduce la única fuente de datos estáticos de niños. (No hay persistencia.)

```ts
// data/mock/kids.ts
export type ParentRole = "Mamá" | "Papá";
export type ParentStatus = "activa" | "invitación enviada";

export interface KidParent {
  name: string;
  initials: string;
  avatarBg: string;
  avatarColor: string;
  role: ParentRole;
  status: ParentStatus;
  statusLabel: "ACTIVA" | "PENDIENTE";
}

export interface KidNote {
  title: string;   // "Alergias y notas"
  text: string;
}

export interface Kid {
  id: string;           // slug p.ej. "mateo-fernandez"
  name: string;         // "Mateo Fernández"
  initials: string;     // "M"
  avatarBg: string;
  avatarColor: string;
  age: number;          // 3
  parentsCount: number; // 2 (coherente con padres.length)
  birthDate: string;    // "12 mar 2022"
  room: string;         // "Soles"
  enrollmentDate: string; // "feb 2025"
  badge?: { label: string; bg: string; text: string }; // "MANÍ" | "LACTOSA"
  note?: KidNote;
  parents: KidParent[];
}

export const kids: Kid[]; // 8 niños del mockup
```

Datos del listado tomados literalmente de `ninos.dc.html` (Mateo, Sofía, Benjamín, Valentina, Tomás, Emma, Lucas, Olivia con sus avatares/badges). El perfil de Mateo se copia de `perfil-nino.dc.html` con sus padres (Lucía activa, Diego pendiente). Para los otros 7 niños se fabrican datos coherentes con su badge y su contador de padres (p. ej. Tomás con nota de lactosa, Valentina sin padres).

La capa de aplicación expone la costura que consumen las pantallas:

```ts
// lib/kids.ts
import { kids, type Kid, type KidParent, type KidNote } from "@/data/mock/kids";

export type { Kid, KidParent, KidNote };

export function getKids(): Kid[] {
  return kids;
}

export function getKidById(id: string): Kid | undefined {
  return kids.find((kid) => kid.id === id);
}

export function searchKids(query: string): Kid[] {
  const q = normalize(query.trim());
  if (!q) return kids;
  return kids.filter((kid) => normalize(kid.name).includes(q));
}
```

Donde `normalize` elimina diacríticos (NFD) y baja a minúsculas, de modo que "sofia" encuentra a "Sofía".

## Arquitectura / Patrones

Sigue los principios de la **SPEC 00 — Arquitectura** (Clean Architecture pragmática a 4 capas, regla de dependencia hacia adentro).

**Archivos por capa:**

- **Dominio (tipos):** `data/mock/kids.ts` → `Kid`, `KidParent`, `KidNote`.
- **Infraestructura (fuente):** `data/mock/kids.ts` → constante `kids`.
- **Aplicación (casos de uso):** `lib/kids.ts` → `getKids()`, `getKidById(id)`, `searchKids(query)`. Sin JSX ni `"use client"`.
- **Presentación:** `app/kids/page.tsx`, `app/kids/[id]/page.tsx` (Server Components) + `components/` (tarjetas y secciones presentacionales, enlaces inertes salvo los declarados). Los únicos `"use client"` son el sidebar (drawer, ahora con `next/link`) y `components/kid-search.tsx`. El buscador solo orquesta navegación de URL (`router.replace` + `?q=`): no importa datos, el filtrado real corre server-side en `lib/kids.ts`.

Regla de flujo de datos: las rutas importan desde `lib/kids.ts` y pasan datos como props; ningún archivo en `app/` ni `components/` importa desde `data/`. Modifica `components/sidebar/nav.tsx` (existente de SPEC 01) para recibir el item activo y usar `next/link` en Feed y Niños. El listado envuelve `<KidSearch>` (Client Component) en un `<Suspense>` boundary; la URL (`?q`) es la única fuente de verdad de la búsqueda.

## Plan de implementación

1. **Datos mock.** Crear `data/mock/kids.ts` con tipos y `kids` (8 niños con datos de listado + perfil + padres). Verify: `npm run build` (TS estricto).
2. **Costura de aplicación.** Crear `lib/kids.ts` con `getKids()`, `getKidById(id)` y `searchKids(query)` re-exportando tipos de dominio. Verify: `npm run build`.
3. **Iconos.** Agregar a `components/icons.tsx` los SVG que falten (chevron-right, alerta, flecha-left, plus punteado) tomando los `viewBox`/trazos del mockup. Verify: `npm run build`.
4. **Navegación del sidebar.** Modificar `components/sidebar/nav.tsx`: prop `active` derivada de la ruta; Feed y Niños como `next/link` (`/` y `/kids`); Avisos/Mi cuenta siguen como botones inertes. Verify: build + clic en Nav.
5. **Pantalla Niños.** Crear componentes de listado en `components/` (encabezado con título/botón, tarjeta de niño como `<Link href="/kids/[id]">`, estado vacío) y el buscador `components/kid-search.tsx`; y `app/kids/page.tsx`: `await searchParams`, `const q = searchParams.q ?? ""`, lista = `searchKids(q)`. `KidSearch` es un Client Component (`"use client"`) con estado local inicializado desde `useSearchParams()`, debounce de 300 ms en `onChange` que navega con `router.replace(pathname + "?" + q)` (sin query si vacío; `replace` para no ensuciar el historial), skip de navegaciones redundantes (mismo valor ya commiteado) y sync del input con la URL (back/forward); envuelve el input en un `<form>` GET con submit (Enter) como fallback sin-JS. `app/kids/page.tsx` envuelve `<KidSearch>` en `<Suspense>`. Grid `grid-cols-1 md:grid-cols-2`. Verify: build + escritura as-you-type (foco conservado, URL con `?q=`) y fallback por Enter / sin-JS.
6. **Pantalla Perfil.** Crear componentes de perfil en `components/` (encabezado, card alergias/notas, card datos, card padres) y `app/kids/[id]/page.tsx` con `generateStaticParams()` retornando los 8 `kid.id` (genera las rutas en build) y consumiendo `getKidById`; caso id inexistente → `notFound()`. El layout usa `max-w-[820px]` y apila columnas en móvil. "Volver a Niños" es `<Link href="/kids">`. Verify: build + navegación desde el listado a cada niño y regreso + `/kids/no-existe` rinde la página 404 de Next sin crash.
7. **Chequeo final.** `npm run lint && npm run build` en limpio y revisión manual con Playwright MCP (listado, perfiles, navegación, búsqueda, responsividad).

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores ni warnings.

- [ ] `npm run build` termina correctamente (incluye generación de rutas dinámicas).

- [ ] `app/kids/page.tsx` y `app/kids/[id]/page.tsx` consumen datos vía `lib/kids.ts`; ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

- [ ] En `/kids` se ven las 8 tarjetas del mockup con textos y badges exactos (MANÍ, LACTOSA, VINCULAR cuando aplique, chevron en el resto).

- [ ] El botón "Agregar niño" se renderiza sin navegar.

- [ ] Escribir en "Buscar niño…" filtra as-you-type tras \~300 ms de pausa (soft navigation, sin recarga fuera de `/kids`) manteniendo la URL en `/kids?q=<texto>` y sin perder el foco del input.

- [ ] Con el input vacío (o sin `?q`) se muestran los 8 niños.

- [ ] Con un texto sin coincidencias se muestra el estado vacío sin romper el layout.

- [ ] El filtrado as-you-type corre server-side (`searchKids` en `lib/`); el Client Component solo navega la URL (`router.replace`). Sin JS, el submit del form (Enter) sigue filtrando vía GET.

- [ ] Clic en cada tarjeta navega a `/kids/[id]` y muestra el perfil del niño correspondiente (el aviso del badge coincide con la nota del perfil p. ej. Tomás → LACTOSA, Mateo → MANÍ).

- [ ] En el perfil se ven "Volver a Niños" (navega a `/kids`), "Editar", "Resumen del día" y "Vincular otro padre" inertes, la card de alergias/notas solo cuando el niño tiene nota, y la card de datos con fecha de nacimiento, sala e ingreso.

- [ ] La card "PADRES VINCULADOS" muestra los padres del mockup con su badge ACTIVA/PENDIENTE y el contador de padres del listado es coherente (`parentsCount === parents.length`).

- [ ] En `/kids/[id]` con un id inexistente se muestra la página 404 de Next (`notFound`), sin crash; las 8 rutas de niño se generan en build vía `generateStaticParams`.

- [ ] En el sidebar, "Niños" se ve resaltado al estar en `/kids` o `/kids/[id]` y "Feed" al estar en `/`; ambos navegan con clic real.

- [ ] En viewport `< lg` no hay scroll horizontal: drawer móvil y contenido apilado (grid 1 columna, perfil en una columna).

- [ ] Estilos visibles con la paleta exacta del mockup (fondo `#F6ECDF`, tarjetas `#FFFDF9`, gradiente peach→coral, badge de alergia `#FBD8CC/#D9684A`, badge VINCULAR `#F9D2DE/#C56486`, badge estado `#CFEBD8/#3E9B6C` y `#F7E7A6/#9A7B1E`).

## Decisiones

- **Sí:** rutas dinámicas `/kids/[id]`. Coherente con 8 niños distintos y navegación real; el mockup apunta a una sola página pero la intención es por-niño.
- **Sí:** convención de rutas en inglés (URLs y carpetas de `app/`). `/ninos` → `/kids`. Pantallas futuras: `agregar-nino` → `/kids/new`, `resumen-dia` → `/kids/[id]/day-summary`, `vincular-padre` → `/kids/[id]/parents/new`. Los textos visibles siguen en español.
- **Sí:** 8 niños completos con perfil. El listado declara contadores y badges; el perfil necesita datos por niño para no mostrar siempre a Mateo.
- **Sí:** `getKids()`, `getKidById(id)` y `searchKids(query)` en `lib/kids.ts` (capa de aplicación). Respeta la regla de dependencia de SPEC 00; el swap a API toca solo `data/`.
- **Sí:** búsqueda server-side vía `searchParams` + `searchKids()` en `lib/` (capa de aplicación). El filtrado real no mueve la lógica de `lib/`; el Client Component (`kid-search.tsx`) solo decora la entrada (debounce → navegación `?q`).
- **Sí:** Feed y Niños como único punto de navegación real lateral (relaja la decisión "enlaces inertes" de SPEC 01 solo para estos dos items; las rutas existen).
- **Sí:** todo lo demás inerte (agregar, editar, resumen del día, vincular padre, avisos, mi cuenta, nueva publicación, logout). Evita 404 y mantiene el alcance visual.
- **Sí:** texto del badge de alergia en el listado derivado de `kid.note` presente (MANÍ en Mateo, LACTOSA en Tomás) y badge VINCULAR cuando `parentsCount === 0`; el resto muestra chevron.
- **Sí:** fechas y textos estáticos idénticos al mockup. Cero lógica temporal.
- **Sí:** reutilizar el Sidebar responsive de SPEC 01 (mismo drawer) y los iconos existentes; solo se agregan los SVGs faltantes.
- **Sí:** filtrado as-you-type con debounce (\~300 ms) como experiencia principal de búsqueda. `kid-search.tsx` solo navega la URL (`router.replace` + `?q=`); el filtrado queda server-side en `lib/kids.ts`, sin romper la regla de dependencia ni duplicar lógica. Costo aceptado: 2º `"use client"`, wrapper `<Suspense>` y sync del estado con la URL.
- **Sí:** mantener el `<form>` GET con submit (Enter) como fallback sin-JS (progressive enhancement).
- **Sí:** búsqueda por nombre insensible a acentos (normalizar diacríticos en `searchKids`). Sin esto, "sofia" no encuentra a "Sofía" por la tilde; se normaliza en `lib/kids.ts` tanto query como nombre.
- **No:** filtrado en cliente importando `data/` desde un componente. Rompe la regla de dependencia de SPEC 00; se descarta.
- **No:** CRUD, resumen del día, vincular padre, persistencia. Cada uno merece su propio spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Datos de perfil de los 7 niños no mostrados en el mockup (padres, fechas, notas) son inventados | Se fabrican coherentes con badge y contador; se documentan en Spec como inventados. Mateo queda idéntico al mockup. |
| Id no encontrado rompe la ruta dinámica | `getKidById` retorna `undefined` → `notFound()` de Next (404). `generateStaticParams` genera las 8 rutas en build; cualquier otro id se resuelve on-demand y cae al 404. Se verifica con Playwright en `/kids/no-existe`. |
| El estado activo del nav puede quedar desincronizado en rutas anidadas | Se deriva activo con la ruta actual (`usePathname` en el sidebar client) prefijada (`/kids` activa `/kids/[id]`). |
| `searchParams` es async y puede faltar (`?q` ausente) | `q = searchParams.q ?? ""`; `searchKids("")` devuelve los 8. |
| El debounce llena el historial de navegación | `router.replace` (no `push`) mantiene una sola entrada por búsqueda. |
| El input pierde el foco al re-renderizar | El Client Component permanece montado durante la soft navigation; el estado local no se re-monta. |
| Estado del input desincronizado con la URL (back/forward o enlaces) | El estado inicial se lee de `useSearchParams()` y se sincroniza en un efecto ante cambios de `searchParams`. |
| Navegaciones redundantes con el mismo `q` | Se saltea `router.replace` si el valor ya fue commiteado. |
| Timer de debounce residual o `useSearchParams` sin `Suspense` rompe el build | Cleanup del timer en el efecto y `<Suspense>` alrededor de `<KidSearch>` en la página. |
| Filtrado case-sensitive traiciona expectativas | `toLowerCase()` en ambas partes. |
| Regresión en el sidebar existente | Criterios booleanos + chequeo visual con Playwright en `/`, `/kids` y un perfil. |

## Lo que **no** está en este spec

- Agregar/editar niños, vincular padres.
- Las pantallas resumen del día, vincular padre y agregar niño (enlaces inertes).
- Autenticación, persistencia o API.
- Avisos, Mi cuenta, Nueva publicación, login.
- Fechas calculadas.

Cada uno de esos, si llega, va en su propio spec.