import type { TopCommandResult, TopMetric, TopNamespaceStats } from "@mongotop-web/types";
import dayjs from "dayjs";

const NAMESPACES = ["shop.orders", "shop.products", "shop.customers", "analytics.events", "admin.system.users"];

const metric = (time: number, count: number): TopMetric => ({ time, count });

const makeStats = (readTime: number, readCount: number, writeTime: number, writeCount: number): TopNamespaceStats => ({
    total: metric(readTime + writeTime, readCount + writeCount),
    readLock: metric(readTime, readCount),
    writeLock: metric(writeTime, writeCount),
    queries: metric(readTime, readCount),
    getmore: metric(0, 0),
    insert: metric(writeTime, writeCount),
    update: metric(0, 0),
    remove: metric(0, 0),
    commands: metric(0, 0),
});

const randInc = (max: number): number => Math.floor(Math.random() * max);

export const MOCK_SERVER_STARTED_AT = dayjs()
    .subtract(2 * 24 * 60 + 63, "minute")
    .toISOString();

// Returns a fresh cumulative snapshot advanced from `previous` (or a baseline
// when there is none), so consecutive calls produce non-zero diffs. Callers own
// the previous-sample state, mirroring a live server's monotonically growing counters.
export const nextMockTop = (previous?: TopCommandResult): TopCommandResult => {
    const totals: Record<string, TopNamespaceStats | string> = { note: "all times in microseconds" };

    for (const ns of NAMESPACES) {
        const prev = previous?.totals?.[ns];
        const base =
            prev && typeof prev === "object"
                ? (prev as TopNamespaceStats)
                : makeStats(randInc(50000), randInc(500), randInc(20000), randInc(200));

        totals[ns] = makeStats(
            base.readLock.time + randInc(8000),
            base.readLock.count + randInc(80),
            base.writeLock.time + randInc(4000),
            base.writeLock.count + randInc(40),
        );
    }

    return { totals, ok: 1 };
};
