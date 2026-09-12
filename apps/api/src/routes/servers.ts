import type { ServerConfig } from "@mongotop-web/types";
import config from "config";
import type { FastifyInstance } from "fastify";

// Reads config/default.yaml merged with config/local.yaml.
const serverConfigs = config.get<Record<string, ServerConfig>>("servers");

export default async function serversRoutes(fastify: FastifyInstance) {
    fastify.get("/", async (request) => {
        const serverList = Object.entries(serverConfigs).map(([id, config]) => ({
            id,
            name: config.name,
            connected: request.services.mongoService.isConnected(id),
        }));

        serverList.unshift({
            id: "mock",
            name: "Mock Data",
            connected: true,
        });

        return { servers: serverList };
    });

    fastify.post<{
        Params: { id: string };
    }>("/:id/connect", async (request, reply) => {
        const { id } = request.params;

        if (id === "mock") {
            return {
                success: true,
                serverId: "mock",
                serverName: "Mock Data (UI Testing)",
            };
        }

        const serverConfig = serverConfigs[id];

        if (!serverConfig) {
            return reply.code(404).send({ error: "Server not found" });
        }

        try {
            await request.services.mongoService.connect(id, serverConfig.uri);
            return {
                success: true,
                serverId: id,
                serverName: serverConfig.name,
            };
        } catch (err) {
            return reply.code(500).send({
                error: "Connection failed",
                message: (err as Error).message,
            });
        }
    });

    fastify.post<{
        Params: { id: string };
    }>("/:id/disconnect", async (request, reply) => {
        const { id } = request.params;

        if (id === "mock") {
            return {
                success: true,
                serverId: "mock",
            };
        }

        if (!request.services.mongoService.isConnected(id)) {
            return reply.code(404).send({ error: "Server not connected" });
        }

        try {
            await request.services.mongoService.disconnect(id);
            return {
                success: true,
                serverId: id,
            };
        } catch (err) {
            return reply.code(500).send({
                error: "Disconnect failed",
                message: (err as Error).message,
            });
        }
    });

    fastify.get<{
        Params: { id: string };
    }>("/:id/status", async (request, reply) => {
        const { id } = request.params;

        if (id === "mock") {
            return {
                serverId: "mock",
                serverName: "Mock Data (UI Testing)",
                connected: true,
            };
        }

        const serverConfig = serverConfigs[id];

        if (!serverConfig) {
            return reply.code(404).send({ error: "Server not found" });
        }

        const connected = request.services.mongoService.isConnected(id);

        return {
            serverId: id,
            serverName: serverConfig.name,
            connected,
        };
    });
}
