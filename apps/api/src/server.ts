#!/usr/bin/env node
import cors from "@fastify/cors";
import config from "config";
import { initLogger, log, parseError } from "evlog";
import { evlog } from "evlog/fastify";
import Fastify from "fastify";
import { MongoConnectionService, QueryLoggerService, QueryService } from "./core/index.js";
import { closePinnedClients } from "./core/lib/pinnedClient.js";
import clientsRoutes from "./routes/clients.js";
import queriesRoutes from "./routes/queries.js";
import serversRoutes from "./routes/servers.js";
import topRoutes from "./routes/top.js";

// Extend Fastify types to include services
declare module "fastify" {
    interface FastifyRequest {
        services: {
            mongoService: MongoConnectionService;
            queryService: QueryService;
            loggerService: QueryLoggerService;
        };
    }
}

// Initialize evlog before Fastify so wide events carry the service name.
initLogger({ env: { service: "mongotop-web-api" } });

// evlog is the only logger — Fastify's pino is disabled. The evlog plugin emits one wide
// event per request via request.log; the global `log` (evlog) handles standalone events
// (startup/shutdown, SSE lifecycle, auto-save, idle disconnect).
const fastify = Fastify({ logger: false });

// Services - singleton instances
const mongoService = new MongoConnectionService(config.get<number>("api.idleDisconnectMs"));
const queryService = new QueryService();
const loggerService = new QueryLoggerService();

// CORS for frontend - allow configured origins + 192.x.x.x IP range
await fastify.register(cors, {
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl)
        if (!origin) {
            callback(null, true);
            return;
        }

        const configuredOrigins = config.get<string[]>("api.cors.origins");

        // Check if origin matches configured origins
        const isConfiguredOrigin = configuredOrigins.includes(origin);
        if (isConfiguredOrigin) {
            callback(null, true);
            return;
        }

        // Check if origin is from 192.x.x.x IP range (private network)
        const is192Range = /^ht{2}ps?:\/{2}192(?:\.\d{1,3}){3}(:\d+)?$/.test(origin);
        if (is192Range) {
            callback(null, true);
            return;
        }

        // Reject all other origins
        callback(new Error("Not allowed by CORS"), false);
    },
    credentials: config.get<boolean>("api.cors.credentials"),
});

// evlog — emit one structured wide event per request via request.log (the only request
// logger, since Fastify's pino is disabled). Registered before the auth/service hooks so
// request.log is available inside them.
await fastify.register(evlog);

// Simple API key auth middleware (supports both header and query parameter for EventSource compatibility)
fastify.addHook("onRequest", async (request, reply) => {
    // Skip auth for OPTIONS requests (CORS preflight)
    if (request.method === "OPTIONS") {
        return;
    }

    // Skip auth for health check
    if (request.url === "/health") {
        return;
    }

    const headerKey = request.headers["x-api-key"] as string;
    const queryKey = (request.query as Record<string, string>)?.apiKey;
    const apiKey = headerKey || queryKey;
    const validKey = config.get<string>("api.apiKey");

    if (apiKey !== validKey) {
        reply.code(401).send({ error: "Unauthorized" });
    }
});

// Attach services to request context
fastify.addHook("onRequest", async (request) => {
    request.services = { mongoService, queryService, loggerService };
});

// Routes
await fastify.register(serversRoutes, { prefix: "/api/servers" });
await fastify.register(queriesRoutes, { prefix: "/api/queries" });
await fastify.register(clientsRoutes, { prefix: "/api/clients" });
await fastify.register(topRoutes, { prefix: "/api/top" });

// Translate thrown errors into structured JSON. createError() carries why/fix/link/status;
// parseError() also normalizes plain Errors so the shape is consistent for the web client.
fastify.setErrorHandler((error, request, reply) => {
    request.log.error(error);
    const parsed = parseError(error);
    reply.status(parsed.status ?? 500).send({
        message: parsed.message,
        why: parsed.why,
        fix: parsed.fix,
        link: parsed.link,
    });
});

// Health check
fastify.get("/health", async () => {
    return {
        status: "ok",
        timestamp: new Date().toISOString(),
        connectedServers: mongoService.getConnectedServers(),
    };
});

// Graceful shutdown
process.on("SIGINT", async () => {
    log.info({ server: { event: "shutdown" } });
    await mongoService.disconnectAll();
    await closePinnedClients();
    await fastify.close();
    process.exit(0);
});

process.on("SIGTERM", async () => {
    log.info({ server: { event: "shutdown" } });
    await mongoService.disconnectAll();
    await closePinnedClients();
    await fastify.close();
    process.exit(0);
});

// Start server
const start = async () => {
    try {
        const port = config.get<number>("api.port");
        const host = config.get<string>("api.host");

        await fastify.listen({ port, host });
        log.info({ server: { event: "started", host, port } });
    } catch (err) {
        log.error({
            server: { event: "startup_failed" },
            error: err instanceof Error ? (err.stack ?? err.message) : String(err),
        });
        process.exit(1);
    }
};

start();
