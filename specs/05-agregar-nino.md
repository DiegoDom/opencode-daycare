# SPEC 05 — Agregar niño desde el listado (modal, sin DB)

> **Estado:** Approved
> ****Depende de:** SPEC 00 — Arquitectura, SPEC 02 — Niños y Perfil
> ****Fecha:** 2026-09-22
> ****Enmienda 05.1 — Pulido UX (2026-09-23):** mejora validación inline, fecha con máscara + picker nativo y modal compacto; ver detalles marcados con *(05.1)*.
> ****Objetivo:** Permitir agregar un niño desde el botón "Agregar niño" del listado de Niños abriendo un modal que captura nombre completo, fecha de nacimiento y sala (Soles / Estrellas / Lunitas) más alergias y notas opcionales, y que guarda el nuevo niño en localStorage para verlo en el listado agrupado por sala y en la búsqueda, todo a nivel front sin DB.

## Alcance

**Incluye:**

- El botón "Agregar niño" de `components/kids-header.tsx` pasa de inerte a abrir el modal.
- Ventana modal (`role="dialog"`, `aria-modal`) que replica la tarjeta de `agregar-nino.dc.html`: encabezado con Cancelar / "Agregar niño" / Guardar, campos **NOMBRE COMPLETO**, **FECHA DE NACIMIENTO**, **SALA** (select), **ALERGIAS (ETIQUETAS)** y **NOTAS MÉDICAS**.
- Obligatorios: nombre no vacío, fecha válida en `dd/mm/aaaa` (fecha real y no futura) y sala seleccionada (por defecto "Soles"). Alergias y notas médicas opcionales.
- **Guardar deshabilitado** hasta que los 3 obligatorios sean válidos; Enter en el form guarda si es válido. *(05.1)* Validación inline con mensajes: el error de cada campo aparece tras `blur` o tras intentar guardar (se marcan ambos obligatorios como `touched`), con `aria-invalid` + `aria-describedby` y `role="alert"` en el texto de error; el borde del input pasa a `border-[#E8B4A8]`/`bg-[#FFF5F3]`. Mensajes: nombre → "Ingresa el nombre completo", fecha vacía → "Ingresa la fecha de nacimiento", incompleta → "Completa la fecha (dd/mm/aaaa)", inválida → "Fecha no válida", futura → "No puede ser una fecha futura".
- *(05.1)* **Fecha interactiva:** el input visible sigue `type="text"` `dd/mm/aaaa` con `inputMode="numeric"` pero formatea en vivo vía `formatBirthDateInput` (inserta `/` al tipear, acepta paste `12052023` → `12/05/2023`, preserva cursor). Botón calendario a la derecha abre un `<input type="date" hidden>` (`max` = hoy) vía `showPicker()`; elegir fecha escribe `dd/mm/aaaa` y marca el campo como tocado.
- Guardar → el niño nuevo se persiste en `localStorage` (clave `opdaycare.kids.v1`) y aparece en el listado.
- El listado pasa de una sección fija "SALA SOLES" a **agrupar por sala** (Soles, Estrellas, Lunitas según los datos). Los 8 niños del mock siguen al lado de los agregados.
- Los niños agregados aparecen al **inicio de su grupo de sala** (nuevo primero) y son **incluidos en la búsqueda** (`?q=`).
- Cierre del modal con Cancelar, tecla Esc o clic sobre el fondo.
- Derivación automática al guardar: iniciales del nombre, avatar (paleta de colores), edad calculada de la fecha de nacimiento, fecha de ingreso de hoy, `parentsCount: 0` (la tarjeta muestra badge VINCULAR), badge MANÍ/LACTOSA desde el texto de alergias y nota combinando alergias + notas médicas.
- Tarjetas de los niños agregados **no navegan** a `/kids/[id]` (render sin `<Link>`).
- Responsive: en móvil el modal ocupa todo el ancho con scroll interno (`max-h-[90vh]`). *(05.1)* compactado a `max-h-[min(85dvh,720px)]` `w-[min(520px,calc(100vw-24px))]` con header `sticky`, paddings `px-5 py-5` (desktop `px-[26px]`) y densificación (`py-[11px]` en inputs, `gap-3`, `mb-3.5`, textarea `min-h-[72px] rows=2 resize-none md:resize-y`) para eliminar scroll innecesario en desktop y dejar header siempre visible en móvil; alergias y notas siguen siempre visibles.

**Fuera de alcance (specs futuros):**

- Perfil `/kids/[id]` para niños agregados: su dato vive solo en localStorage (cliente) y la ruta se genera del mock estático; navegar daría 404. Llega con el spec de DB.
- Editar, eliminar o vincular padres.
- Backend/API: la persistencia real reemplaza localStorage.
- Navegación "post-guardado" (resumen del día, feed del niño).

## Modelo de datos

Reusa el tipo `Kid` de `data/mock/kids.ts` (SPEC 02). Un niño agregado es un `Kid` completo serializado en localStorage:

```ts
// localStorage["opdaycare.kids.v1"] → Kid[]
{
  id: "juan-perez-k3x9f2",   // slug(nombre) + "-" + timestamp36
  name: "Juan Pérez",
  initials: "JP",            // iniciales de las 2 primeras palabras
  avatarBg: "#F4B8CC",       // paleta cíclica
  avatarColor: "#C44A7A",
  age: 3,                    // años calculados al guardar
  parentsCount: 0,
  parents: [],
  birthDate: "12 may 2023",  // la fecha dd/mm/aaaa se formatea a "d mes aaaa"
  room: "Estrellas",         // "Soles" | "Estrellas" | "Lunitas"
  enrollmentDate: "sep 2026",// mes + año actual
  badge?: { label: "MANÍ" | "LACTOSA", bg: "#FBD8CC", text: "#D9684A" }, // si el texto de alergias incluye "maní" o "lactosa"
  note?: { title: "Alergias y notas", text: string } // alergias + notas médicas si hay algo
}
```

Salas: `["Soles", "Estrellas", "Lunitas"]`. La sección del listado escribe "SALA SOLES" / "SALA ESTRELLAS" / "SALA LUNITAS" + `n` con pluralización (`1 niño` / `n niños`). Si no hay alergias ni notas, `badge` y `note` quedan ausentes.

## Arquitectura / Patrones

Sigue los principios de la **SPEC 00 — Arquitectura** (Clean Architecture pragmática, regla de dependencia hacia adentro).

**Archivos por capa:**

- **Dominio:** `data/mock/kids.ts` → tipo `Kid` (reusado, sin cambios).
- **Aplicación:** `lib/kids.ts` (refactor mínimo: usa `normalize` desde `lib/kid-utils.ts`), `lib/kid-utils.ts` (helpers puros `normalize` y `matchesName`, sin importar `data/`), *(05.1)* nuevo `lib/kid-validation.ts` (helpers puros `parseBirthDate`, `isValidBirthDate`, `validateName`, `validateBirthDate`, `formatBirthDateInput`, `formatISOToInput`, `todayISO`; sin JSX ni `"use client"`, sin importar `data/`).
- **Infraestructura (fuente):** `localStorage["opdaycare.kids.v1"]` como fuente de los niños agregados, aislada dentro del único client component que la toca.
- **Presentación:** `components/kids-shell.tsx` y `components/add-kid-modal.tsx` (ambos `"use client"`), modificados `components/kids-header.tsx` (prop `onAdd`), `components/kid-card.tsx` (prop `link` opcional) y `components/icons.tsx` *(05.1 CalendarIcon)*, y `app/kids/page.tsx`. *(05.1)* `components/add-kid-modal.tsx` ahora importa validación/formateo desde `lib/kid-validation.ts`; `components/kids-shell.tsx` importa `parseBirthDate` desde `lib/kid-validation.ts`.

**Decisión de flujo:** el listado pasa a renderizarse dentro de `kids-shell.tsx` (client) porque mezcla datos del server (los 8 del mock, pasados como props) con datos de localStorage, y debe reagrupar por sala y reaccionar al guardado. La ruta sigue siendo Server Component: computa `searchKids(q)` en `lib/kids.ts` y lo pasa como prop `baseKids` (el HTML no-JS inicial sigue mostrando el listado filtrado). El shell filtra el conjunto mezclado con el mismo `matchesName` de `lib/kid-utils.ts`; **ningún archivo de** `app/` **ni** `components/` **importa desde** `data/` (verificable con grep; el cliente no arrastra el mock en el bundle).

## Plan de implementación

1. **Helpers compartidos.** Crear `lib/kid-utils.ts` con `normalize` (NFD + minúsculas) y `matchesName(name, query)`; refactorizar `lib/kids.ts` para usar `normalize` de ahí (sin cambio de comportamiento). Verify: `npm run build`.
2. **Botón interactivo.** En `components/kids-header.tsx`, agregar prop opcional `onAdd?: () => void`; con ella el botón "Agregar niño" pasa a `<button type="button" onClick={onAdd}>` con la misma apariencia. Verify: `npm run build`.
3. **Modal.** Crear `components/add-kid-modal.tsx` (`"use client"`, `role="dialog"` + `aria-modal`): overlay `bg-black/40` centrado, card `max-w-[520px]` con el encabezado Cancelar / "Agregar niño" / Guardar y los 5 campos del mockup (nombre, fecha `dd/mm/aaaa`, select de sala con las 3 salas, alergias, notas). Validación en vivo: Guardar deshabilitado mientras nombre, fecha real no-futura o sala estén mal; `<form onSubmit={preventDefault + onSave}>` (Enter guarda si es válido). Cierre con Cancelar, Esc y clic en el fondo. Prop `onSave(draft)` emite nombre, fecha, sala, alergias y notas. Verify: `npm run build`.
3.1. **(05.1) Pulido UX.** Crear `lib/kid-validation.ts` y mover allí `parseBirthDate`/`isValidBirthDate` + nuevos `validateName`, `validateBirthDate`, `formatBirthDateInput`, `formatISOToInput`, `todayISO`. En `components/add-kid-modal.tsx`: estados `touchedName/touchedDate`, errores `aria-invalid/describedby` + `role="alert"`, máscara de fecha con preservación de cursor, botón calendario que abre `<input type="date" hidden max=today>` vía `showPicker()` y convierte `yyyy-mm-dd` → `dd/mm/aaaa`, `onSubmit` marca ambos touched si inválido, header `sticky` y layout compacto `max-h-[min(85dvh,720px)]` `w-[min(520px,calc(100vw-24px))]` `py-[11px]` `gap-3` `mb-3.5` `min-h-[72px] rows=2`. Añadir `CalendarIcon` en `components/icons.tsx` y actualizar `components/kids-shell.tsx` para importar `parseBirthDate` desde `lib/kid-validation.ts`. Verify: `npm run build`.
4. **Shell del listado.** Crear `components/kids-shell.tsx` (`"use client"`): props `{ baseKids: Kid[]; query: string }`. En mount lee `opdaycare.kids.v1` (try/catch, fallback en memoria), mezcla base + agregados (agregados al inicio de su sala), agrupa por `kid.room`, filtra con `matchesName(query)`, renderiza encabezado (usa `KidsHeader` con `onAdd`), secciones por sala con `KidCard`, `KidsEmpty` si no hay resultados, y el `AddKidModal` abierto por el botón. `onSave` construye el `Kid` (id, iniciales, paleta, edad, `parentsCount: 0`, fecha de ingreso, badge/nota desde alergias) y persiste `opdaycare.kids.v1`. Devolución del foco al botón al cerrar. Verify: `npm run build`.
5. **Tarjeta sin link.** En `components/kid-card.tsx`, prop `link?: string`; si llega `null`, renderiza un `<div>` con las mismas clases (niños agregados) en vez del `<Link>`. Verify: `npm run build` + visual del listado intacto.
6. **Cablear la ruta.** En `app/kids/page.tsx`, reemplazar el render del encabezado, secciones y estado vacío por `<KidsShell baseKids={kids} query={q} />`; se mantienen `Sidebar`, `KidSearch` en `<Suspense>`, layout y grid. Limpiar imports sin uso. Verify: `npm run build`; `/kids` responde igual.
7. **Chequeo final.** `npm run lint && npm run build` en limpio + revisión manual con Playwright MCP: abrir modal desde el botón, validaciones (Guardar deshabilitado/ingreso), guardar un niño en "Estrellas" y verlo al inicio de su grupo, recargar la página y que persista, búsqueda que lo encuentre, cierre por Cancelar/Esc/fondo, móvil sin scroll horizontal.

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores ni warnings.

- [ ] `npm run build` termina correctamente.

- [ ] Clic en "Agregar niño" abre el modal; la URL sigue siendo `/kids` (sin navegación ni recarga).

- [ ] El modal muestra los 5 campos del mockup y el botón Guardar deshabilitado con los campos vacíos.

- [ ] Guardar se habilita solo cuando nombre no vacío, fecha real `dd/mm/aaaa` no futura y sala seleccionada.

- [ ] *(05.1)* Blur en nombre vacío muestra "Ingresa el nombre completo" con `aria-invalid` y `role="alert"`; blur en fecha vacía/incompleta/inválida/futura muestra el mensaje correspondiente ("Ingresa la fecha…", "Completa la fecha (dd/mm/aaaa)", "Fecha no válida", "No puede ser una fecha futura").

- [ ] *(05.1)* Tipeo de fecha inserta `/` automático y acepta paste `12052023` → `12/05/2023` sin perder el formato; el botón calendario abre el picker nativo (`max` = hoy) y al elegir fecha el input queda en `dd/mm/aaaa`.

- [ ] *(05.1)* Intentar guardar con Enter o clic cuando hay errores marca ambos campos como tocados y revela los mensajes (no guarda).

- [ ] Guardar con Enter funciona igual que con clic.

- [ ] Cancelar, Esc y clic sobre el fondo cierran el modal sin guardar.

- [ ] Tras guardar, el modal se cierra y el niño aparece al inicio de la sección de su sala.

- [ ] Recargar la página conserva el niño guardado (localStorage `opdaycare.kids.v1`).

- [ ] El listado se agrupa dinámicamente por sala y muestra "SALA SOLES", "SALA ESTRELLAS" y "SALA LUNITAS" según existan niños; el conteo usa pluralización correcta.

- [ ] La búsqueda (`?q=`) encuentra tanto a niños del mock como agregados.

- [ ] La tarjeta del niño agregado muestra iniciales, edad calculada, sala y badge VINCULAR, y **no** navega al pulsarla.

- [ ] Escribir "maní" o "lactosa" en alergias pinta el badge MANÍ/LACTOSA con la nota correspondiente; sin alergias/notas, ni badge ni nota.

- [ ] En viewport móvil el modal entra sin scroll horizontal y con scroll interno.

- [ ] *(05.1)* En desktop 1280×800 el modal completo entra sin necesidad de scroll; en móvil el header (Cancelar/Agregar niño/Guardar) queda `sticky` y siempre visible aunque el body scrollee.

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

## Decisiones

- **Sí:** persistencia en `localStorage` con clave versionada `opdaycare.kids.v1`. Es la única persistencia front razonable sin DB; la clave versionada permite migrar cuando llegue el spec de DB, que reemplaza esta fuente.
- **Sí:** listado renderizado por `kids-shell.tsx` (client). El único lugar que puede mezclar props/server con localStorage y reaccionar a guardados; la ruta sigue server y pasa `baseKids` filtrados (no-JS intacto). Se acepta como lectura pragmática de SPEC 00: los datos siguen fluyendo app → presentación por props.
- **Sí:** helper puro `lib/kid-utils.ts` compartido por `lib/kids.ts` y el shell. Evita duplicar el filtrado y evita que el cliente importe `data/mock/kids` (regla de dependencia incluida en el bundle).
- **Sí:** radio de salas "Soles / Estrellas / Lunitas", default "Soles" (coincide con la sala actual del listado).
- **Sí:** agrupar el listado por sala. De lo contrario un niño de "Estrellas" aparecería bajo un encabezado "SALA SOLES" mentiroso.
- **Sí:** Guardar deshabilitado hasta válido. Menos flujo de errores que diseñar; los campos obligatorios son solo 3. *(05.1)* Se complementa con mensajes inline (`touched` en blur + submit revela todo) y `aria-invalid/describedby` para no dejar al usuario sin feedback.
- **Sí:** campos opcionales alergias y notas del mockup. Fidelidad al mock; de alergias se derivan los badges existentes (MANÍ/LACTOSA por palabra clave, único vocabulario de badge del listado).
- **Sí:** niños agregados al inicio de su grupo de sala. Garantiza que el usuario vea el resultado de su acción sin buscar.
- **Sí:** tarjetas agregadas no navegables (`link: null`). `/kids/[id]` se genera del mock estático y no ve localStorage; un link daría 404.
- **Sí:** derivación automática de datos (iniciales, paleta, edad, ingreso, badge/nota). Cero campos extra que pedir al usuario.
- **Sí:** `<select>` nativo estilizado para la sala. Simple y accesible sin estado extra.
- **No:** editar, eliminar, vincular padres, perfil de los agregados. Cada uno merece su spec; el perfil real llega con la DB.
- **No:** uso de `useSearchParams` en el shell: la búsqueda sigue siendo la URL (`?q`) manejada por `KidSearch`; el shell filtra por `query` los agregados con el mismo helper.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| localStorage deshabilitado (private mode) | Lectura/escritura en try/catch con fallback a estado en memoria; la funcionalidad vive mientras dura la sesión. |
| Hidratación entre el HTML del server (8 niños) y el shell (que lee localStorage) | La lectura de `opdaycare.kids.v1` ocurre en `useEffect` tras el mount; el render inicial usa solo las props → sin mismatch. |
| El cliente arrastra el mock en el bundle | `lib/kid-utils.ts` sin importar `data/`; criterio de aceptación verificable con grep. |
| Duplicación del filtrado server/client | Un solo `matchesName` en `lib/kid-utils.ts` consumido por ambos lados. |
| Alguien linkea un niño agregado a `/kids/[id]` y da 404 | Las tarjetas agregadas no renderizan link; el perfil de nuevos niños va en el spec de DB. |
| Fecha no actualizada (edad/ingreso desactualizados en datos viejos) | Se calcula una sola vez al guardar, como el resto del mock estático de SPEC 02. |
| Máscara de fecha rompe cursor en mobile/IME | `formatBirthDateInput` preserva `selectionStart` con ajuste de `/`; testear borrado y paste. |
| `showPicker()` no soportado (Firefox viejo) | Fallback a `click()`/`focus()` del `<input type="date">`. |

## Lo que **no** está en este spec

- Perfil `/kids/[id]` para niños agregados (depende de DB).
- Editar, eliminar, vincular padres.
- Backend/API: localStorage es la fuente transitoria hasta el spec de DB.
- Navegación post-guardado hacia el feed o resumen del día.

Cada uno de esos, si llega, va en su propio spec.