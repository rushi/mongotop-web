import type {
    ActivityMetric,
    CollectionActivity,
    TopCommandResult,
    TopMetric,
    TopNamespaceStats,
} from "@mongotop-web/types";

const SYSTEM_DB_PATTERN = /^(admin|config|local)\./;

export const isSystemNamespace = (ns: string): boolean => {
    if (SYSTEM_DB_PATTERN.test(ns)) {
        return true;
    }
    if (ns.includes(".system.")) {
        return true;
    }
    return false;
};

// A `totals` entry is a real namespace only when it is an object carrying a
// `total` metric. The command also returns a `note` string, which we skip.
const isNamespaceStats = (value: unknown): value is TopNamespaceStats =>
    typeof value === "object" && value !== null && "total" in value;

// Clamp negative deltas: a counter going backwards means a server restart /
// counter reset, not negative activity.
const clampedDelta = (current: number, previous: number): number => Math.max(current - previous, 0);

const toActivityMetric = (current: TopMetric, previous: TopMetric | undefined): ActivityMetric => ({
    deltaTime: previous ? clampedDelta(current.time, previous.time) : 0,
    deltaCount: previous ? clampedDelta(current.count, previous.count) : 0,
    cumTime: current.time,
    cumCount: current.count,
});

export const buildCollectionActivity = (
    current: TopCommandResult,
    previous: TopCommandResult | undefined,
    showAll: boolean,
): CollectionActivity[] => {
    const activity: CollectionActivity[] = [];

    for (const [ns, stats] of Object.entries(current.totals)) {
        if (!isNamespaceStats(stats)) {
            continue;
        }

        const isSystem = isSystemNamespace(ns);
        if (!showAll && isSystem) {
            continue;
        }

        const previousStats = previous?.totals?.[ns];
        const prev = isNamespaceStats(previousStats) ? previousStats : undefined;

        const [db, ...rest] = ns.split(".");

        activity.push({
            ns,
            db,
            coll: rest.join("."),
            isSystem,
            total: toActivityMetric(stats.total, prev?.total),
            read: toActivityMetric(stats.readLock, prev?.readLock),
            write: toActivityMetric(stats.writeLock, prev?.writeLock),
        });
    }

    return activity;
};
