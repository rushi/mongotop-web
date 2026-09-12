import type { ConnectedClient } from "@mongotop-web/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";
import { SortableColumnHeader } from "../shared/SortableColumnHeader";
import { Badge } from "../ui/badge";

type SortKey = "status" | "client" | "app" | "user" | "op" | "runtime";
type SortDirection = "asc" | "desc";

const GRID_COLS = "grid-cols-[70px_minmax(150px,1fr)_minmax(120px,1fr)_minmax(140px,1fr)_minmax(160px,1.5fr)_90px]";
const ROW_HEIGHT = 46;

const COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
    { key: "status", label: "STATUS", numeric: true },
    { key: "client", label: "CLIENT", numeric: false },
    { key: "app", label: "APP", numeric: false },
    { key: "user", label: "USER", numeric: false },
    { key: "op", label: "CURRENT_OP", numeric: false },
    { key: "runtime", label: "RUNTIME", numeric: true },
];

export const getClientUserKeys = (client: ConnectedClient): string[] => {
    if (!client.effectiveUsers?.length) {
        return ["unauthenticated"];
    }
    return client.effectiveUsers.map((u) => `${u.user}@${u.db}`);
};

const formatUsers = (client: ConnectedClient): string => {
    if (!client.effectiveUsers?.length) {
        return "—";
    }
    return getClientUserKeys(client).join(", ");
};

const sortValue = (client: ConnectedClient, key: SortKey): string | number => {
    switch (key) {
        case "status":
            return client.active ? 1 : 0;
        case "client":
            return client.client.ip;
        case "app":
            return client.userAgent.toLowerCase();
        case "user":
            return formatUsers(client).toLowerCase();
        case "op":
            return (client.currentOp ?? "").toLowerCase();
        case "runtime":
            return client.secs_running ?? 0;
    }
};

export const ClientTable = ({ clients, className }: { clients: ConnectedClient[]; className?: string }) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [sortKey, setSortKey] = useState<SortKey | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const handleSort = (column: (typeof COLUMNS)[number]) => {
        if (sortKey === column.key) {
            setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
        } else {
            setSortKey(column.key);
            // Numeric columns are most useful high-to-low first; text ascending.
            setSortDirection(column.numeric ? "desc" : "asc");
        }
    };

    const sortedClients = useMemo(() => {
        if (!sortKey) {
            // No explicit sort: keep server order (active first, then runtime desc).
            return clients;
        }

        const direction = sortDirection === "asc" ? 1 : -1;
        return [...clients].sort((a, b) => {
            const aValue = sortValue(a, sortKey);
            const bValue = sortValue(b, sortKey);
            if (aValue < bValue) {
                return -direction;
            }
            if (aValue > bValue) {
                return direction;
            }
            // Deterministic tiebreak keeps equal-value rows from reshuffling between ticks
            return (a.connectionId ?? 0) - (b.connectionId ?? 0);
        });
    }, [clients, sortKey, sortDirection]);

    const virtualizer = useVirtualizer({
        count: sortedClients.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 8,
    });

    if (clients.length === 0) {
        return (
            <div className={cn("border-2 border-border bg-card py-24 text-center", className)}>
                <div className="mb-3 font-mono text-4xl text-muted-foreground">∅</div>
                <p className="font-mono text-sm tracking-wide text-muted-foreground uppercase">NO_CONNECTED_CLIENTS</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">No client connections match the filter.</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col overflow-hidden border-2 border-border bg-card", className)}>
            <div className="flex shrink-0 items-center border-b-2 border-border bg-muted px-4 py-2.5">
                <span className="font-mono text-xs tracking-wider text-primary uppercase">■ CONNECTED_CLIENTS</span>
            </div>

            <div className={cn("grid shrink-0 gap-3 border-b-2 border-border bg-card px-4 py-3", GRID_COLS)}>
                {COLUMNS.map((column) => (
                    <SortableColumnHeader
                        key={column.key}
                        label={column.label}
                        isSorted={sortKey === column.key}
                        sortDirection={sortDirection}
                        align={column.key === "runtime" ? "end" : "start"}
                        onClick={() => handleSort(column)}
                    />
                ))}
            </div>

            <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const client = sortedClients[virtualRow.index];
                        return (
                            <div
                                // Key by connection so React reconciles a client to the same DOM node
                                // across reorders instead of by list position (prevents row-swap jank)
                                key={`${client.client.ip}-${client.connectionId ?? virtualRow.index}`}
                                data-index={virtualRow.index}
                                className={cn(
                                    "grid items-center gap-3 border-b border-border/50 px-4 hover:bg-muted/40",
                                    GRID_COLS,
                                )}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: ROW_HEIGHT,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <div>
                                    {client.active ? (
                                        <Badge
                                            variant="success"
                                            className="border border-primary bg-primary/20 font-mono text-[10px] text-primary uppercase"
                                        >
                                            ● ACTIVE
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="secondary"
                                            className="border border-border font-mono text-[10px] text-muted-foreground uppercase"
                                        >
                                            ○ IDLE
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5 truncate font-mono text-sm text-foreground">
                                    {client.client.geo?.country && (
                                        <span className="text-muted-foreground">{client.client.geo.country}</span>
                                    )}
                                    <span className="truncate">{client.client.ip}</span>
                                </div>

                                <div className="truncate font-mono text-sm text-foreground">{client.userAgent}</div>

                                <div className="truncate font-mono text-sm text-muted-foreground">
                                    {formatUsers(client)}
                                </div>

                                <div className="truncate font-mono text-sm text-muted-foreground">
                                    {client.currentOp ? (
                                        <>
                                            <span className="text-foreground uppercase">{client.currentOp}</span>
                                            {client.namespace && <span className="ml-1.5">{client.namespace}</span>}
                                        </>
                                    ) : (
                                        "—"
                                    )}
                                </div>

                                <div className="text-right font-mono text-sm text-muted-foreground tabular-nums">
                                    {client.active ? (client.runtime_formatted ?? "—") : "—"}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
