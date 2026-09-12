import type {
    ClientSummary,
    ConnectedClient,
    GeoLocation,
    MongoQuery,
    ProcessedQuery,
    QuerySummary,
} from "@mongotop-web/types";
import { useLogger } from "evlog/fastify";
import geoip from "geoip-lite";
import shortHumanizeTime from "../lib/helpers.js";
import { formatUserAgent, sanitizeQuery, shouldSkipConnection, shouldSkipQuery } from "../lib/queryProcessor.js";

export class QueryService {
    private readonly geoCache: Map<string, GeoLocation | null> = new Map();

    processQueries(queries: MongoQuery[], showAll = false): ProcessedQuery[] {
        const filtered = showAll ? queries : queries.filter((q) => !shouldSkipQuery(q));

        const processed = filtered
            .sort((a, b) => b.microsecs_running - a.microsecs_running) // Descending: longest at top
            .map((q, idx) => this.toProcessedQuery(q, idx + 1));

        // Enrich the request's wide event from the service layer without threading `request` through.
        useLogger().set({ queries: { received: queries.length, processed: processed.length, showAll } });

        return processed;
    }

    private toProcessedQuery(q: MongoQuery, idx: number): ProcessedQuery {
        const [db, ...collParts] = q.ns.split(".");
        const collection = collParts.join(".");

        const clientInfo = this.parseClient(q.client);

        // MongoDB returns opid as signed 32-bit int - use >>> 0 to convert to unsigned
        const opidStr = typeof q.opid === "number" ? String(q.opid >>> 0) : String(q.opid);

        return {
            idx,
            opid: opidStr,
            secs_running: q.secs_running,
            runtime_formatted: this.formatRuntime(q.secs_running),
            operation: q.op,
            namespace: q.ns,
            database: db,
            collection,
            query: sanitizeQuery(q),
            rawLog: { type: q.op, ns: q.ns, command: q.command },
            client: clientInfo,
            userAgent: formatUserAgent(q),
            planSummary: q.planSummary,
            isCollscan: q.planSummary === "COLLSCAN",
            waitingForLock: q.waitingForLock,
            message: q.msg,
            effectiveUsers: q.effectiveUsers,
        };
    }

    generateSummary(queries: ProcessedQuery[]): QuerySummary {
        const operations: Record<string, number> = {};
        const collections: Record<string, number> = {};
        const clients: Record<string, number> = {};
        let unindexedCount = 0;

        for (const q of queries) {
            operations[q.operation] = (operations[q.operation] || 0) + 1;
            collections[q.collection] = (collections[q.collection] || 0) + 1;
            clients[q.userAgent] = (clients[q.userAgent] || 0) + 1;
            if (q.isCollscan) {
                unindexedCount++;
            }
        }

        return {
            totalQueries: queries.length,
            shownQueries: queries.length,
            operations,
            collections,
            clients,
            unindexedCount,
        };
    }

    processClients(docs: MongoQuery[], showAll = false): ConnectedClient[] {
        const filtered = showAll ? docs : docs.filter((c) => !shouldSkipConnection(c));

        return filtered
            .map((c) => this.toConnectedClient(c))
            .sort((a, b) => Number(b.active) - Number(a.active) || (b.secs_running ?? 0) - (a.secs_running ?? 0));
    }

    private toConnectedClient(c: MongoQuery): ConnectedClient {
        return {
            connectionId: c.connectionId,
            client: this.parseClient(c.client),
            appName: c.appName,
            userAgent: formatUserAgent(c),
            effectiveUsers: c.effectiveUsers,
            active: c.active,
            currentOp: c.active ? c.op : undefined,
            namespace: c.active && c.ns ? c.ns : undefined,
            secs_running: c.secs_running,
            runtime_formatted: c.secs_running ? this.formatRuntime(c.secs_running) : undefined,
        };
    }

    generateClientSummary(clients: ConnectedClient[]): ClientSummary {
        const byApp: Record<string, number> = {};
        const byUser: Record<string, number> = {};
        const byIp: Record<string, number> = {};
        let activeConnections = 0;

        for (const c of clients) {
            byApp[c.userAgent] = (byApp[c.userAgent] || 0) + 1;
            byIp[c.client.ip] = (byIp[c.client.ip] || 0) + 1;

            const users = c.effectiveUsers?.length
                ? c.effectiveUsers.map((u) => `${u.user}@${u.db}`)
                : ["unauthenticated"];
            for (const user of users) {
                byUser[user] = (byUser[user] || 0) + 1;
            }

            if (c.active) {
                activeConnections++;
            }
        }

        return {
            totalConnections: clients.length,
            activeConnections,
            idleConnections: clients.length - activeConnections,
            byApp,
            byUser,
            byIp,
        };
    }

    private formatRuntime(seconds: number): string {
        return shortHumanizeTime(seconds * 1000);
    }

    private parseClient(client?: string): { ip: string; port?: number; geo?: GeoLocation | null } {
        if (!client) {
            return { ip: "unknown" };
        }

        const parts = client.split(":");
        const ip = parts[0];
        const port = parts[1] ? parseInt(parts[1], 10) : undefined;

        const isPublicIp = ip && !ip.startsWith("192.") && !ip.startsWith("10.") && !ip.startsWith("127.");
        const geo = isPublicIp ? this.lookupGeo(ip) : null;

        return { ip, port, geo };
    }

    private lookupGeo(ip: string): GeoLocation | null {
        if (!this.geoCache.has(ip)) {
            this.geoCache.set(ip, geoip.lookup(ip));
        }
        return this.geoCache.get(ip) ?? null;
    }
}
