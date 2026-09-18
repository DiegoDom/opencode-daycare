<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

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

## Next.js 16 gotchas
Read `node_modules/next/dist/docs/` before writing code; these differ from older Next.js:
- Request APIs are async: `await params`, `await searchParams`, `await cookies()`, `await headers()`, `await draftMode()`. Prefer the generated types `PageProps<'/route'>`, `LayoutProps<'/'>`, `RouteContext` (regenerate with `npx next typegen`).
- `middleware.ts` is now `proxy.ts` exporting `proxy()`; nodejs runtime only.
- `revalidateTag(tag, profile)` now requires a second `cacheLife` argument (e.g. `'max'`). `updateTag`/`refresh` (server actions only) come from `next/cache`.
- Every parallel-route slot needs an explicit `default.js` or the build fails.
- Prefer `cacheComponents: true` (replaces `experimental.ppr` / `dynamicIO` / `useCache`).

## MCP / tooling
- Playwright MCP (configured in `opencode.json`): put every artifact it generates (screenshots, console logs, snapshots) under `.playwright-mcp/` (gitignored).
- Context7 MCP: use it to pull current framework/library docs.
- Spec-driven skills live in `.agents/skills/` (`spec`, `spec-impl`); specs go in `specs/` (none yet).
