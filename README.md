<div align="center">
  <img src="docs/logo.png" alt="MongoTop logo" width="100" />
  <h1>MongoTop</h1>
</div>

Watch what your MongoDB cluster is doing right now — a `top`-style live view of `db.currentOp()`, streamed to a web dashboard via SSE, with slow and unindexed queries called out automatically.

## Features

- **Real-time monitoring** with auto-refresh and SSE streaming
- **Intelligent filtering** of system/internal queries
- **Color-coded highlighting** for unindexed queries (COLLSCAN)
- **GeoIP location display** for public IPs
- **Auto-save** long-running and problematic queries
- **Interactive controls** (pause, reverse, snapshot, show all)
- **Multi-server support** with connection management and idle auto-disconnect
- **Web dashboard** with virtualized table and JSON viewer
- **Connected clients tab** listing live connections by client, user, and replica set node
- **Collection activity tab** with per-interval/cumulative view and live server uptime, bookmarkable via URL

## Why?

The built-in `db.currentOp()` has limitations:

- ❌ JSON output not easily readable
- ❌ Cluttered with system queries
- ❌ No auto-refresh or persistence
- ❌ No summary statistics

This tool provides:

- ✅ Human-readable tabular display
- ✅ Automatic filtering of noise
- ✅ Auto-refresh and real-time streaming
- ✅ Instant identification of slow queries
- ✅ Detection of unindexed scans
- ✅ REST API and web dashboard

## Screenshot

![MongoTop dashboard](docs/screenshot.png)

## Quick Start

```bash
pnpm install

# Configure your MongoDB servers (see Configuration section)
cp config/local.yaml.example config/local.yaml

# Start API + dashboard
pnpm run dev
```

## Production (Local)

Run the compiled build without Docker:

```bash
# 1. Configure your MongoDB servers
cp config/local.yaml.example config/local.yaml

# 2. Build all packages
pnpm run build

# 3. Start API + Web
pnpm run start
```

- Web UI: http://localhost:7010
- API: http://localhost:7011

Run them separately if needed:

```bash
pnpm run start:api   # API only (port 7011)
pnpm run start:web   # Web only — vite preview (port 7010)
```

## Docker Setup

Run both API and Web services in containers:

```bash
# 1. Configure MongoDB and API settings in config/local.yaml
cp config/local.yaml.example config/local.yaml

# 2. Build Docker images (generates config from YAML - no env vars!)
pnpm docker:build

# 3. Start services
docker compose up -d
```

**Access:** Web UI at http://localhost:7010, API at http://localhost:7011

**Production:** `pnpm docker:build https://api.yourdomain.com`

See **[docs/DOCKER.md](docs/DOCKER.md)** for complete documentation including production deployment, SSE-capable reverse proxy configuration, troubleshooting, and more.

## Usage

### Web Dashboard

```bash
pnpm run dev
```

Opens **http://localhost:7000** with:

- Real-time query monitoring
- Interactive table with virtualization
- Query details with JSON viewer
- Server selection and connection management
- Connected clients tab - live connections grouped by client and user, filterable by replica set node
- Collection activity tab — per-interval or cumulative op counts by collection, plus live server uptime

### API Server

```bash
# Start API only on http://localhost:7001
pnpm run dev:api
```

See [docs/API.md](docs/API.md) for detailed API documentation.

## Configuration

Uses YAML configuration files in `config/`:

**config/default.yaml** (checked into git):

```yaml
servers:
    localhost:
        name: Local MongoDB
        uri: mongodb://localhost:27017

api:
    port: 7001
    host: 0.0.0.0
    logLevel: info
    apiKey: dev-key-change-in-production
    idleDisconnectMs: 300000 # close a server's MongoDB connection after this long with no viewers
    cors:
        origins:
            - http://localhost:7000
        credentials: true
```

**config/production.yaml** (checked into git — port/URL overrides for `NODE_ENV=production`):

```yaml
api:
    port: 7011
frontend:
    url: http://localhost:7010
```

**config/local.yaml** (gitignored - your servers):

```yaml
servers:
    production:
        name: Production Cluster
        uri: mongodb+srv://user:pass@cluster.mongodb.net/db

    staging:
        name: Staging
        uri: mongodb://user:pass@staging:27017/db?authSource=admin

# Override API settings
api:
    apiKey: your-secure-api-key-here
    logLevel: debug
```

Copy `config/local.yaml.example` to get started.

## Architecture

**Monorepo Structure** (Turborepo + pnpm workspaces):

```
apps/
├── api/      # Fastify REST API + SSE streaming
│             # Includes MongoDB services and query processing
└── web/      # React dashboard (TanStack Router, Zustand, shadcn/ui)
              # Includes utility functions for styling

packages/
└── types/    # Shared TypeScript types
```

**Services** (apps/api/src/core):

- `MongoConnectionService` - Connection pooling
- `QueryService` - Query processing and filtering
- `QueryLoggerService` - Logging and snapshots

## Tech Stack

- **Monorepo:** Turborepo, pnpm workspaces
- **Backend:** TypeScript, MongoDB Driver v7, Fastify, lodash-es
- **Frontend:** React 19, TanStack Router + Virtual, Zustand, Vite, Tailwind CSS, shadcn/ui

## Development

```bash
# Install dependencies
pnpm install

# Development modes
pnpm run dev        # API + Web (recommended)
pnpm run dev:api    # API only

# Build all packages
pnpm run build

# Build specific package
turbo build --filter=@mongotop-web/api

# Run tests (vitest, api + web)
pnpm -r test

# Lint and format
pnpm run lint
pnpm run format

# Kill stale dev/prod processes
pnpm run cleanup
```

## Documentation

- **[docs/API.md](docs/API.md)** - Complete API endpoint documentation
- **[docs/DOCKER.md](docs/DOCKER.md)** - Docker deployment guide with production setup and SSE support
- **[CLAUDE.md](CLAUDE.md)** - AI coding context — project conventions, commands, and code style

## Query Logging

Auto-save is off by default. Turn it on from the dashboard settings, or pass `autoSaveEnabled=true` to `GET /api/queries/:serverId/stream`. Once on, queries are written to `logs/<server-id>/` when any of these match:

| Trigger                    | Query param                              | Default |
| -------------------------- | ---------------------------------------- | ------- |
| Runtime exceeds threshold  | `autoSaveLongRunningThreshold` (seconds) | `60`    |
| Query uses COLLSCAN        | `autoSaveCollscan`                       | `true`  |
| Query nears client timeout | `autoSaveTimeoutRisk`                    | `true`  |

Save a single query or a full snapshot at any time from the dashboard, regardless of these settings.

## License

MIT

## Author

[Rushi Vishavadia](https://github.com/rushi)
