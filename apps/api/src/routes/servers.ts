import type { ServerConfig } from "@mongotop-web/types";
import config from "config";
import type { FastifyInstance } from "fastify";

// Load server configs using the config module
// Looks for config/default.yaml and config/local.yaml in project root
const serverConfigs = config.get<Record<string, ServerConfig>>("servers");

export default async function serversRoutes(fastify: FastifyInstance) {
    // GET /api/servers - List all configured servers
    fastify.get("/", async (request) => {
        const serverList = Object.entries(serverConfigs).map(([id, config]) => ({
            id,
            name: config.name,
            connected: request.services.mongoService.isConnected(id),
        }));

        // Add mock server for UI testing
        serverList.unshift({
            id: "mock",
            name: "Mock Data",
            connected: true,
        });

        return { servers: serverList };
    });

    // POST /api/servers/:id/connect - Connect to a server
    fastify.post<{
        Params: { id: string };
    }>("/:id/connect", async (request, reply) => {
        const { id } = request.params;

        // Mock server is always connected
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

    // POST /api/servers/:id/disconnect - Disconnect from a server
    fastify.post<{
        Params: { id: string };
    }>("/:id/disconnect", async (request, reply) => {
        const { id } = request.params;

        // Mock server cannot be disconnected
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

    // GET /api/servers/:id/status - Check server connection status
    fastify.get<{
        Params: { id: string };
    }>("/:id/status", async (request, reply) => {
        const { id } = request.params;

        // Mock server is always connected
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
