# SPEC 00 — Fundamentos de arquitectura (Clean Architecture pragmática)

> **Estado:** Aprobado 
> ****Depende de:** —
> ****Fecha:** 2026-09-18 
> ****Objetivo:** Fijar en una sola capa de referencia la arquitectura en capas del proyecto —mapeada a Clean Architecture de forma pragmática— para que todas las specs de features (01+) la hereden sin tener que repetirla.

## Por qué existe este spec

Cada spec de feature necesita saber dónde cae su código (datos, lógica, UI). Sin una capa de referencia, cada spec re-escribiría "la arquitectura" con su propio criterio. Este spec centraliza esa convención una sola vez; los specs de features la referencian y solo declaran sus archivos por capa.

## Alcance

**Incluye:**

- Mapeo pragmático de Clean Architecture a 4 capas: dominio, aplicación, infraestructura, presentación.
- Regla de dependencia: las dependencias apuntan siempre hacia adentro.
- Invariantes de capas y flujo de datos entre ellas.
- La costura `lib/feed.ts` (`getFeedData()`) como frontera de intercambio de fuente de datos.
- La plantilla que todo spec de feature debe incluir ("Archivos por capa").
- La obligación de que los specs 01+ listan `> **Depende de:** SPEC 00 — Arquitectura` en su header.

**Fuera de alcance (specs futuros):**

- Folders estrictos `domain/`, `application/`, `infra/`. Hoy serían carpetas casi vacías; se adoptan si la complejidad lo justifica.
- Decisiones de librerías, patrones de UI, estado global o testing. Cada una va en su spec.
- Autenticación, base de datos o API real. Solo se declara aquí *dónde* irá esa fuente cuando exista.
- Repetición de esta convención dentro de cada spec de feature.

## Modelo de datos

Este spec no introduce estructuras de datos. Solo define dónde viven las que introduzcan los specs de features.

## Arquitectura / Patrones

### Mapeo a Clean Architecture (pragmático)

Cuatro capas. Los nombres de carpetas son la convención actual y pueden migrar cuando haya complejidad real (ver Decisiones).

| Capa CA | Carpeta hoy | Responsabilidad | Reglas | Ejemplo actual |
| --- | --- | --- | --- | --- |
| **Dominio** | `data/mock/*.ts` (tipos) | Entidades y reglas de negocio puras: tipos, interfaces, constantes de dominio. | Sin dependencias de infraestructura ni de React/Next. | `Post`, `FeedData`, `PostType` |
| **Aplicación** | `lib/` | Casos de uso: orquestan qué datos necesita cada pantalla. No saben de dónde salen los datos. | Sin JSX ni `"use client"` (server-safe). Son la frontera de intercambio de fuente. | `lib/feed.ts` → `getFeedData()` |
| **Infraestructura** | `data/` | Adaptadores y fuentes concretas de datos: hoy mocks estáticos, mañana API/DB. | Única capa que se reemplaza. Siempre exportada tipada. | `data/mock/feed.ts` → `feedData` |
| **Presentación** | `app/` + `components/` | Frameworks & drivers: rutas Server Component y componentes presentacionales. | Nunca importar infraestructura directa. Entran a los datos solo vía la capa de aplicación. | `app/page.tsx`, `components/post-card.tsx` |

### Regla de dependencia

Las dependencias apuntan siempre hacia adentro. Ninguna capa conoce a las que están fuera de ella.

```
            ┌─────────────────────────────────────┐
            │  Presentación  app/ + components/    │
            └──────────────────┬──────────────────┘
                               │ importa
            ┌──────────────────▼──────────────────┐
            │  Aplicación  lib/  (casos de uso)    │
            └──────────────────┬──────────────────┘
                               │ importa
        ┌──────────────────────▼──────────────────────┐
        │  Dominio  tipos sin dependencias            │
        └──────────────────────▲──────────────────────┘
                               │ implementa/concreta
            ┌──────────────────┴──────────────────┐
            │  Infraestructura  data/  (fuentes)   │
            └─────────────────────────────────────┘
```

- **Presentación → Aplicación:** las rutas llaman a funciones de `lib/` (p. ej. `getFeedData()`), nunca a `data/`.
- **Aplicación → Dominio:** los casos de uso operan sobre los tipos de dominio.
- **Infraestructura → Dominio:** la fuente concreta implementa la forma que el dominio define.
- **El dominio no importa a nadie.**

### Flujo de datos para una pantalla

1. La ruta (`app/`) importa el caso de uso desde `lib/`.
2. El caso de uso devuelve datos tipados por el dominio.
3. La ruta pasa esos datos como props a componentes presentacionales.
4. Los componentes renderizan; nunca piden datos por su cuenta.

### Invariantes

- Ningún archivo en `app/` o `components/` importa desde `data/`.
- `lib/` no contiene JSX ni `"use client"`; es compatible con Server Components (verificar con `npm run build`).
- Los tipos de dominio no importan desde ninguna otra capa.
- El reemplazo de una fuente por otra (mock → API) toca solo `data/` y, a lo sumo, el interior del caso de uso. Nunca `components/` ni `app/`.
- Todo dato expuesto al render está tipado por el dominio.

### Plantilla para specs de features

Todo spec de feature (01+) incluye en su sección "Arquitectura / Patrones":

- Referencia a este spec: "Sigue los principios de caso **SPEC 00 — Arquitectura**."
- Una sub-lista **"Archivos por capa"** que mapea cada archivo nuevo/modificado a su capa (dominio / aplicación / infraestructura / presentación) y a su carpeta.

## Plan de implementación

Este spec es documental: su "implementación" consiste en estos 3 pasos y termina cuando SPEC 01 y AGENTS.md quedan alineados.

1. Escribir este spec con el mapeo, la regla de dependencia, los invariantes y la plantilla.
2. Actualizar `specs/01-feed-home.md` (header con dependencia, sección de arquitectura apuntando a este spec, costura `lib/feed.ts` en modelo de datos/plan/criterios).
3. Actualizar `AGENTS.md` (sección de arquitectura + corrección de la línea obsoleta del MCP).

## Criterios de aceptación

- [ ] `specs/00-arquitectura.md` existe con las 4 capas, la regla de dependencia, invariantes y plantilla.

- [ ] `specs/01-feed-home.md` declara `> **Depende de:** SPEC 00 — Arquitectura` en su header.

- [ ] La sección "Arquitectura / Patrones" de SPEC 01 referencia SPEC 00 y lista archivos por capa.

- [ ] Ningún componente o página importa desde `data/` (verificable con grep).

- [ ] SPEC 01 usa la costura `getFeedData()` de `lib/feed.ts` para consumir el feed.

- [ ] `AGENTS.md` documenta la convención y su puntero a este spec.

- [ ] El header de todo spec de feature futuro incluye la dependencia a SPEC 00.

## Decisiones

- **Sí:** Clean Architecture pragmática a 4 capas (dominio, aplicación, infraestructura, presentación). Respeta la regla de dependencia sin crear carpetas vacías.
- **No:** folders estrictos `domain/` / `application/` / `infra/` desde el spec 01. Sobre-carga de estructura para una app de menos de 10 pantallas sin lógica de negocio; se adoptan cuando haya complejidad real.
- **Sí:** `specs/00-arquitectura.md` como spec de fundación. Centraliza la convención y hace que los specs 01+ la hereden vía "Depende de".
- **Sí:** nota breve en `AGENTS.md`. El flujo `/spec` lee AGENTS.md en su fase de contexto, así los specs futuros arrancan con la convención a la vista.
- **Sí:** costura `getFeedData()` en `lib/feed.ts`. La página consume un contrato, no el mock; el swap a API real toca solo `data/`.
- **No:** import directo de `data/mock/feed.ts` desde `app/`. Deja la regla de dependencia rota desde el día 1 y el swap a API tocaría el render.
- **Sí:** tipos de dominio conviviendo hoy en `data/mock/feed.ts`. Son puros y sin dependencias; migrar de carpeta no cambia su naturaleza y no agrega valor hoy.
- **No:** repetir esta convención dentro de cada spec de feature. Cada spec refiere a este y solo declara sus archivos por capa.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Un maintainer importa el mock directo desde un componente, rompiendo la regla de dependencia | Invariante + criterio de aceptación verificable con grep ("ningún componente importa de `data/`"). |
| La capa de aplicación (hoy la costura `getFeedData()`) se siente vacía y se tiende a escribir lógica en los componentes | Invariante de `lib/` (sin JSX, server-safe) y plantilla "Archivos por capa" en cada spec. |
| Tentación futura de endurecer a CA estricta con folders `domain/`/`application/`/`infra/` | Decisión documentada como "No" mientras no haya complejidad real; revertible en un spec futuro si aparece. |
| Los specs de features olvidan la dependencia a SPEC 00 | Criterio de aceptación explícito en este spec + nota en AGENTS.md. |

## Lo que **no** está en este spec

- Folders estrictos `domain/` / `application/` / `infra/`.
- Decisiones de librerías, UI, estado global o testing. Cada una va en su spec.
- Autenticación, base de datos o API real. Este spec solo declara dónde irá esa fuente cuando exista.
- La descripción de cualquier pantalla en particular.

Cada uno de esos, si llega, va en su propio spec.