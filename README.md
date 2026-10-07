# Open Daycare

App de gestión de jardín infantil construida con **Next.js 16** (App Router, Turbopack), React 19, TypeScript, Tailwind v4 y **Supabase** (Auth, Postgres con RLS) como backend.

- Especificaciones de features: `specs/` — la convención de arquitectura (Clean Architecture a 4 capas) está en `specs/00-arquitectura.md`.
- Guía del repo para contribuidores y agentes: `AGENTS.md` (leer antes de tocar código).
- Mockups de diseño de referencia: `references/pantallas/`.

## Requisitos

- **Node.js 20.9+** (desarrollo probado con Node 24 / npm 11)
- **Git**
- Una cuenta de **Supabase** con acceso a la organización del proyecto (para autenticarte en el MCP y la CLI)
- (Opcional) [`opencode`](https://opencode.ai) — el MCP de Supabase y el de Playwright están configurados en `opencode.json`

## Levantar el proyecto

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env
```

Completá `.env` con los valores del proyecto (los `NEXT_PUBLIC_*` son obligatorios: sin ellos la app lanza `Falta NEXT_PUBLIC_SUPABASE_URL en el entorno` al arrancar):

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | URL del proyecto Supabase (`https://<project-ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | Publishable key — viaja al navegador, nunca pongas la secret key acá |
| `SUPABASE_SECRET_KEY` | Solo server | Secret key (`service_role`); solo la lee `data/supabase/admin.ts` |
| `RESEND_API_KEY` | Para enviar emails | API key de [Resend](https://resend.com) (invitaciones de padres) |
| `RESEND_FROM` | No (tiene default) | Remitente de los emails |
| `APP_URL` | No (tiene default `http://localhost:3000`) | URL base de la app para links en emails |
| `SUPABASE_DB_PASSWORD` | Solo CLI | Password de la base, usado por `supabase link` / `db push` |

Dónde conseguir las claves de Supabase:
<https://supabase.com/dashboard/project/zvtgjvsqehhvutyrbsil/settings/api-keys>

> `.env` está en `.gitignore`: nunca se commitea. `.env.example` es la plantilla versionada.

### 3. Arrancar el dev server

```bash
npm run dev
```

Abrí <http://localhost:3000>.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Dev server con Turbopack |
| `npm run build` | Build de producción |
| `npm start` | Sirve el build de producción |
| `npm run lint` | ESLint (`next lint` fue removido en Next.js 16) |

No hay test runner configurado: la verificación es `npm run lint` + `npm run build` + checks manuales en el browser (vía Playwright MCP).

## Autenticación (equipo)

Hay dos credenciales distintas de Supabase y conviene no mezclarlas:

### 1. MCP de Supabase (remoto, OAuth) — para que opencode hable con la BD

Está declarado en `opencode.json` del repo (y también a nivel global en `~/.config/opencode/opencode.json`). Es un MCP remoto con OAuth: **cada persona del equipo se autentica con su propia cuenta de Supabase**:

```bash
opencode mcp auth supabase   # abre el browser y completa el OAuth
opencode mcp list            # verifica el estado de autenticación
```

- Si no lo corre a mano, opencode suele pedir la autenticación automáticamente la primera vez que se usa una tool del MCP.
- Los tokens quedan guardados en `~/.local/share/opencode/mcp-auth.json`.
- Para revocar: `opencode mcp logout supabase`.
- Requiere una cuenta Supabase **con acceso a la organización del proyecto** (si no la tenés, alguien admin la invita desde el Dashboard → Organization → Members).

### 2. Supabase CLI — para migraciones, `db push` y stack local

La CLI no está instalada globalmente: se usa vía `npx`. Cada persona del equipo hace login una vez:

```bash
# 1. Generar un personal access token (PAT):
#    https://supabase.com/dashboard/account/tokens
npx supabase login            # abre el browser; o --token sbp_...

# 2. Linkear el repo al proyecto remoto (requiere SUPABASE_DB_PASSWORD en .env):
npx supabase link --project-ref zvtgjvsqehhvutyrbsil
```

- El login guarda el token en el keyring del sistema (o `~/.supabase/access-token` como fallback).
- En CI se omite el login usando la variable `SUPABASE_ACCESS_TOKEN`.
- Para linkear también necesitás ser miembro de la organización del proyecto.

### 3. MCP de Playwright (local) — para checks en el browser

Servidor local lanzado con `npx -y @playwright/mcp@latest`: **no requiere autenticación**. La primera ejecución descarga el paquete; si el browser falta, instalalo con `npx playwright install chromium`. Los artefactos que genere (screenshots, snapshots, logs) van en `.playwright-mcp/` (gitignored).

## Base de datos

- El diseño de referencia del schema vive en `../07-DB-Schema/` (project reference `db-schema`).
- Las migraciones SQL están commiteadas en `supabase/migrations/` y se aplican con el MCP de Supabase (`apply_migration`), no con la CLI.
- Specs de base de datos (tablas, RLS, seeds, funciones): `specs/database/`.
- Detalle completo del flujo de migraciones, RLS y seguridad: ver sección **Supabase** de `AGENTS.md`.
