import type { MongoQuery } from "@mongotop-web/types";
import { log } from "evlog";
import type { FastifyInstance } from "fastify";
import type { MongoClient } from "mongodb";
import type { QueryService } from "../core/index.js";
import { resolveSampleClient } from "../core/lib/pinnedClient.js";
import { parseReadPreference } from "../core/lib/readPreference.js";

// Lists live connections via $currentOp (includes idle connections), so the
// view reflects who is connected, not just who is running an operation.
const CURRENT_OP_PIPELINE = [{ $currentOp: { allUsers: true, idleConnections: true } }];

const buildClientsData = async (
    mongoClient: MongoClient,
    queryService: QueryService,
    serverId: string,
    showAll: boolean,
    readPreference?: string,
) => {
    const docs = await mongoClient
        .db("admin")
        .aggregate(CURRENT_OP_PIPELINE, { readPreference: parseReadPreference(readPreference) })
        .toArray();

    const clients = queryService.processClients(docs as MongoQuery[], showAll);
    const summary = queryService.generateClientSummary(clients);

    return { clients, summary, metadata: { serverId, timestamp: new Date().toISOString() } };
};

export default async function clientsRoutes(fastify: FastifyInstance) {
    fastify.get<{
        Params: { serverId: string };
        Querystring: { showAll?: string; readPreference?: string };
    }>("/:serverId", async (request, reply) => {
        const { serverId } = request.params;
        const { showAll = "false", readPreference } = request.query;

        const client = request.services.mongoService.getConnection(serverId);
        if (!client) {
            return reply.code(404).send({ error: "Server not connected" });
        }

        try {
            return await buildClientsData(
                client,
                request.services.queryService,
                serverId,
                showAll === "true",
                readPreference,
            );
        } catch (err) {
            return reply.code(500).send({
                error: "Failed to fetch connected clients",
                message: (err as Error).message,
            });
        }
    });

    fastify.get<{
        Params: { serverId: string };
        Querystring: { refreshInterval?: string; showAll?: string; readPreference?: string; node?: string };
    }>("/:serverId/stream", async (request, reply) => {
        // SSE: take over the socket so Fastify never auto-sends a reply (see queries.ts).
        reply.hijack();

        const { serverId } = request.params;
        const { refreshInterval = "2", showAll = "false", readPreference, node } = request.query;

        const client = request.services.mongoService.getConnection(serverId);
        if (!client) {
            reply.raw.writeHead(404, {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": request.headers.origin ?? "*",
                "Access-Control-Allow-Credentials": "true",
            });
            reply.raw.write(JSON.stringify({ error: "Server not connected" }));
            return reply.raw.end();
        }

        reply.raw.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            "Access-Control-Allow-Origin": request.headers.origin ?? "*",
            "Access-Control-Allow-Credentials": "true",
        });

        // Pin sampling to the requested node so we report clients on that specific
        // member. When pinned, read directly from it (secondaryPreferred lets a
        // secondary accept the read); otherwise honor the requested preference.
        const { client: sampleClient, pinned } = await resolveSampleClient(client, serverId, node);
        const effectiveReadPreference = pinned ? "secondaryPreferred" : readPreference;

        let isActive = true;

        const sendClientUpdate = async () => {
            if (!isActive) {
                return;
            }

            try {
                const data = await buildClientsData(
                    sampleClient,
                    request.services.queryService,
                    serverId,
                    showAll === "true",
                    effectiveReadPreference,
                );
                reply.raw.write(`event: clients\ndata: ${JSON.stringify(data)}\n\n`);
            } catch (err) {
                if (isActive) {
                    reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: (err as Error).message })}\n\n`);
                }
            }
        };

        await sendClientUpdate();

        const intervalId = setInterval(sendClientUpdate, Number(refreshInterval) * 1000);

        const heartbeatId = setInterval(() => {
            if (isActive) {
                reply.raw.write(`:heartbeat\n\n`);
            }
        }, 30000);

        request.raw.on("close", () => {
            isActive = false;
            clearInterval(intervalId);
            clearInterval(heartbeatId);
            log.info({ sse: { event: "closed", route: "clients", server: serverId } });
        });
    });
}
