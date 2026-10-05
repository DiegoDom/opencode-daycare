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

## Supabase

Supabase es el backend objetivo (capa de Infraestructura: reemplaza los mocks de `data/mock/`). Estado actual: **BD vacía** — 0 tablas, 0 migraciones. El diseño de referencia vive en `../07-DB-Schema/opendaycare-database-schema.md` (exposto como project reference `docs`) y **no está implementado en la BD**: es la fuente de verdad para crear el schema.

- **Acceso a la BD:** vía MCP de Supabase, no por código. `apply_migration` para DDL (migraciones versionadas), `execute_sql`/`query_logs` solo para lectura y diagnóstico. Nunca inventes `gen_random_uuid()`/ids: no hardcodees IDs generados en migraciones de datos.
- **Skills obligatorias:** carga `supabase` antes de cualquier tarea de Supabase (auth, RLS, migraciones, Edge Functions, Realtime, Storage, logs) y `supabase-postgres-best-practices` antes de escribir o alterar SQL, índices, RLS o funciones. La skill `supabase` manda leer `https://supabase.com/changelog.md` para breaking changes antes de implementar — Supabase cambia rápido, no confíes en memoria de entrenamiento.
- **Trampas de seguridad (resumen de la skill):** RLS habilitado en toda tabla de schema expuesto (`public`); `service_role`/secret key nunca en cliente (`NEXT_PUBLIC_*` va al navegador); `user_metadata` es editable por el usuario → autorizaciones en `app_metadata`; vistas con `security_invoker = true`; UPDATE necesita política SELECT o devuelve 0 filas en silencio; usa `TO authenticated` + predicado de ownership, nunca solo `TO authenticated`.
- **Verifica:** tras cualquier migración, ejecuta un query de prueba (`list_tables`/`execute_sql`) y `get_advisors('security')` + `get_advisors('performance')`.
- **Pendiente de montar:** falta el cliente (`@supabase/supabase-js` + `@supabase/ssr` para SSR en App Router), la CLI de Supabase (`npx supabase`) y el directorio `supabase/migrations/`. Credenciales: `SUPABASE_DB_PASSWORD` en `.env` (ver `.env.example`) — nunca commitear `.env`.

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
- Spec-driven skills live in `.agents/skills/` (`spec`, `spec-impl`); specs go in `specs/` (`00-arquitectura.md` fija la convención Clean Architecture; las specs de features numeradas 01+ dependen de ella).

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