import { log } from "evlog";
import { Db, MongoClient } from "mongodb";

export class MongoConnectionService {
    private readonly connections: Map<string, MongoClient> = new Map();
    private readonly activeStreamCounts: Map<string, number> = new Map();
    private readonly idleTimers: Map<string, NodeJS.Timeout> = new Map();

    // idleDisconnectMs comes from config/default.yaml (api.idleDisconnectMs) — no local default,
    // config is the single source of truth so the two values can't drift.
    constructor(private readonly idleDisconnectMs: number) {}

    async connect(serverId: string, uri: string): Promise<MongoClient> {
        const existing = this.connections.get(serverId);
        if (existing) {
            return existing;
        }

        const client = new MongoClient(uri, {
            appName: "MongoTop",
            // Prevent BSON Long from auto-converting to Number to avoid overflow
            promoteLongs: false,
            promoteValues: true,
            promoteBuffers: false,
        });
        await client.connect();
        this.connections.set(serverId, client);
        return client;
    }

    async disconnect(serverId: string): Promise<void> {
        this.clearIdleTimer(serverId);
        this.activeStreamCounts.delete(serverId);

        const client = this.connections.get(serverId);
        if (client) {
            await client.close();
            this.connections.delete(serverId);
        }
    }

    async disconnectAll(): Promise<void> {
        for (const serverId of this.idleTimers.keys()) {
            this.clearIdleTimer(serverId);
        }
        this.activeStreamCounts.clear();

        await Promise.all(Array.from(this.connections.values()).map(async (client) => client.close()));
        this.connections.clear();
    }

    // Call when an SSE stream for serverId starts. Cancels any pending idle disconnect.
    registerStream(serverId: string): void {
        this.clearIdleTimer(serverId);
        const count = this.activeStreamCounts.get(serverId) ?? 0;
        this.activeStreamCounts.set(serverId, count + 1);
    }

    // Call when an SSE stream for serverId ends. Once the last viewer leaves,
    // starts a grace-period timer before disconnecting the underlying MongoClient.
    unregisterStream(serverId: string): void {
        const count = (this.activeStreamCounts.get(serverId) ?? 1) - 1;

        if (count > 0) {
            this.activeStreamCounts.set(serverId, count);
            return;
        }

        this.activeStreamCounts.delete(serverId);
        this.clearIdleTimer(serverId);

        const timer = setTimeout(() => {
            this.idleTimers.delete(serverId);
            if (this.activeStreamCounts.has(serverId) || !this.connections.has(serverId)) {
                return;
            }

            log.info({
                event: "idle_disconnect",
                server: { id: serverId },
                idleDisconnectMs: this.idleDisconnectMs,
            });
            void this.disconnect(serverId);
        }, this.idleDisconnectMs);

        this.idleTimers.set(serverId, timer);
    }

    private clearIdleTimer(serverId: string): void {
        const timer = this.idleTimers.get(serverId);
        if (timer) {
            clearTimeout(timer);
            this.idleTimers.delete(serverId);
        }
    }

    getConnection(serverId: string): MongoClient | undefined {
        return this.connections.get(serverId);
    }

    getDb(serverId: string, dbName = "admin"): Db | undefined {
        const client = this.connections.get(serverId);
        return client?.db(dbName);
    }

    isConnected(serverId: string): boolean {
        return this.connections.has(serverId);
    }

    getConnectedServers(): string[] {
        return Array.from(this.connections.keys());
    }
}
