import type { TopCommandResult, TopMetric } from "@mongotop-web/types";
import { describe, expect, it } from "vitest";
import { buildCollectionActivity, isSystemNamespace } from "./topProcessor.js";

const metric = (time: number, count: number): TopMetric => ({ time, count });

const nsStats = (readTime: number, readCount: number, writeTime: number, writeCount: number) => ({
    total: metric(readTime + writeTime, readCount + writeCount),
    readLock: metric(readTime, readCount),
    writeLock: metric(writeTime, writeCount),
    queries: metric(0, 0),
    getmore: metric(0, 0),
    insert: metric(0, 0),
    update: metric(0, 0),
    remove: metric(0, 0),
    commands: metric(0, 0),
});

const result = (totals: Record<string, unknown>): TopCommandResult =>
    ({ totals: { note: "all times in microseconds", ...totals }, ok: 1 }) as TopCommandResult;

describe("isSystemNamespace", () => {
    it("skips admin/config/local databases", () => {
        expect(isSystemNamespace("admin.system.users")).toBe(true);
        expect(isSystemNamespace("config.transactions")).toBe(true);
        expect(isSystemNamespace("local.oplog.rs")).toBe(true);
    });

    it("skips any *.system.* namespace", () => {
        expect(isSystemNamespace("shop.system.profile")).toBe(true);
    });

    it("keeps normal user namespaces", () => {
        expect(isSystemNamespace("shop.orders")).toBe(false);
    });
});

describe("buildCollectionActivity", () => {
    it("skips the non-namespace note entry", () => {
        const activity = buildCollectionActivity(result({ "shop.orders": nsStats(10, 1, 0, 0) }), undefined, true);
        expect(activity.map((a) => a.ns)).toEqual(["shop.orders"]);
    });

    it("emits zero deltas when there is no previous sample", () => {
        const activity = buildCollectionActivity(result({ "shop.orders": nsStats(50, 5, 20, 2) }), undefined, true);
        expect(activity[0].total).toEqual({ deltaTime: 0, deltaCount: 0, cumTime: 70, cumCount: 7 });
        expect(activity[0].read).toEqual({ deltaTime: 0, deltaCount: 0, cumTime: 50, cumCount: 5 });
    });

    it("computes per-interval deltas against the previous sample", () => {
        const previous = result({ "shop.orders": nsStats(50, 5, 20, 2) });
        const current = result({ "shop.orders": nsStats(80, 8, 30, 3) });
        const activity = buildCollectionActivity(current, previous, true);
        expect(activity[0].read).toEqual({ deltaTime: 30, deltaCount: 3, cumTime: 80, cumCount: 8 });
        expect(activity[0].write).toEqual({ deltaTime: 10, deltaCount: 1, cumTime: 30, cumCount: 3 });
    });

    it("guards counter resets by clamping negative deltas to zero", () => {
        const previous = result({ "shop.orders": nsStats(500, 50, 0, 0) });
        const current = result({ "shop.orders": nsStats(10, 1, 0, 0) });
        const activity = buildCollectionActivity(current, previous, true);
        expect(activity[0].read).toEqual({ deltaTime: 0, deltaCount: 0, cumTime: 10, cumCount: 1 });
    });

    it("filters system namespaces unless showAll is set", () => {
        const totals = { "shop.orders": nsStats(10, 1, 0, 0), "admin.system.users": nsStats(5, 1, 0, 0) };
        expect(buildCollectionActivity(result(totals), undefined, false).map((a) => a.ns)).toEqual(["shop.orders"]);
        expect(
            buildCollectionActivity(result(totals), undefined, true)
                .map((a) => a.ns)
                .sort(),
        ).toEqual(["admin.system.users", "shop.orders"]);
    });

    it("splits the namespace into db and collection", () => {
        const activity = buildCollectionActivity(
            result({ "shop.orders.archive": nsStats(1, 1, 0, 0) }),
            undefined,
            true,
        );
        expect(activity[0].db).toBe("shop");
        expect(activity[0].coll).toBe("orders.archive");
    });
});
