import type { ServerConfig } from "@mongotop-web/types";
import config from "config";
import { log } from "evlog";
import { MongoClient } from "mongodb";
import { buildDirectUri } from "./directUri.js";

const serverConfigs = config.get<Record<string, ServerConfig>>("servers");

// Match MongoConnectionService: keep BSON Longs intact to avoid Number overflow.
const CLIENT_OPTIONS = { promoteLongs: false, promoteValues: true, promoteBuffers: false };

// Dedicated directConnection clients, one per node, reused across streams so
// switching nodes or reconnecting doesn't churn connections.
const pinnedClients = new Map<string, MongoClient>();

const keyFor = (serverId: string, host: string): string => `${serverId}::${host}`;

export const getPinnedClient = async (serverId: string, host: string, replicaSetUri: string): Promise<MongoClient> => {
    const key = keyFor(serverId, host);
    const existing = pinnedClients.get(key);
    if (existing) {
        return existing;
    }

    const client = new MongoClient(buildDirectUri(replicaSetUri, host), CLIENT_OPTIONS);
    await client.connect();
    pinnedClients.set(key, client);
    return client;
};

// Resolves the sampling client for a stream. When a specific node is requested,
// pins to it via a directConnection client so consecutive samples hit the same
// node (per-interval diffs across different secondaries are meaningless). Falls
// back to the pooled client if pinning fails (e.g. mongodb+srv uris).
export const resolveSampleClient = async (
    pooledClient: MongoClient,
    serverId: string,
    node: string | undefined,
): Promise<{ client: MongoClient; pinned: boolean }> => {
    const uri = serverConfigs[serverId]?.uri;
    if (!node || !uri) {
        return { client: pooledClient, pinned: false };
    }

    try {
        const client = await getPinnedClient(serverId, node, uri);
        return { client, pinned: true };
    } catch (err) {
        log.warn({ nodePinning: { event: "failed", server: serverId, node }, error: (err as Error).message });
        return { client: pooledClient, pinned: false };
    }
};

export const closePinnedClients = async (): Promise<void> => {
    const clients = Array.from(pinnedClients.values());
    pinnedClients.clear();
    await Promise.all(clients.map(async (client) => client.close()));
};
