import type { MongoQuery } from "@mongotop-web/types";
import { omit } from "lodash-es";
import { beautifyJson } from "./helpers.js";

const INTERNAL_DRIVER_PATTERN = /MongoDB Internal Client|NetworkInterfaceTL/;
const PHP_EXT_DRIVER_PATTERN = /ext-mongodb/i;
const MONITORING_OR_AUTOMATION_APP_PATTERN = /mongodb (monitoring module|automation)/i;

export const shouldSkipQuery = (q: MongoQuery): boolean => {
    const { command, clientMetadata, appName } = q;

    const isIndex = q.ns?.includes("system.indexes");
    if (isIndex) {
        // Always show indexing queries
        return false;
    }

    if (q.client?.startsWith("192")) {
        // This is an internal query
        return true;
    }

    if (clientMetadata) {
        if (clientMetadata.driver?.name?.match(INTERNAL_DRIVER_PATTERN)) {
            return true;
        }
        if (clientMetadata.driver?.name?.match(PHP_EXT_DRIVER_PATTERN)) {
            // This is from our PHP MongoDB extension - always show this
            return false;
        }
    }

    if (appName?.match(MONITORING_OR_AUTOMATION_APP_PATTERN)) {
        return true;
    }

    if (q.command.hello === 1 || q.command.hello === true) {
        return true;
    }

    if (command?.ismaster === true) {
        return true;
    }

    if (command["$db"] === "config") {
        return true;
    }

    return false;
};

const MONITORING_AGENT_APP_PATTERN = /mongodb (monitoring module|automation agent|cps module)|mongotune/i;

// Filters internal/system connections from the connected-clients view.
// Unlike shouldSkipQuery, connections may be idle (no command), so we key off
// client metadata, agent app names, and the __system auth user instead.
export const shouldSkipConnection = (c: MongoQuery): boolean => {
    const { client, clientMetadata, appName, effectiveUsers } = c;

    // No client address means an internal connection (no real user behind it).
    if (!client) {
        return true;
    }

    if (clientMetadata?.driver?.name?.match(INTERNAL_DRIVER_PATTERN)) {
        return true;
    }

    if (appName?.match(MONITORING_AGENT_APP_PATTERN)) {
        return true;
    }

    if (effectiveUsers?.some((u) => u.user === "__system" || u.user === "mms-mongotune")) {
        return true;
    }

    return false;
};

export const sanitizeQuery = (q: MongoQuery, full = true): Record<string, unknown> => {
    // omit() strips fields not modeled on MongoQuery (e.g. "type"), so the result is
    // cast once here rather than re-cast at every mutation site below.
    let query = omit(q, [
        "active",
        "client",
        "command.$clusterTime",
        "command.lsid",
        "command.$db",
        "connectionId",
        "clientMetadata",
        "desc",
        "host",
        "flowControlStats",
        "numYields",
        // TODO: Some processing on lock stats
        "lockStats",
        "locks",
        "lsid",
        "opid",
        "microsecs_running",
        "transaction",
        "waitingForFlowControl",
        "waitingForLatch",
        "planSummary", // TODO: Better way to show this
    ]) as Record<string, unknown>;

    if (q.appName?.match(/nosqlbooster/i)) {
        query = omit(query, ["clientMetadata"]);
    }

    if (full) {
        query = omit(query, ["appName", "effectiveUsers", "ns", "op", "secs_running"]);
    }

    if ((q as unknown as Record<string, unknown>).type === "op") {
        delete query.type;
    }

    if (q.waitingForLock === false) {
        delete query.waitingForLock;
    }

    if (Object.keys(query).length === 1 && query.command) {
        // The query is the only thing left after filtering
        return query.command as Record<string, unknown>;
    }

    return query;
};

interface UserAgentRule {
    getValue: (q: MongoQuery) => string | null | undefined;
    pattern: RegExp;
    label: string;
}

// Ordered — first match wins. Order matters: appName takes precedence over
// clientMetadata, and driver/application checks interleave to preserve behavior.
const USER_AGENT_RULES: UserAgentRule[] = [
    { getValue: (q) => q.appName, pattern: /nosqlbooster/i, label: "NoSQLBooster" },
    { getValue: (q) => q.appName, pattern: /mongodb monitoring module/i, label: "Monitoring Module" },
    { getValue: (q) => q.appName, pattern: /mongodb automation agent/i, label: "Automation Agent" },
    { getValue: (q) => q.clientMetadata?.driver?.name, pattern: /nodejs\|mongoose/i, label: "Mongoose" },
    { getValue: (q) => q.clientMetadata?.driver?.name, pattern: /networkinterfacetl/i, label: "NetworkInterfaceTL" },
    {
        getValue: (q) => q.clientMetadata?.application?.name,
        pattern: /mongodb monitoring module/i,
        label: "Monitoring Module",
    },
    {
        getValue: (q) => q.clientMetadata?.application?.name,
        pattern: /mongodb automation agent/i,
        label: "Automation Agent",
    },
    { getValue: (q) => q.clientMetadata?.application?.name, pattern: /oplogfetcher/i, label: "OplogFetcher" },
    { getValue: (q) => q.clientMetadata?.application?.name, pattern: /mongodb cps module/i, label: "CPS Module" },
    { getValue: (q) => q.clientMetadata?.driver?.name, pattern: /ext-mongodb:PHP/, label: "PHP ext-mongodb" },
];

const NODE_RE = /node(.js)?\sv\d+/i;

export const formatUserAgent = (q: MongoQuery): string => {
    const matchedRule = USER_AGENT_RULES.find((rule) => rule.getValue(q)?.match(rule.pattern));
    if (matchedRule) {
        return matchedRule.label;
    }

    // Custom appName (set via MongoClient `appName` option) takes precedence over the
    // generic "Node.js vXX" platform label, otherwise every custom-named client would
    // be indistinguishable from a plain Node client.
    const customAppName = q.appName ?? q.clientMetadata?.application?.name;
    if (customAppName) {
        return customAppName;
    }

    const nodeMatch = q.clientMetadata?.platform?.match(NODE_RE);
    if (nodeMatch?.[0]) {
        return nodeMatch[0];
    }

    return q.clientMetadata?.driver?.name ?? beautifyJson(q.clientMetadata);
};
