# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

Keep the `nextjs-agent-rules` markers intact so `next dev` upserts this block instead of appending a duplicate.

## Stack

- Next.js 16.3.5 (App Router, Turbopack default for `dev` and `build`), React 19.2.8, TypeScript strict, Tailwind v4, ESLint 9 flat config.
- `README.md` is untouched create-next-app boilerplate — ignore it.
- `CLAUDE.md` only imports this file (`@AGENTS.md`); keep guidance here.

## Commands

- `npm run dev` / `npm run build` / `npm start`
- `npm run lint` — runs the `eslint` CLI directly; `next lint` was removed in Next.js 16.
- No test runner is configured. Verify with `npm run lint`, `npm run build`, and manual browser checks (Playwright MCP).

## Layout

- App Router lives at the repo root in `app/` (no `src/`). Import alias `@/*` maps to the repo root.
- Tailwind v4 has no `tailwind.config.*`; theme tokens live in `app/globals.css` (`@import "tailwindcss"` + `@theme inline`).
- `references/pantallas/*.dc.html` are standalone design mockups for the daycare product and `references/screenshots/` holds screenshots. Build UI to match them (warm palette, Fredoka/Nunito fonts). They are reference-only, not bundled by the app.

## Arquitectura

Clean Architecture pragmática a 4 capas — convención en `specs/00-arquitectura.md` (SPEC 00), de la que dependen las specs 01+.

- **Dominio:** tipos puros sin dependencias (hoy viven en `data/mock/*.ts`).
- **Aplicación (casos de uso):** `lib/` — sin JSX ni `"use client"` (server-safe). Las pantallas consumen los datos solo vía funciones de aquí (p. ej. `getFeedData()` en `lib/feed.ts`).
- **Infraestructura (fuentes/adaptadores):** `data/` — hoy mocks (`data/mock/feed.ts`), única capa reemplazable por API/DB.
- **Presentación (frameworks & drivers):** `app/` (Server Components) + `components/` (presentacional).
- Regla de dependencia: siempre hacia adentro. `app/` **y** `components/` **jamás importan desde** `data/`**.**

## Specs

- Las specs van en `specs/`, numeradas `NN-slug.md` (`00-arquitectura.md` fija la convención Clean Architecture; las 01+ dependen de ella).
- **Cualquier spec que tenga que ver con la base de datos va en `specs/database/`, no en la raíz de `specs/`**: tablas, columnas, índices, constraints, RLS/políticas, migraciones, funciones, triggers, Realtime, Storage, seeds, backfills y cualquier trabajo de Supabase/Postgres. Númeran igual de forma global (`specs/database/08-tabla-daycares.md`), así que al crear una nueva, calcula el siguiente número contando las dos carpetas.
- `specs/database/` es la fuente de verdad de lo aplicado a la BD: si una spec de feature toca datos, su parte de base de datos se escribe allí (no en la spec de la feature) y ambas se referencian.

## Supabase

Supabase es el backend objetivo (capa de Infraestructura: reemplaza los mocks de `data/mock/`). Estado actual: **2 tablas creadas** (`daycares`, `users`), **2 enums** (`user_role`, `user_status`) y **4 políticas RLS** (2 de `users`, 2 de `daycares`), todo con sus migraciones aplicadas; el resto del diseño sigue sin implementar. El diseño de referencia vive en `../07-DB-Schema/opendaycare-database-schema.md` (exposto como project reference `docs`) y es la fuente de verdad para crear el schema. Toda spec de base de datos se escribe en `specs/database/` (ver sección Specs).

- **Acceso a la BD:** vía MCP de Supabase, no por código. `apply_migration` para DDL (migraciones versionadas), `execute_sql`/`query_logs` solo para lectura y diagnóstico. Nunca inventes `gen_random_uuid()`/ids: no hardcodees IDs generados en migraciones de datos.
- **Patrón de migraciones:** el SQL se escribe commiteado en `supabase/migrations/<YYYYMMDDHHMMSS>_<nombre>.sql`, con el timestamp **UTC** del momento (14 dígitos, el mismo reloj que usa `apply_migration`; ej. `20261005182418_create_daycares.sql`). Se aplica con `apply_migration` (MCP) y, si la `version` que devuelve difiere del prefijo del archivo, se **renombra el archivo** para que repo e historial no divergan — sin eso el primer `db push` re-aplicaría la migración. El archivo commiteado es el artefacto revisable en diff; el MCP es el mecanismo de aplicación y versionado. `apply_migration` es el **único** mecanismo de DDL: `execute_sql` no escribe DDL.
- **`public` concede `arwdDxtm` a `anon` y `authenticated` por `default privileges`:** el ACL es permisivo por omisión, así que **el RLS es la única puerta** y la ausencia de `grant` no significa que la tabla esté cerrada. Con RLS habilitado y cero políticas, `anon` tiene el privilegio `SELECT` (`has_table_privilege('anon', …, 'SELECT')` es `true`) pero ve **0 filas** — ese deny-all es la posición segura por defecto y es la que tienen las tablas nuevas hasta que su spec aplique políticas.
- **El seed no es una migración.** Los seeds van en `supabase/seed/<NNN>_<nombre>.sql` y se aplican con `execute_sql`, **nunca** con `apply_migration`: `list_migrations` no los muestra y un `db push` no los re-aplica. El motivo es concreto — un seed escribe en tablas internas de GoTrue (`auth.users`, `auth.identities`) cuya forma cambia entre versiones y contiene credenciales de desarrollo, y eso no pertenece al historial de migraciones, que es el registro de la forma del esquema. El archivo sí queda versionado y revisable en diff. Hazlos **idempotentes**: `where not exists` en los `insert` y `is distinct from` en los `update`, para que una segunda corrida no cree filas ni bumpee `updated_at`.
- **`revoke execute` en toda función de `public`.** `default privileges` deja el schema ejecutable: Postgres otorga `EXECUTE` a `PUBLIC` en toda función nueva, y `anon` y `authenticated` heredan de `PUBLIC`. Una `SECURITY DEFINER` en `public` sin ese revoke es un endpoint público vía `/rest/v1/rpc/<fn>` que corre con los privilegios del dueño. El advisor `anon_security_definer_function_executable` es la segunda línea de detección, no la primera: el `revoke` va en la misma migración, justo después del `create or replace`.
- **Skills obligatorias:** carga `supabase` antes de cualquier tarea de Supabase (auth, RLS, migraciones, Edge Functions, Realtime, Storage, logs) y `supabase-postgres-best-practices` antes de escribir o alterar SQL, índices, RLS o funciones. La skill `supabase` manda leer `https://supabase.com/changelog.md` para breaking changes antes de implementar — Supabase cambia rápido, no confíes en memoria de entrenamiento.
- **Trampas de seguridad (resumen de la skill):** RLS habilitado en toda tabla de schema expuesto (`public`); `service_role`/secret key nunca en cliente (`NEXT_PUBLIC_*` va al navegador); `user_metadata` es editable por el usuario → autorizaciones en `app_metadata`; vistas con `security_invoker = true`; UPDATE necesita política SELECT o devuelve 0 filas en silencio; usa `TO authenticated` + predicado de ownership, nunca solo `TO authenticated`.
- **Verifica:** tras cualquier migración, ejecuta un query de prueba (`list_tables`/`execute_sql`) y `get_advisors('security')` + `get_advisors('performance')`. El lint INFO `rls_enabled_no_policy` es esperado en tablas con RLS y cero políticas: no es una fuga, se demuestra por probe.
- **Pendiente de montar:** falta el cliente (`@supabase/supabase-js` + `@supabase/ssr` para SSR en App Router) y la CLI de Supabase (`npx supabase` — sin ella no hay `db push`, stack local ni Edge Functions). Credenciales: `SUPABASE_DB_PASSWORD` en `.env` (ver `.env.example`) — nunca commitear `.env`.

## Next.js 16 gotchas

Read `node_modules/next/dist/docs/` before writing code; these differ from older Next.js:

- Request APIs are async: `await params`, `await searchParams`, `await cookies()`, `await headers()`, `await draftMode()`. Prefer the generated types `PageProps<'/route'>`, `LayoutProps<'/'>`, `RouteContext` (regenerate with `npx next typegen`).
- `middleware.ts` is now `proxy.ts` exporting `proxy()`; nodejs runtime only.
- `revalidateTag(tag, profile)` now requires a second `cacheLife` argument (e.g. `'max'`). `updateTag`/`refresh` (server actions only) come from `next/cache`.
- Every parallel-route slot needs an explicit `default.js` or the build fails.
- Prefer `cacheComponents: true` (replaces `experimental.ppr` / `dynamicIO` / `useCache`).

## MCP / tooling

- Playwright MCP (configured in `opencode.json`): put every artifact it generates (screenshots, console logs, snapshots) under `.playwright-mcp/` (gitignored).
- Supabase MCP: connected to the project (`list_tables`, `apply_migration`, `execute_sql`, `get_advisors`, `query_logs`, branches, edge functions).
- Context7 MCP: use it to pull current framework/library docs.
- Spec-driven skills live in `.agents/skills/` (`spec`, `spec-impl`); specs go in `specs/` — features en la raíz, base de datos en `specs/database/` (ver sección Specs).

## Context Mode

Use Context Mode whenever an operation may produce a large amount of
output or require processing multiple files.

Prefer Context Mode for:

- Searching across many files.
- Analyzing large files.
- Processing JSON, logs, CSV, XML, or other large datasets.
- Running commands with potentially large output.
- Batch operations across multiple files.
- Extracting structured information from large command results.

Prefer `ctx_search` for searching indexed content.

Prefer `ctx_execute_file` when analyzing a large individual file.

Prefer `ctx_batch_execute` when multiple independent operations can be
performed together.

Avoid dumping entire files or large command outputs into the model
context when Context Mode can process them externally.

Use normal tools directly when the output is small and targeted.