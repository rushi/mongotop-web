# syntax=docker/dockerfile:1

# Base stage - install dependencies
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate
WORKDIR /app

# Dependencies stage - install all dependencies
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

# Builder stage - build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/types/node_modules ./packages/types/node_modules
COPY . .

# Clean any stale tsbuildinfo files that might prevent proper emission
RUN rm -f packages/types/*.tsbuildinfo apps/api/*.tsbuildinfo

# Build types package first
RUN pnpm --filter=@mongotop-web/types run build

# Build API (now it can find the types)
RUN pnpm --filter=@mongotop-web/api run build

# Runner stage - production runtime
FROM node:24-alpine AS runner
WORKDIR /app

# Install pnpm in runner
RUN corepack enable && corepack prepare pnpm@10.8.0 --activate

# Copy necessary files for production
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/turbo.json ./
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/config ./config

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

# Set environment
ENV NODE_ENV=production
ENV API_PORT=7011
ENV API_HOST=0.0.0.0

EXPOSE 7011

CMD ["node", "apps/api/dist/server.js"]
