# MongoTop

Real-time MongoDB operation monitor (like Unix `top`) — Turborepo monorepo with a Fastify API and React dashboard.

## Monorepo Layout

```
apps/api/        Fastify REST API + SSE server (port 7001 dev / 7011 prod) — see apps/api/CLAUDE.md
apps/web/        React dashboard — Vite + TanStack Router (port 7000 dev / 7010 prod) — see apps/web/CLAUDE.md
packages/types/  Shared TypeScript types (API contracts, MongoDB types)
config/          YAML config (default.yaml checked in, local.yaml gitignored)
```

## Key Commands

```bash
pnpm run dev        # API + frontend (most common)
pnpm run dev:api    # API only
pnpm run build      # build all packages
pnpm run format     # Prettier across all packages — run before every commit
```

## Configuration System

Uses the Node.js `config` package — merges `config/default.yaml` → `config/local.yaml` (gitignored; copy `config/local.yaml.example` to start one).

```yaml
servers:
    my-server:
        name: Display Name
        uri: mongodb://user:pass@host:27017/db

api:
    port: 7001
    apiKey: dev-key-change-in-production
```

`config/production.yaml` overrides `api.port` to `7011` and `frontend.url` to `http://localhost:7010` when `NODE_ENV=production` (Docker sets this automatically).

Backend reads it directly: `config.get<string>("api.apiKey")`, `config.get<Record<string, ServerConfig>>("servers")`.

Frontend never touches YAML or `import.meta.env` — no `.env` files exist anywhere in this repo. `scripts/generate-web-config.js` runs before every `dev`/`dev:api`/`build` and writes the gitignored `apps/web/src/config.ts` from the same YAML; web code imports `config` from `../config`.

## Code Style (all packages)

- TypeScript strict mode, ES modules (`import`/`export`) throughout
- Arrow functions preferred; async/await for all async ops
- Named exports always (`export const Foo`) — default exports only for Fastify route files
- Run `pnpm format` before every commit
- Use package.json scripts (`pnpm run lint`) not direct tool invocation (`npx eslint`)
- After multi-file edits: run `pnpm build` to catch TypeScript errors before declaring done

## Logging (evlog — use everywhere)

`evlog` is the ONLY logger in both apps. **Never** use `console.log`/`console.error`, `fastify.log`, or pino directly.

- **Structured wide events, not strings.** Group data into objects: `log.info({ sse: { event: "closed", server: serverId } })`, not `log.info("closed " + serverId)`. The global `log` API takes an object (`log.info({...})`, `log.warn({...})`, `log.error({...})`).
- **Errors:** `throw createError({ message, status, why, fix })` (backend) / `createEvlogError({...})` (frontend) instead of `throw new Error(...)`. Read user-facing fields with `parseError(err)`.

Backend/frontend specifics (request-scoped context, `useLogger()`, vite plugin setup) live in `apps/api/CLAUDE.md` and `apps/web/CLAUDE.md`. Deeper review checklist: the `evlog-review-logging-practices` skill.

## Docker

See [docs/DOCKER.md](docs/DOCKER.md). Config-driven — no env vars needed, reads `config/local.yaml`.
