# SPEC 06 — Vincular padre desde el perfil del niño (modal, sin backend)

> **Estado:** Approved **Depende de:** SPEC 00 — Arquitectura, SPEC 02 — Niños y Perfil, SPEC 05 — Agregar niño **Fecha:** 2026-09-23 **Objetivo:** Permitir vincular un padre/madre/tutor-a a un niño desde su perfil (`/kids/[id]`) abriendo un modal con nombre, email y parentesco obligatorios que valida en el front, genera un código de invitación solo visual y persiste el nuevo vínculo en localStorage con estado PENDIENTE, visible en la card PADRES VINCULADOS.

## Alcance

**Incluye:**

- El link "Vincular otro padre" de `components/kid-parents-card.tsx` pasa a ser un `<button>` que abre el modal.
- Ventana modal (`role="dialog"`, `aria-modal`) que replica `vincular-padre.dc.html`: encabezado "Vincular padre / a {nombre}" con X de cierre, banner azul informativo ("Le enviaremos un correo con un código para que active su cuenta. Solo verá el feed de {nombre}"), campos **NOMBRE DEL PADRE/MADRE**, **EMAIL** y **PARENTESCO** (pills Mamá / Papá / Tutor-a), dashed box **CÓDIGO DE INVITACIÓN** con 5 caracteres alfanuméricos y "Vence en 7 días", y CTA **Enviar invitación**.
- Los 3 campos son obligatorios: nombre no vacío (trim, más de 1 carácter), email válido (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) y parentesco seleccionado.
- Validación inline igual a SPEC 05.1: CTA deshabilitado hasta que los 3 sean válidos; el error de cada campo aparece tras `blur` o tras intentar enviar (se marcan todos `touched`), con `aria-invalid` + `aria-describedby` y `role="alert"`; borde `border-[#E8B4A8]`/`bg-[#FFF5F3]`. Mensajes: nombre → "Ingresa el nombre", email vacío → "Ingresa el email", inválido → "Email no válido", parentesco sin elegir → "Elige un parentesco".
- Código de invitación **solo visual**: se genera al abrir el modal (`generateInviteCode()`, 5 chars `A-Z0-9`), se muestra en el dashed box y no se envía a ningún backend.
- Al enviar: se construye un `KidParent` con iniciales (2 primeras palabras), `avatarBg`/`avatarColor` de la paleta existente, `role` elegido, `status: "invitación enviada"` / `statusLabel: "PENDIENTE"` (badge `#F7E7A6/#9A7B1E`), se inserta al **inicio** de `kid.parents[]` y se incrementa `parentsCount`. La card PADRES VINCULADOS refleja el nuevo padre sin recargar.
- Persistencia en `localStorage["opdaycare.kids.v1"]` (misma clave de SPEC 05): si el niño es de localStorage se actualiza su registro; si es del mock se crea un override parcial del `Kid` en la misma clave. Sobre la recarga el vínculo sigue en la card.
- Límite de 3 padres por niño: si `parents.length >= 3` el botón "Vincular otro padre" queda deshabilitado con el texto "Máximo 3 padres vinculados" y el modal no abre.
- Cierre con la X, Esc y clic sobre el fondo; devolución del foco al botón disparador; Enter en el form guarda si es válido (y si no, marca todos `touched`).
- Funciona para cualquier `Kid` cuyo perfil se renderice (los 8 del mock y los agregados de SPEC 05 cuando su perfil sea navegable); la capa de datos ya lo soporta.
- Responsive igual a SPEC 05.1: `max-h-[min(85dvh,720px)]`, `w-[min(480px,calc(100vw-24px))]`, header `sticky`.

**Fuera de alcance (specs futuros):**

- Envío real de email / API / backend: la validación fuerte (duplicados, expiración real del código, entrega) llega con el spec de DB.
- Editar, eliminar, reenviar invitación o cambiar el estado ACTIVA/PENDIENTE manualmente.
- Perfil `/kids/[id]` navegable para niños agregados (sigue generándose solo de los 8 del mock; la capa de datos lo tolera pero el agregado seguirá dando 404 hasta el spec de DB).
- Notificaciones / Avisos al padre invitado.

## Modelo de datos

Cambio único en el dominio más helpers puros nuevos:

```ts
// data/mock/kids.ts — único cambio en dominio
export type ParentRole = "Mamá" | "Papá" | "Tutor/a"; // antes "Mamá" | "Papá"

// lib/kid-validation.ts — helpers nuevos (sin JSX ni "use client", sin importar data/)
export function validateParentName(value: string): string | null;   // null = ok
export function validateParentEmail(value: string): string | null;  // regex ^[^\s@]+@[^\s@]+\.[^\s@]+$
export function generateInviteCode(): string;                       // 5 chars A-Z0-9

// localStorage["opdaycare.kids.v1"] → Kid[] (SPEC 05), ahora con parents mutados:
// nueva entrada en kid.parents[] =
//   { name, initials, avatarBg, avatarColor, role, status: "invitación enviada", statusLabel: "PENDIENTE" }
// childrenCount incrementado en 1.
```

El `Kid` no cambia de forma: `KidParent` ya existe en SPEC 02 con todos los campos que el modal emite. El duplicado de email no se bloquea en front (lo hará el backend).

## Arquitectura / Patrones

Sigue los principios de la **SPEC 00 — Arquitectura** (Clean Architecture pragmática, regla de dependencia hacia adentro).

**Archivos por capa:**

- **Dominio:** `data/mock/kids.ts` → tipo `ParentRole` ampliado (único cambio).
- **Aplicación:** `lib/kid-validation.ts` → `validateParentName`, `validateParentEmail`, `generateInviteCode` (helpers puros); `lib/kids.ts` consume los tipos sin cambios. Sin JSX ni `"use client"`.
- **Infraestructura (fuente):** `localStorage["opdaycare.kids.v1"]` como fuente de vínculos y del override de niños, aislada dentro del único client component que la toca.
- **Presentación:** `components/link-parent-modal.tsx` (nuevo, `"use client"`) y `components/kid-profile-shell.tsx` (nuevo, `"use client"`); modificado `components/kid-parents-card.tsx` (prop `onAdd`) y `app/kids/[id]/page.tsx` (pasa el `Kid` como prop al shell). Ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

Reutiliza el patrón de SPEC 05: el perfil pasa a renderizarse dentro de `kid-profile-shell.tsx` (client) porque mezcla el `Kid` del server (los 8 del mock, pasado como prop) con overrides/padres de localStorage y debe reaccionar al guardado sin recargar la página. La ruta sigue siendo Server Component: resuelve el `Kid` con `getKidById(id)` y lo pasa como prop `baseKid` (el HTML no-JS inicial sigue mostrando el perfil). La lectura de localStorage ocurre en `useEffect` (render inicial solo con la prop → sin mismatch de hidratación).

## Plan de implementación

1. **Dominio.** En `data/mock/kids.ts`, ampliar `ParentRole` a `"Mamá" | "Papá" | "Tutor/a"`. Verify: `npm run build` (TS estricto; revisar comparaciones existentes de `role`).
2. **Helpers de aplicación.** En `lib/kid-validation.ts`, agregar `validateParentName`, `validateParentEmail`, `generateInviteCode` (puros). Verify: `npm run build`.
3. **Card con onAdd.** En `components/kid-parents-card.tsx`, prop opcional `onAdd?: () => void`: el link "Vincular otro padre" pasa a `<button type="button" onClick={onAdd}>`; deshabilitado (mismo estilo + "Máximo 3 padres vinculados") cuando `kid.parents.length >= 3`. Verify: `npm run build`.
4. **Modal.** Crear `components/link-parent-modal.tsx` (`"use client"`, `role="dialog"` + `aria-modal`): overlay `bg-black/40` centrado, card `max-w-[480px]` con encabezado "Vincular padre / a {nombre}" + X, banner `#E3ECFB`, los 3 campos (`py-[13px]`), pills de parentesco (Mamá activa por defecto, Papá y Tutor-a inactivas), dashed box con código generado al abrir y "Vence en 7 días", CTA deshabilitado hasta válido. Validación inline con `touched`, `onSubmit` previene default (Enter guarda si es válido, si no marca todos touched), cierra con X/Esc/overlay devolviendo foco al botón. Prop `onSave(draft)` emite nombre, email y role. Verify: `npm run build`.
5. **Shell del perfil.** Crear `components/kid-profile-shell.tsx` (`"use client"`): prop `{ baseKid: Kid }`. En mount lee `opdaycare.kids.v1` (try/catch, fallback en memoria), resuelve `displayKid` (si el `baseKid.id` existe en localStorage usa ese registro, si no el propio `baseKid`), renderiza `KidProfileHeader`, `KidNoteCard`, `KidDataCard`, la columna derecha con `KidSummaryCard` y `KidParentsCard onAdd`, y el `LinkParentModal` abierto por `onAdd`. `onSave` construye el `KidParent` (iniciales, paleta, role, PENDIENTE), lo inserta al inicio, incrementa `parentsCount`, persiste `opdaycare.kids.v1` (override completo del `Kid` si es del mock) y actualiza el estado local. Verify: `npm run build`.
6. **Cablear la ruta.** En `app/kids/[id]/page.tsx`, reemplazar el render directo del perfil por `<KidProfileShell baseKid={kid} />` manteniendo `Sidebar`, `generateStaticParams` e `notFound()`. Limpiar imports sin uso (los componentes presentacionales se consumen ahora desde el shell). Verify: `npm run build`; `/kids/[id]` responde igual.
7. **Chequeo final.** `npm run lint && npm run build` en limpio + revisión manual con Playwright MCP: abrir el modal desde "Vincular otro padre", validaciones (CTA deshabilitado/ingreso), código 5 chars visible, guardar y ver el padre PENDIENTE al inicio de la card, recargar y que persista, límite de 3 deshabilitando el botón, cierre por X/Esc/overlay, móvil sin scroll horizontal.

## Criterios de aceptación

- [ ] `npm run lint` termina sin errores ni warnings.

- [ ] `npm run build` termina correctamente.

- [ ] En `/kids/[id]` el enlace "Vincular otro padre" abre el modal; la URL no cambia (sin navegación ni recarga).

- [ ] El modal muestra el banner informativo, los 3 campos, las 3 pills de parentesco y el dashed box con un código de 5 caracteres `A-Z0-9`; el CTA "Enviar invitación" está deshabilitado con los campos vacíos.

- [ ] Blur en nombre vacío muestra "Ingresa el nombre"; blur en email vacío/inválido muestra "Ingresa el email"/"Email no válido"; parentesco sin elegir muestra "Elige un parentesco"; todos con `aria-invalid`, `aria-describedby` y `role="alert"`.

- [ ] El CTA se habilita solo cuando nombre no vacío, email válido y parentesco seleccionado.

- [ ] Entrar con Enter guarda si es válido; si no, marca todos los campos como `touched` y revela los mensajes sin guardar.

- [ ] Al enviar, el modal se cierra y el nuevo padre aparece al inicio de la card PADRES VINCULADOS con badge PENDIENTE (`#F7E7A6/#9A7B1E`) y texto "invitación enviada".

- [ ] Recargar la página conserva el vínculo (localStorage `opdaycare.kids.v1`), tanto para niños del mock como para los agregados de SPEC 05.

- [ ] Con 3 padres ya vinculados, el botón "Vincular otro padre" queda deshabilitado mostrando "Máximo 3 padres vinculados" y el modal no abre.

- [ ] El email se valida en front (`a@b.c` acepta, `abc` rechaza); un email duplicado no se bloquea en front.

- [ ] El código de invitación es solo visual: se genera al abrir el modal y no hay envío real ni llamada de red.

- [ ] X, Esc y clic sobre el fondo cierran el modal y devuelven el foco al botón disparador.

- [ ] En viewport móvil el modal entra sin scroll horizontal, con header `sticky` y scroll interno.

- [ ] Ningún archivo en `app/` ni `components/` importa desde `data/` (verificable con grep).

## Decisiones

- **Sí:** `ParentRole` ampliado con `"Tutor/a"`. El mockup de vincular-padre incluye la tercera opción y el radio de la app debe respetarlo.
- **Sí:** validación de email simple en el front (regex). La validación fuerte, el bloqueo de duplicados y la entrega real van con el backend.
- **Sí:** código de invitación solo visual, generado al abrir el modal. Sin backend no hay expiración real ni envío; el dashed box es fiel al mockup.
- **Sí:** persistencia en `localStorage["opdaycare.kids.v1"]` mutando `parents` + override de `Kid` para los del mock. Misma clave que SPEC 05; un solo lugar de lectura/escritura.
- **Sí:** límite de 3 padres por niño. Pedido explícito; deshabilita el botón en vez de fallar al guardar.
- **Sí:** badge PENDIENTE para todo padre recién vinculado. Fiel al estado "invitación enviada" de SPEC 02 (Diego) y no asume cuenta activada.
- **Sí:** perfil renderizado por `kid-profile-shell.tsx` (client). Único lugar que puede mezclar props del server con localStorage y reaccionar al guardado; la ruta sigue server y pasa `baseKid` (no-JS intacto).
- **Sí:** el nuevo padre va al inicio de `parents[]`. El usuario ve el resultado de su acción sin buscar.
- **No:** envío de email / API / backend real. Requiere el spec de DB.
- **No:** editar, eliminar o reenviar invitaciones; cambiar estado manualmente. Cada uno merece su spec.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Mismatch de hidratación entre el perfil server (mock) y el shell (localStorage) | La lectura de `opdaycare.kids.v1` ocurre en `useEffect` tras el mount; el render inicial usa solo `baseKid` → sin mismatch. |
| Ampliar `ParentRole` rompe comparaciones o switch existentes | Buscar `ParentRole` y `"Mamá" | "Papá"` antes de firmar el cambio; TS estricto lo detecta en `npm run build`. |
| localStorage deshabilitado (private mode) | Lectura/escritura en try/catch con fallback a estado en memoria; el vínculo vive mientras dura la sesión. |
| Agregados de SPEC 05 aún no tienen perfil navegable (404) | La capa de datos ya soporta su override; el perfil navegable queda documentado como fuera de alcance hasta el spec de DB. |

## Lo que **no** está en este spec

- Backend / envío real de email / expiración real del código / bloqueo de duplicados.
- Editar, eliminar o reenviar invitaciones; cambio manual de estado ACTIVA/PENDIENTE.
- Perfil `/kids/[id]` navegable para niños agregados (sigue dando 404 hasta el spec de DB).
- Notificaciones / Avisos al padre invitado.

Cada uno de esos, si llega, va en su propio spec.