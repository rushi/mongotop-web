# Web — apps/web

React 19 dashboard with TanStack Router (file-based), Zustand, Tailwind CSS, shadcn/ui.

## Key Components (`src/components/`)

- **QueryTable** — virtualized list (`@tanstack/react-virtual`), sorted by runtime desc, new queries at bottom to prevent jank
- **QueryDetails** — dialog with JSON viewer (`@microlink/react-json-view`)
- **FilterControls** — minTime, refreshInterval, showAll; connected to Zustand store
- **SummaryStats** — total ops, collections, clients, unindexed queries

## Custom Hooks (`src/hooks/`)

- **`useServerSentEvents`** — SSE with exponential backoff reconnect (1s→30s max). Returns `{ data, error, isConnected, isReconnecting }`.
- **`useFetchServers`** — fetches server list from API. Returns `{ servers, loading, error }`.

## State Management

- **Zustand** (`src/store/preferences.ts`) — persistent user prefs (serverId, minTime, refreshInterval, filters). Use `useShallow` when selecting >2 fields.
- **React hooks** — local component state only

## Adding shadcn/ui Components

```bash
cd apps/web
npx shadcn@latest add <component-name>
```

Lands in `src/components/ui/`. Import from there directly (no barrel imports from other locations).

## API Client

Centralized in `src/utils/api.ts` — Axios with base URL from `VITE_API_URL`. Always add new API calls there. The response interceptor normalizes API errors with `parseError()` and re-throws a structured `createEvlogError` (keeps `.message`, adds `.why`/`.fix`).

## Logging (evlog only)

evlog is the only logger — **never** `console.log`/`console.error`. The `evlog/vite` plugin (service `mongotop-web-web`, console-only) auto-inits the browser logger and strips `log.debug()` from prod builds.

- Import explicitly from `evlog`: `import { log, parseError, createEvlogError } from "evlog"`.
- Emit structured wide events: `log.info({ connection: { event: "established", url } })`, `log.error({ action: "save_query", error: msg })` — grouped objects, not strings. Pick the level by intent (`debug` for high-frequency/noise so it's stripped in prod).
- Errors: `throw createEvlogError({ message, status })`; extract user-facing fields with `parseError(err)`. Note `useLogger`/`createError` are server-only — the client uses `log` + `createEvlogError`.

## Frontend Code Style

### Naming

- Components: PascalCase files + named exports (`export const QueryTable`)
- Hooks: camelCase with `use` prefix (`useServerSentEvents`)
- Booleans: must start with `is`, `has`, `should`, `can` (`isLoading`, `hasError`)
- Event handlers: prefix `handle` (`handleClick`, `handleSave`)

### Components

- No `React.FC`; props interface only when >2 props (`ComponentNameProps`)
- Keep files under 350 lines; split at 400
- Max 5 levels of JSX nesting
- `import type { ... }` for type-only imports
- No inline styles, no CSS modules — Tailwind utility classes only
- Use `cn()` from `src/lib/utils.ts` for all conditional/variable className expressions
- Component variants with `cva()` from class-variance-authority
- `React.memo` for memoization; `useMemo`/`useCallback` for perf (not premature)
- No inline function definitions in JSX

### Prop Ordering

Callbacks last, `className` second-to-last:

```tsx
// Button
<Button
    variant="outline"
    size="sm"
    disabled={isLoading}
    title="Save"
    className="h-6 w-6"
    onClick={handleSave}
/>

// Native button
<button className="flex items-center gap-1" onClick={handleClick}>

// Input
<Input
    type="number"
    id="minTime"
    value={minTime}
    min={0}
    className="h-9 w-24"
    onChange={(e) => setMinTime(Number(e.target.value))}
/>

// Select
<Select value={value} disabled={isDisabled} onValueChange={handleChange} />

// cn() for conditional classes
<div className={cn("font-mono text-sm", isInternal && "text-muted-foreground/80")}>
```
