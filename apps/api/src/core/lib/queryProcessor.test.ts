import type { MongoQuery } from "@mongotop-web/types";
import { describe, expect, it } from "vitest";
import { formatUserAgent, shouldSkipConnection, shouldSkipQuery } from "./queryProcessor.js";

const makeQuery = (overrides: Partial<MongoQuery> = {}): MongoQuery =>
    ({
        opid: 1,
        active: true,
        secs_running: 0,
        microsecs_running: 0,
        op: "query",
        ns: "shop.orders",
        command: {},
        client: "10.0.0.1:5000",
        ...overrides,
    }) as MongoQuery;

describe("shouldSkipQuery", () => {
    it("always shows index build queries", () => {
        expect(shouldSkipQuery(makeQuery({ ns: "shop.system.indexes" }))).toBe(false);
    });

    it("skips internal 192.x clients", () => {
        expect(shouldSkipQuery(makeQuery({ client: "192.168.0.5:5000" }))).toBe(true);
    });

    it("skips internal driver connections", () => {
        expect(shouldSkipQuery(makeQuery({ clientMetadata: { driver: { name: "NetworkInterfaceTL" } } }))).toBe(true);
    });

    it("always shows PHP ext-mongodb queries", () => {
        expect(shouldSkipQuery(makeQuery({ clientMetadata: { driver: { name: "ext-mongodb:PHP" } } }))).toBe(false);
    });

    it("skips monitoring/automation agent queries", () => {
        expect(shouldSkipQuery(makeQuery({ appName: "MongoDB Monitoring Module" }))).toBe(true);
        expect(shouldSkipQuery(makeQuery({ appName: "MongoDB Automation" }))).toBe(true);
    });

    it("skips hello / ismaster handshake commands", () => {
        expect(shouldSkipQuery(makeQuery({ command: { hello: 1 } }))).toBe(true);
        expect(shouldSkipQuery(makeQuery({ command: { hello: true } }))).toBe(true);
        expect(shouldSkipQuery(makeQuery({ command: { ismaster: true } }))).toBe(true);
    });

    it("skips config database commands", () => {
        expect(shouldSkipQuery(makeQuery({ command: { $db: "config" } }))).toBe(true);
    });

    it("keeps normal user queries", () => {
        expect(shouldSkipQuery(makeQuery({ command: { find: "orders" } }))).toBe(false);
    });
});

describe("shouldSkipConnection", () => {
    it("skips connections with no client address", () => {
        expect(shouldSkipConnection(makeQuery({ client: undefined }))).toBe(true);
    });

    it("skips internal driver connections", () => {
        expect(
            shouldSkipConnection(makeQuery({ clientMetadata: { driver: { name: "MongoDB Internal Client" } } })),
        ).toBe(true);
    });

    it("skips monitoring/automation/mongotune agents by app name", () => {
        expect(shouldSkipConnection(makeQuery({ appName: "MongoDB Monitoring Module" }))).toBe(true);
        expect(shouldSkipConnection(makeQuery({ appName: "mongotune" }))).toBe(true);
    });

    it("skips system auth users", () => {
        expect(shouldSkipConnection(makeQuery({ effectiveUsers: [{ user: "__system", db: "local" }] }))).toBe(true);
    });

    it("keeps normal client connections", () => {
        expect(shouldSkipConnection(makeQuery({ effectiveUsers: [{ user: "app", db: "shop" }] }))).toBe(false);
    });
});

describe("formatUserAgent", () => {
    it("labels NoSQLBooster by app name", () => {
        expect(formatUserAgent(makeQuery({ appName: "NoSQLBooster for MongoDB" }))).toBe("NoSQLBooster");
    });

    it("labels known application names", () => {
        expect(formatUserAgent(makeQuery({ clientMetadata: { application: { name: "OplogFetcher" } } }))).toBe(
            "OplogFetcher",
        );
    });

    it("extracts the node runtime version from the platform string", () => {
        expect(formatUserAgent(makeQuery({ clientMetadata: { platform: "Node.js v20.1.0, LE" } }))).toBe("Node.js v20");
    });

    it("falls back to the driver name when nothing else matches", () => {
        expect(formatUserAgent(makeQuery({ clientMetadata: { driver: { name: "custom-driver" } } }))).toBe(
            "custom-driver",
        );
    });
});
