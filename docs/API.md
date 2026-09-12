# MongoTop API

API reference for the MongoTop REST server.

## Base URL

```
http://localhost:7001
```

Configurable via `api.port` in `config/default.yaml` or `config/local.yaml`.

## Authentication

All endpoints (except `/health`) require API key authentication via header:

```bash
X-API-Key: your-api-key-here
```

Or via query parameter for Server-Sent Events (SSE):

```bash
?apiKey=your-api-key-here
```

Configure API key in `config/local.yaml`:

```yaml
api:
    apiKey: your-secure-api-key-here
```

## Endpoints

### Health Check

Check if the API server is running.

**Request:**

```http
GET /health
```

**Response:**

```json
{
    "status": "ok",
    "timestamp": "2025-01-03T12:00:00.000Z",
    "connectedServers": ["localhost", "production"]
}
```

No authentication required.

---

### List Servers

Get all configured MongoDB servers from `config/default.yaml` and `config/local.yaml`.

**Request:**

```http
GET /api/servers
```

**Response:**

```json
{
    "servers": [
        {
            "id": "localhost",
            "name": "Local MongoDB",
            "connected": true
        },
        {
            "id": "production",
            "name": "Production Cluster",
            "connected": false
        }
    ]
}
```

---

### Connect to Server

Establish a connection to a MongoDB server.

**Request:**

```http
POST /api/servers/:id/connect
```

**Parameters:**

- `id` - Server ID from config (e.g., `localhost`, `production`)

**Response:**

```json
{
    "success": true,
    "serverId": "localhost",
    "serverName": "Local MongoDB"
}
```

**Error Response (404):**

```json
{
    "error": "Server not found"
}
```

**Error Response (500):**

```json
{
    "error": "Connection failed",
    "message": "connection refused"
}
```

---

### Disconnect from Server

Close connection to a MongoDB server.

**Request:**

```http
POST /api/servers/:id/disconnect
```

**Parameters:**

- `id` - Server ID

**Response:**

```json
{
    "success": true,
    "serverId": "localhost"
}
```

**Error Response (404):**

```json
{
    "error": "Server not connected"
}
```

---

### Check Server Status

Get connection status for a specific server.

**Request:**

```http
GET /api/servers/:id/status
```

**Parameters:**

- `id` - Server ID

**Response:**

```json
{
    "serverId": "localhost",
    "serverName": "Local MongoDB",
    "connected": true
}
```

---

### Get Current Queries (One-Time)

Fetch current MongoDB operations once.

**Request:**

```http
GET /api/queries/:serverId?minTime=1&showAll=false
```

**Parameters:**

- `serverId` - Server ID
- `minTime` (optional) - Minimum query runtime in seconds (default: 1)
- `showAll` (optional) - Include system queries (default: false)

**Response:**

```json
{
    "queries": [
        {
            "idx": 1,
            "opid": "shard01:12345",
            "secs_running": 5,
            "runtime_formatted": "5s",
            "operation": "query",
            "namespace": "mydb.users",
            "collection": "users",
            "database": "mydb",
            "query": { "email": "test@example.com" },
            "client": {
                "ip": "192.168.1.100",
                "port": 51234,
                "geo": {
                    "country": "US",
                    "city": "San Francisco",
                    "ll": [37.7749, -122.4194]
                }
            },
            "userAgent": "MongoDB Node.js Driver v5.0.0",
            "planSummary": "COLLSCAN",
            "isCollscan": true,
            "waitingForLock": false
        }
    ],
    "summary": {
        "totalOperations": 1,
        "uniqueCollections": 1,
        "uniqueClients": 1,
        "collscans": 1
    }
}
```

---

### Stream Queries (Server-Sent Events)

Real-time stream of query data. Emits `queries` events at the specified refresh interval.

**Request:**

```http
GET /api/queries/:serverId/stream?minTime=1&refreshInterval=2&showAll=false&apiKey=your-api-key
```

**Parameters:**

- `serverId` - Server ID
- `minTime` (optional) - Minimum query runtime in seconds (default: 1)
- `refreshInterval` (optional) - Fetch interval in seconds (default: 2)
- `showAll` (optional) - Include system queries (default: false)
- `apiKey` - API key for authentication (required for SSE)

**Response Format:**

Server-Sent Events stream:

```
event: queries
data: {"queries":[...],"summary":{...}}

event: queries
data: {"queries":[...],"summary":{...}}
```

**JavaScript Client Example:**

```javascript
const eventSource = new EventSource(
    `http://localhost:7001/api/queries/localhost/stream?apiKey=dev-key&minTime=1&refreshInterval=2`,
);

eventSource.addEventListener("queries", (event) => {
    const data = JSON.parse(event.data);
    console.log("Queries:", data.queries);
    console.log("Summary:", data.summary);
});

eventSource.onerror = (error) => {
    console.error("SSE error:", error);
    eventSource.close();
};
```

**React Hook Example:**

See [apps/web/src/hooks/useServerSentEvents.ts](apps/web/src/hooks/useServerSentEvents.ts) for production implementation with reconnection logic.

---

### Kill Operation

Terminate a running MongoDB operation via `killOp`.

**Request:**

```http
POST /api/queries/:serverId/kill/:opid
```

**Parameters:**

- `serverId` - Server ID
- `opid` - Numeric operation ID (as shown in the query list)

**Response:**

```json
{
    "success": true,
    "opid": 12345,
    "result": { "ok": 1 },
    "timestamp": "2025-01-03T12:00:00.000Z"
}
```

**Error Response (400):** `{ "error": "Invalid opid" }`. The opid must be a positive integer.

**Error Response (404):** `{ "error": "Server not connected" }`

---

### Save Single Query

Save one query to disk on demand (distinct from the threshold/COLLSCAN auto-save and the full snapshot below).

**Request:**

```http
POST /api/queries/:serverId/save
```

**Body:**

```json
{
    "query": { "...": "processed query object" },
    "type": "manual-save"
}
```

- `type` (optional) - Label used in the saved filename (default: `manual-save`)

**Response:**

```json
{
    "success": true,
    "message": "Query saved successfully",
    "timestamp": "2025-01-03T12:00:00.000Z"
}
```

---

### Save Snapshot

Save current queries to disk as JSON files.

**Request:**

```http
POST /api/queries/:serverId/snapshot?minTime=1
```

**Parameters:**

- `serverId` - Server ID
- `minTime` (optional) - Minimum query runtime (default: 1)

**Response:**

```json
{
    "success": true,
    "files": {
        "raw": "logs/localhost/queries-raw-1704283200000.json",
        "sanitized": "logs/localhost/queries-sanitized-1704283200000.json"
    }
}
```

Files are saved to `logs/<serverId>/` directory.

---

### List Log Files

Get all saved query snapshots for a server.

**Request:**

```http
GET /api/queries/:serverId/logs
```

**Parameters:**

- `serverId` - Server ID

**Response:**

```json
{
    "files": [
        {
            "name": "queries-sanitized-1704283200000.json",
            "path": "logs/localhost/queries-sanitized-1704283200000.json",
            "size": 12345,
            "modified": "2025-01-03T12:00:00.000Z"
        }
    ]
}
```

---

### Read Log File

Retrieve contents of a saved log file.

**Request:**

```http
GET /api/queries/:serverId/logs/:filename
```

**Parameters:**

- `serverId` - Server ID
- `filename` - Log file name (e.g., `queries-sanitized-1704283200000.json`)

**Response:**

Returns the JSON content of the log file.

```json
{
  "queries": [...],
  "summary": {...},
  "timestamp": "2025-01-03T12:00:00.000Z"
}
```

---

### Connected Clients

Lists live connections via `$currentOp` (including idle ones), so the view reflects who's connected, not just who's running an operation.

**Request:**

```http
GET /api/clients/:serverId?showAll=false&readPreference=secondaryPreferred
```

**Parameters:**

- `serverId` - Server ID
- `showAll` (optional) - Include system/internal clients (default: false)
- `readPreference` (optional) - MongoDB read preference for the `$currentOp` aggregation

**Response:**

```json
{
    "clients": [
        {
            "ip": "192.168.1.100",
            "port": 51234,
            "appName": "mongosh 2.0.0",
            "active": false,
            "geo": { "country": "US", "city": "San Francisco" }
        }
    ],
    "summary": {
        "totalClients": 1,
        "uniqueIps": 1
    },
    "metadata": {
        "serverId": "localhost",
        "timestamp": "2025-01-03T12:00:00.000Z"
    }
}
```

---

### Connected Clients (Server-Sent Events)

Real-time stream of connected clients. Emits `clients` events at the specified refresh interval.

**Request:**

```http
GET /api/clients/:serverId/stream?refreshInterval=2&showAll=false&node=host:27017
```

**Parameters:** same as the one-time fetch above, plus:

- `refreshInterval` (optional) - seconds between updates (default: 2)
- `node` (optional) - Pin sampling to a specific replica-set member so you see the clients connected to that node (e.g. a chosen secondary)

---

### Collection Activity (One-Time)

Runs the MongoDB `top` command and groups read/write activity by collection. Powers the dashboard's Collection Activity tab.

**Request:**

```http
GET /api/top/:serverId?showAll=false&readPreference=secondaryPreferred
```

**Parameters:**

- `serverId` - Server ID
- `showAll` (optional) - Include system collections (default: false)
- `readPreference` (optional) - MongoDB read preference for the `top` command

**Response:**

```json
{
    "collections": [
        {
            "ns": "mydb.users",
            "database": "mydb",
            "collection": "users",
            "total": { "time": 1200, "count": 5 },
            "readLock": { "time": 800, "count": 3 },
            "writeLock": { "time": 400, "count": 2 }
        }
    ],
    "metadata": {
        "serverId": "localhost",
        "timestamp": "2025-01-03T12:00:00.000Z",
        "intervalMs": 0,
        "serverStartedAt": "2025-01-01T00:00:00.000Z"
    }
}
```

A one-time fetch has no previous sample to diff against, so deltas are zero. `serverStartedAt` is derived from `serverStatus.uptime` and used by the dashboard to show a live uptime readout.

---

### Collection Activity (Server-Sent Events)

Real-time per-interval stream of collection activity. Emits `top` events; each frame's counts are the delta since the previous sample (like `mongotop`), so the first frame after connecting is always zero.

**Request:**

```http
GET /api/top/:serverId/stream?refreshInterval=2&showAll=false&node=host:27017
```

**Parameters:**

- `serverId` - Server ID
- `refreshInterval` (optional) - Fetch interval in seconds (default: 2)
- `showAll` (optional) - Include system collections (default: false)
- `readPreference` (optional) - MongoDB read preference
- `node` (optional) - Pin sampling to a specific replica-set member (see below) so consecutive diffs are computed against the same node instead of jumping between secondaries

---

### List Replica Set Nodes

List replica-set members so the client can offer node-pinned sampling for the Collection Activity and Connected Clients streams.

**Request:**

```http
GET /api/top/:serverId/nodes
```

**Response:**

```json
{
    "nodes": [
        { "host": "host1:27017", "role": "primary" },
        { "host": "host2:27017", "role": "secondary" }
    ]
}
```

---

## Example Usage

### Using curl

```bash
# Set your API key
export API_KEY="dev-key-change-in-production"

# List servers
curl -H "X-API-Key: $API_KEY" \
  http://localhost:7001/api/servers

# Connect to a server
curl -X POST -H "X-API-Key: $API_KEY" \
  http://localhost:7001/api/servers/localhost/connect

# Get current queries
curl -H "X-API-Key: $API_KEY" \
  http://localhost:7001/api/queries/localhost?minTime=2

# Stream real-time updates (SSE)
curl -H "X-API-Key: $API_KEY" \
  http://localhost:7001/api/queries/localhost/stream

# Or with query parameter for authentication
curl "http://localhost:7001/api/queries/localhost/stream?apiKey=$API_KEY"

# Save snapshot
curl -X POST -H "X-API-Key: $API_KEY" \
  http://localhost:7001/api/queries/localhost/snapshot

# List saved logs
curl -H "X-API-Key: $API_KEY" \
  http://localhost:7001/api/queries/localhost/logs

# Read specific log file
curl -H "X-API-Key: $API_KEY" \
  http://localhost:7001/api/queries/localhost/logs/queries-sanitized-1704283200000.json
```

### Using JavaScript/TypeScript

```typescript
import axios from "axios";

const apiClient = axios.create({
    baseURL: "http://localhost:7001",
    headers: {
        "X-API-Key": "dev-key-change-in-production",
    },
});

// List servers
const { data: serversData } = await apiClient.get("/api/servers");
console.log(serversData.servers);

// Connect to server
await apiClient.post("/api/servers/localhost/connect");

// Get queries
const { data: queriesData } = await apiClient.get("/api/queries/localhost", {
    params: { minTime: 2, showAll: false },
});
console.log(queriesData.queries);

// Save snapshot
const { data: snapshotData } = await apiClient.post("/api/queries/localhost/snapshot");
console.log("Saved to:", snapshotData.files);
```

---

## Error Responses

All error responses follow this format:

```json
{
    "error": "Error message",
    "message": "Additional details (optional)"
}
```

**Common Status Codes:**

- `200` - Success
- `401` - Unauthorized (invalid or missing API key)
- `404` - Resource not found (server, log file, etc.)
- `500` - Internal server error (connection failure, etc.)

---

## CORS Configuration

CORS is enabled for the following origins by default:

- `http://localhost:7000` (Vite dev server)
- `http://localhost:7010` (production build, added via `config/production.yaml`)

Configure additional origins in `config/local.yaml`:

```yaml
api:
    cors:
        origins:
            - http://localhost:7000
            - https://my-dashboard.example.com
        credentials: true
```

---

## Rate Limiting

Currently no rate limiting is implemented. For production use, consider adding rate limiting middleware.

---

## WebSocket Alternative

The API currently uses Server-Sent Events (SSE) for real-time streaming. SSE is simpler and sufficient for one-way server-to-client communication. WebSocket support may be added in the future if bidirectional communication is needed.

---

## API Client Library

A TypeScript API client is available in the web app:

**File:** [apps/web/src/utils/api.ts](apps/web/src/utils/api.ts)

You can extract and reuse this client in your own applications:

```typescript
import { apiClient } from "@mongotop-web/web/utils/api";

// Already configured with base URL and API key from env vars
const { data } = await apiClient.get("/api/servers");
```

---

## Server-Sent Events Best Practices

When using SSE streams:

1. **Handle reconnection** - Implement exponential backoff
2. **Close connections** - Always close EventSource when unmounting
3. **Monitor connection state** - Track `onopen`, `onerror`, `onclose` events
4. **Parse JSON** - Event data is stringified JSON
5. **Use query params for auth** - EventSource doesn't support custom headers

**Production Example:**

See [apps/web/src/hooks/useServerSentEvents.ts](apps/web/src/hooks/useServerSentEvents.ts) for the React hook this project uses. It handles:

- Automatic reconnection with exponential backoff
- Connection state management
- Error handling
- Cleanup on unmount

---

## Development

Start the API server in development mode:

```bash
# With hot reload
pnpm run dev:api

# Or with Turborepo
turbo dev --filter=@mongotop-web/api
```

API server will restart automatically on file changes.

---

## Production Deployment

Build and run in production:

```bash
# Build
pnpm run build

# Start API server
NODE_CONFIG_DIR=./config NODE_ENV=production node apps/api/dist/server.js

# Or use npm script
pnpm run start:api
```

**Environment Variables:**

The API server uses `config` module which reads from `config/default.yaml`, `config/production.yaml` (when `NODE_ENV=production`), and `config/local.yaml`. No other environment variables are needed.

**Reverse Proxy:**

For production, use nginx or similar:

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://localhost:7011;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

---

## Related Documentation

- [README.md](README.md): quick start and overview
- [CLAUDE.md](CLAUDE.md): agent context, architecture, code patterns
