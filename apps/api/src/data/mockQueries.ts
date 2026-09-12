import type { MongoQuery } from "@mongotop-web/types";

// Sorted by microsecs_running descending (longest running at top), matching real currentOp output.
export const mockQueries: MongoQuery[] = [
    {
        opid: 1561305353,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 914,
        microsecs_running: 914_000_000,
        op: "command",
        ns: "production.order_items",
        command: {
            $truncated:
                '{ aggregate: "order_items", pipeline: [ { $match: { "product.$id": ObjectId(\'507f1f77bcf86cd799439011\'), status: "completed", deletedAt: { $exists: false } } }, { $lookup: { from: "orders", localField: "order.$id", foreignField: "_id", as: "order" } }, { $unwind: "$order" }, { $group: { _id: { month: { $month: "$createdAt" }, year: { $year: "$createdAt" } }, revenue: { $sum: "$amount.value" }, count: { $sum: 1 } } }, { $sort: { "_id.year": -1, "_id.month": -1 } } ], cursor: { batchSize: 100 }, maxTimeMS: 120000 }',
        },
        client: "10.0.1.55:60001",
        clientMetadata: {
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
    {
        opid: 1474154483,
        active: true,
        appName: "NoSQLBoosterV9.1.6_53731.656",
        effectiveUsers: [
            {
                user: "readonly_user",
                db: "admin",
            },
        ],
        secs_running: 649,
        microsecs_running: 649_000_000,
        op: "query",
        ns: "production.orders",
        command: {
            find: "orders",
            filter: {
                source: "web",
                "metadata.type": "subscription",
                createdAt: {
                    $gte: "2025-08-11T00:00:00.000Z",
                },
            },
            sort: {
                _id: -1,
            },
            projection: {},
            limit: 20,
            batchSize: 1000,
        },
        client: "127.0.0.1:53731",
        clientMetadata: {
            application: {
                name: "NoSQLBoosterV9.1.6_53731.656",
            },
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
    {
        opid: 1533221332,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 233,
        microsecs_running: 233_000_000,
        op: "query",
        ns: "production.messages",
        command: {
            find: "messages",
            filter: {
                participants: {
                    $elemMatch: {
                        id: {
                            $in: ["507f191e810c19729de860ea"],
                        },
                        type: 1,
                    },
                },
                $and: [
                    {
                        participants: {
                            $elemMatch: {
                                id: "507f191e810c19729de860ea",
                                type: 1,
                            },
                        },
                    },
                    {
                        participants: {
                            $elemMatch: {
                                id: "507f191e810c19729de860ea",
                                tags: "unread",
                            },
                        },
                    },
                ],
            },
            skip: 0,
            sort: {
                updatedAt: 1,
            },
            limit: 20,
        },
        client: "10.0.1.45:54321",
        clientMetadata: {
            driver: {
                name: "mongo-php-library",
                version: "1.19.4",
            },
        },
    },
    {
        opid: 1527294349,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 82,
        microsecs_running: 82_000_000,
        op: "query",
        ns: "production.orders",
        command: {
            find: "orders",
            filter: {
                "user.$id": "507f1f77bcf86cd799439011",
                status: "completed",
                createdAt: {
                    $gte: "2026-01-01T00:00:00.000Z",
                    $lt: "2026-02-01T00:00:00.000Z",
                },
            },
            sort: {
                createdAt: -1,
            },
            limit: 100,
        },
        planSummary: "IXSCAN { user.$id: 1, createdAt: -1 }",
        client: "10.0.1.42:51234",
        clientMetadata: {
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
    {
        opid: 1098758134,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 25,
        microsecs_running: 25_000_000,
        op: "update",
        ns: "production.audit_logs",
        command: {
            q: {
                "user.$id": "507f1f77bcf86cd799439012",
                "createdBy.$id": "507f1f77bcf86cd799439013",
            },
            u: {
                $set: {
                    "createdBy.$id": "507f1f77bcf86cd799439014",
                },
            },
            multi: true,
            upsert: false,
        },
        client: "172.16.0.50:33221",
        clientMetadata: {
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
    {
        opid: 832003386,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 13,
        microsecs_running: 13_000_000,
        op: "query",
        ns: "production.payments",
        command: {
            find: "payments",
            filter: {
                "gateway.transaction.id": "txn_1234567890abcdef",
                type: "refund",
                status: {
                    $in: [
                        "pending",
                        "processing",
                        "completed",
                        "failed",
                        "cancelled",
                        "refunded",
                        "partially_refunded",
                        null,
                    ],
                },
            },
            limit: 1,
        },
        planSummary: "IXSCAN { type: 1, gateway.transaction.id: 1 }",
        client: "10.0.1.30:55443",
        clientMetadata: {
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
    {
        opid: 1232063631,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 11,
        microsecs_running: 11_000_000,
        op: "command",
        ns: "production.order_items",
        command: {
            $truncated:
                "{ aggregate: \"order_items\", pipeline: [ { $match: { user.$id: ObjectId('507f1f77bcf86cd799439011'), $and: [ { $or: [ { user.$id: { $in: [ ObjectId('507f1f77bcf86cd799439015'), ObjectId('507f1f77bcf86cd799439016'), ObjectId('507f1f77bcf86cd799439017') ] } } ] } ] } }, { $group: { _id: null, total: { $sum: 1 } } } ], cursor: { batchSize: 1000 } }",
        },
        client: "10.0.1.23:43210",
        clientMetadata: {
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
    {
        opid: 1403028230,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 11,
        microsecs_running: 11_000_000,
        op: "query",
        ns: "production.carts",
        command: {
            find: "carts",
            filter: {
                "user.$id": "507f1f77bcf86cd799439018",
                completedAt: {
                    $exists: false,
                },
                email: "user@example.com",
                deletedAt: {
                    $exists: false,
                },
            },
        },
        planSummary: "IXSCAN { user.$id: 1, email: 1 }",
        client: "192.168.50.100:44332",
        clientMetadata: {
            driver: {
                name: "mongo-php-library",
                version: "1.19.4",
            },
        },
    },
    {
        opid: 1234567890,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 5,
        microsecs_running: 5_000_000,
        op: "query",
        ns: "production.users",
        command: {
            find: "users",
            filter: {
                _id: "507f1f77bcf86cd799439019",
            },
        },
        planSummary: "IDHACK",
        client: "10.0.1.20:33445",
        clientMetadata: {
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
    {
        opid: 832302852,
        active: true,
        effectiveUsers: [
            {
                user: "app_user",
                db: "admin",
            },
        ],
        secs_running: 3,
        microsecs_running: 3_000_000,
        op: "query",
        ns: "production.products",
        command: {
            find: "products",
            filter: {
                "pricing.expiresAt": {
                    $exists: true,
                    $lt: "2025-08-09T13:07:37.161Z",
                },
                status: {
                    $in: ["active", null],
                },
            },
        },
        planSummary: "COLLSCAN",
        client: "192.168.1.100:45678",
        clientMetadata: {
            driver: {
                name: "nodejs",
                version: "6.10.0",
            },
        },
    },
];
