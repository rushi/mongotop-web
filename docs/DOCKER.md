# Docker Deployment

This guide covers running MongoDB Query Top in Docker containers for both development and production environments.

## Quick Start

The application includes a complete Docker setup for running both API and Web services in containers.

**Prerequisites:**

- Docker and Docker Compose installed
- Node.js (only needed for the build script)

**Step 1: Configure API and MongoDB**

Create `config/local.yaml` with your settings:

```yaml
servers:
    my-server:
        name: My MongoDB Server
        uri: mongodb://user:pass@host:27017/dbname?authSource=admin

api:
    apiKey: your-secure-api-key-here
    port: 7011
    host: 0.0.0.0
    logLevel: info
```

**Step 2: Build Docker Images**

Use the helper script that reads from `config/local.yaml`:

```bash
# Build both API and Web services (uses config from YAML)
pnpm docker:build

# For production with custom API URL:
pnpm docker:build https://api.yourdomain.com
```

**Step 3: Start Services**

```bash
# Start both services in detached mode
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

**Access the Application:**

- Web UI: http://localhost:7010
- API: http://localhost:7011

**How It Works:**

- The `scripts/generate-web-config.js` reads all settings from `config/local.yaml`
- It generates `apps/web/src/config.ts` with the API URL and API key
- The web frontend is built with this generated config (no environment variables!)
- The API reads all configuration from mounted `config/` directory at runtime
- No separate `.env` file needed!

## Docker Architecture

**Services:**

- **api**: Fastify REST API + SSE server (port 7011)
- **web**: React frontend served with nginx (port 7010)

**Volumes:**

- `./config`: MongoDB connection configuration (read-only)
- `./logs`: Query logging output (read-write)

**Network:**

- Both services share a Docker bridge network
- Web service depends on API being healthy before starting

## Building Individual Services

**Build API only:**

```bash
docker build -t mongotop-web-api -f apps/api/Dockerfile .
```

**Build Web only:**

```bash
# With default config
docker build -t mongotop-web-web -f apps/web/Dockerfile .

# With custom API URL
docker build -t mongotop-web-web -f apps/web/Dockerfile \
  --build-arg API_URL=https://api.yourdomain.com \
  .
```

## Configuration Architecture

**Unified Configuration** (all in `config/local.yaml`):

- MongoDB server URIs
- API key, port, host, log level
- CORS settings
- All API runtime configuration

**No Environment Variables Needed!**

The system uses a build-time script (`scripts/generate-web-config.js`) that:

1. Reads `config/local.yaml` using the Node.js `config` module
2. Generates `apps/web/src/config.ts` with API URL and API key
3. Web frontend imports this generated config file

**Important Notes:**

- API reads all settings from `config/` directory at runtime (Node.js `config` module)
- Frontend config is generated from YAML and baked into static assets at build time
- API URL defaults to `http://localhost:{port}` from config, can be overridden via build arg
- The generated `config.ts` file ensures API key consistency between backend and frontend
- Changing configuration requires rebuilding: `pnpm docker:build`
- `apps/web/src/config.ts` is auto-generated and gitignored

## Production Deployment

**1. Update `config/local.yaml` for production:**

```yaml
servers:
    production:
        name: Production Cluster
        uri: mongodb+srv://user:pass@cluster.mongodb.net/db

api:
    apiKey: your-secure-random-key-here
    logLevel: warn
    cors:
        origins:
            - https://yourdomain.com
        credentials: true
```

**2. Build with production settings:**

```bash
# Build with production API URL
pnpm docker:build https://api.yourdomain.com
```

**3. Start services:**

```bash
docker compose up -d
```

**4. Check service health:**

```bash
# API health
curl http://localhost:7011/health

# Web health
curl http://localhost:7010/health

# Check service status
docker compose ps
```

## Troubleshooting

**API container fails to start:**

- Check MongoDB connection URI in `config/local.yaml`
- Verify MongoDB is accessible from Docker network
- Check logs: `docker compose logs api`

**Web can't connect to API:**

- Verify the API URL is set correctly (check `apps/web/src/config.ts`)
- For production, rebuild with correct URL: `pnpm docker:build https://api.yourdomain.com`
- Check browser console for CORS errors
- Ensure API key in generated config matches `api.apiKey` in config/local.yaml

**Query logs not persisting:**

- Ensure `./logs` directory exists and is writable
- Check volume mount: `docker compose config`

## Docker Development

**Run with live code changes (development mode):**

For development with hot-reload, use the native pnpm commands instead of Docker:

```bash
pnpm run dev:web
```

**Build and test Docker images locally:**

```bash
# Build services
docker compose build

# Start services
docker compose up

# Watch logs
docker compose logs -f api web
```

## Container Details

### API Container

- **Base image**: node:24-alpine
- **Build**: Multi-stage build with pnpm
- **Runtime**: Node.js with production dependencies only
- **Config**: Reads from mounted `config/` directory
- **Logs**: Writes to mounted `logs/` directory
- **Health check**: HTTP GET to `/health` endpoint

### Web Container

- **Base image**: nginx:alpine
- **Build**: Multi-stage build with Vite
- **Runtime**: Static files served by nginx
- **Config**: API URL and key baked into static assets
- **Health check**: HTTP GET to `/health` endpoint

## Advanced Configuration

### Custom Ports

Edit `docker-compose.yml` to change exposed ports:

```yaml
services:
    api:
        ports:
            - "8001:7011" # External:Internal

    web:
        ports:
            - "8000:80"
```

### Using External MongoDB

If your MongoDB is running on the host machine:

```yaml
# config/local.yaml
servers:
    local:
        name: Host MongoDB
        uri: mongodb://host.docker.internal:27017/db
```

On Linux, add to `docker-compose.yml`:

```yaml
services:
    api:
        extra_hosts:
            - "host.docker.internal:host-gateway"
```

### Volume Permissions

If you encounter permission issues with logs:

```bash
# Create logs directory with correct permissions
mkdir -p logs
chmod 777 logs  # Or use specific user:group
```

## Security Considerations

**Production Checklist:**

- ✅ Change default API key in `config/local.yaml`
- ✅ Use strong, random API keys (32+ characters)
- ✅ Configure CORS origins to match your domain
- ✅ Use SSL/TLS for production (reverse proxy)
- ✅ Keep Docker images updated
- ✅ Restrict MongoDB network access
- ✅ Review and remove unused MongoDB servers from config
- ✅ Set appropriate log levels (`warn` or `error` for production)

**Reverse Proxy Example (nginx with SSE support):**

```nginx
# API Reverse Proxy with Server-Sent Events (SSE) support
server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Recommended SSL settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # General proxy settings
    location / {
        proxy_pass http://localhost:7011;
        proxy_http_version 1.1;

        # Essential headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket upgrade headers (if needed in future)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    # SSE-specific configuration for streaming endpoints
    location ~ ^/api/queries/.*/stream$ {
        proxy_pass http://localhost:7011;
        proxy_http_version 1.1;

        # Essential for SSE
        proxy_set_header Connection '';
        proxy_buffering off;
        proxy_cache off;

        # Disable timeouts for long-running connections
        proxy_read_timeout 24h;
        proxy_send_timeout 24h;

        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Ensure chunked transfer encoding is preserved
        chunked_transfer_encoding on;

        # Prevent gzip compression on SSE streams
        gzip off;
    }
}

# Frontend Reverse Proxy
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    location / {
        proxy_pass http://localhost:7010;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Key SSE Configuration Points:**

- `proxy_buffering off`: Disables nginx buffering for SSE streams
- `proxy_cache off`: Disables caching for real-time data
- `proxy_set_header Connection ''`: Essential for HTTP/1.1 persistent connections
- `proxy_read_timeout 24h`: Prevents timeout on long-running SSE connections
- `chunked_transfer_encoding on`: Preserves chunked encoding from backend
- `gzip off`: Prevents compression that would buffer SSE data

## Performance Tuning

### API Container

Adjust Node.js memory if monitoring large MongoDB instances:

```yaml
# docker-compose.yml
services:
    api:
        environment:
            - NODE_OPTIONS=--max-old-space-size=4096
```

### Web Container

nginx is pre-configured with:

- Gzip compression
- Static asset caching (1 year)
- Security headers

To customize, edit `apps/web/nginx.conf` and rebuild.

## Monitoring

### Container Health

```bash
# Check container status
docker compose ps

# View resource usage
docker stats mongotop-web-api mongotop-web-web

# Check logs
docker compose logs -f --tail=100
```

### Application Health

```bash
# API health endpoint
curl http://localhost:7011/health

# Web health endpoint
curl http://localhost:7010/health

# Test MongoDB connection
curl -H "X-API-Key: your-key" http://localhost:7011/api/servers
```

## Backup and Restore

### Backup Configuration

```bash
# Backup config files
tar -czf mongotop-web-config.tar.gz config/

# Backup logs
tar -czf mongotop-web-logs.tar.gz logs/
```

### Restore Configuration

```bash
# Restore config
tar -xzf mongotop-web-config.tar.gz

# Rebuild with restored config
./docker-build.sh
docker compose up -d
```

## Upgrading

```bash
# Pull latest code
git pull

# Rebuild images
./docker-build.sh

# Restart services (will use new images)
docker compose up -d

# Remove old images (optional)
docker image prune
```

## Uninstalling

```bash
# Stop and remove containers
docker compose down

# Remove images
docker rmi mongotop-web-api mongotop-web-web

# Remove volumes (if any)
docker volume prune

# Remove local data (optional)
rm -rf logs/
```
