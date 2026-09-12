import { createError } from "evlog";

const SCHEME = "mongodb://";

// Rewrites a replica-set URI to target one host directly (drops replicaSet,
// forces directConnection) so per-interval sampling stays on the same node.
// Only standard mongodb:// URIs work; the caller falls back for mongodb+srv://.
export const buildDirectUri = (uri: string, host: string): string => {
    if (!uri.startsWith(SCHEME)) {
        throw createError({
            message: "Node pinning requires a standard mongodb:// connection string",
            status: 400,
            why: "The configured URI is a mongodb+srv:// (or otherwise non-standard) string, which can't be pinned to a single node.",
            fix: "Use a standard mongodb://host:port connection string for the server you want to node-pin.",
        });
    }

    const rest = uri.slice(SCHEME.length);
    const atIndex = rest.lastIndexOf("@");
    const credentials = atIndex >= 0 ? rest.slice(0, atIndex + 1) : "";
    const afterCredentials = atIndex >= 0 ? rest.slice(atIndex + 1) : rest;

    const slashIndex = afterCredentials.indexOf("/");
    const tail = slashIndex >= 0 ? afterCredentials.slice(slashIndex) : "/";
    const queryIndex = tail.indexOf("?");
    const path = queryIndex >= 0 ? tail.slice(0, queryIndex) : tail;

    const params = new URLSearchParams(queryIndex >= 0 ? tail.slice(queryIndex + 1) : "");
    params.delete("replicaSet");
    params.set("directConnection", "true");

    return `${SCHEME}${credentials}${host}${path}?${params.toString()}`;
};
