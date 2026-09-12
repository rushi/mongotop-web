# syntax=docker/dockerfile:1

# Base stage - install dependencies
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /app

# Dependencies stage - install all dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

# Builder stage - build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY . .

# Build argument for custom API URL (optional)
ARG API_URL

# Generate web config from YAML files (no environment variables!)
# NODE_ENV=production selects config/production.yaml so the fallback API URL
# (used when API_URL isn't passed) picks up the production port, not the dev one.
RUN if [ -n "$API_URL" ]; then \
        NODE_ENV=production node scripts/generate-web-config.js "$API_URL"; \
    else \
        NODE_ENV=production node scripts/generate-web-config.js; \
    fi

RUN pnpm run build --filter=@mongotop-web/web

# Runner stage - serve with nginx
FROM nginx:alpine AS runner

# Copy built assets from builder
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# Copy nginx configuration
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
