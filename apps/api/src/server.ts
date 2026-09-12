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

// evlog is the only logger, Fastify's pino is disabled. The evlog plugin emits one wide
// event per request via request.log; the global `log` (evlog) handles standalone events
// (startup/shutdown, SSE lifecycle, auto-save, idle disconnect).
const fastify = Fastify({ logger: false });

const mongoService = new MongoConnectionService(config.get<number>("api.idleDisconnectMs"));
const queryService = new QueryService();
const loggerService = new QueryLoggerService();

await fastify.register(cors, {
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl) alongside configured origins.
        if (!origin) {
            callback(null, true);
            return;
        }

        const configuredOrigins = config.get<string[]>("api.cors.origins");

        const isConfiguredOrigin = configuredOrigins.includes(origin);
        if (isConfiguredOrigin) {
            callback(null, true);
            return;
        }

        // Also allow the 192.x.x.x range so LAN dev machines can reach the API.
        const is192Range = /^ht{2}ps?:\/{2}192(?:\.\d{1,3}){3}(:\d+)?$/.test(origin);
        if (is192Range) {
            callback(null, true);
            return;
        }

        callback(new Error("Not allowed by CORS"), false);
    },
    credentials: config.get<boolean>("api.cors.credentials"),
});

// evlog emits one structured wide event per request via request.log (the only request
// logger, since Fastify's pino is disabled). Registered before the auth/service hooks so
// request.log is available inside them.
await fastify.register(evlog);

// API key auth: accepts header or query param since EventSource can't set custom headers.
fastify.addHook("onRequest", async (request, reply) => {
    // Skip auth for OPTIONS requests (CORS preflight)
    if (request.method === "OPTIONS") {
        return;
    }

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

fastify.addHook("onRequest", async (request) => {
    request.services = { mongoService, queryService, loggerService };
});

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

fastify.get("/health", async () => {
    return {
        status: "ok",
        timestamp: new Date().toISOString(),
        connectedServers: mongoService.getConnectedServers(),
    };
});

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
