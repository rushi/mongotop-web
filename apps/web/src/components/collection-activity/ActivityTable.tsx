import type { ActivityMode, CollectionActivity } from "@mongotop-web/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { avgLatencyMicros, metricTime } from "../../lib/formatActivity";
import { cn } from "../../lib/utils";
import { SortableColumnHeader } from "../shared/SortableColumnHeader";
import { ActivityTableRow } from "./ActivityTableRow";

type SortKey = "namespace" | "total" | "read" | "write" | "avg";
type SortDirection = "asc" | "desc";

const GRID_COLS = "grid-cols-[minmax(200px,1.8fr)_110px_110px_110px_90px_120px_90px]";
const ROW_HEIGHT = 46;
// Busiest collections this interval, highlighted in the table.
const HOT_COUNT = 5;

// Only real, orderable columns are sortable. R/W and TREND are visual-only.
const SORT_COLUMNS: { key: SortKey; label: string; numeric: boolean }[] = [
    { key: "namespace", label: "COLLECTION", numeric: false },
    { key: "total", label: "TOTAL", numeric: true },
    { key: "read", label: "READ", numeric: true },
    { key: "write", label: "WRITE", numeric: true },
    { key: "avg", label: "AVG_LAT", numeric: true },
];

interface ActivityTableProps {
    collections: CollectionActivity[];
    history: Map<string, number[]>;
    mode: ActivityMode;
    className?: string;
}

const timeFor = (activity: CollectionActivity, mode: ActivityMode, key: "total" | "read" | "write"): number =>
    metricTime(activity[key], mode);

const sortValue = (activity: CollectionActivity, key: SortKey, mode: ActivityMode): string | number => {
    switch (key) {
        case "namespace":
            return activity.ns.toLowerCase();
        case "total":
            return timeFor(activity, mode, "total");
        case "read":
            return timeFor(activity, mode, "read");
        case "write":
            return timeFor(activity, mode, "write");
        case "avg":
            return mode === "diff"
                ? avgLatencyMicros(activity.total.deltaTime, activity.total.deltaCount)
                : avgLatencyMicros(activity.total.cumTime, activity.total.cumCount);
    }
};

export const ActivityTable = ({ collections, history, mode, className }: ActivityTableProps) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const [sortKey, setSortKey] = useState<SortKey>("total");
    const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

    const handleSort = (column: (typeof SORT_COLUMNS)[number]) => {
        if (sortKey === column.key) {
            setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
        } else {
            setSortKey(column.key);
            setSortDirection(column.numeric ? "desc" : "asc");
        }
    };

    const sorted = useMemo(() => {
        const direction = sortDirection === "asc" ? 1 : -1;
        return [...collections].sort((a, b) => {
            const aValue = sortValue(a, sortKey, mode);
            const bValue = sortValue(b, sortKey, mode);
            if (aValue < bValue) {
                return -direction;
            }
            if (aValue > bValue) {
                return direction;
            }
            return a.ns < b.ns ? -1 : 1; // deterministic tiebreak
        });
    }, [collections, sortKey, sortDirection, mode]);

    // Hot = the top collections by this interval's total activity (diff mode only).
    const hotNamespaces = useMemo(() => {
        if (mode !== "diff") {
            return new Set<string>();
        }

        const ranked = [...collections]
            .filter((activity) => activity.total.deltaTime > 0)
            .sort((a, b) => b.total.deltaTime - a.total.deltaTime)
            .slice(0, HOT_COUNT)
            .map((activity) => activity.ns);
        return new Set(ranked);
    }, [collections, mode]);

    // Dim idle rows only when something is active this interval, never dim the whole
    // table (a fresh stream or a genuinely idle server would otherwise gray out entirely).
    const dimIdle = useMemo(
        () => mode === "diff" && collections.some((activity) => activity.total.deltaTime > 0),
        [collections, mode],
    );

    const virtualizer = useVirtualizer({
        count: sorted.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 8,
    });

    if (collections.length === 0) {
        return (
            <div className={cn("border-2 border-border bg-card py-24 text-center", className)}>
                <div className="mb-3 font-mono text-4xl text-muted-foreground">∅</div>
                <p className="font-mono text-sm tracking-wide text-muted-foreground uppercase">
                    NO_COLLECTION_ACTIVITY
                </p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">No collections match the filter.</p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col overflow-hidden border-2 border-border bg-card", className)}>
            <div className="flex shrink-0 items-center border-b-2 border-border bg-muted px-4 py-2.5">
                <span className="font-mono text-xs tracking-wider text-primary uppercase">■ COLLECTION_ACTIVITY</span>
            </div>

            <div className={cn("grid shrink-0 gap-3 border-b-2 border-border bg-card px-4 py-3", GRID_COLS)}>
                {SORT_COLUMNS.map((column) => (
                    <SortableColumnHeader
                        key={column.key}
                        label={column.label}
                        isSorted={sortKey === column.key}
                        sortDirection={sortDirection}
                        align={column.numeric ? "end" : "start"}
                        onClick={() => handleSort(column)}
                    />
                ))}
                <span className="font-mono text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                    R/W
                </span>
                <span className="justify-self-end font-mono text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
                    TREND
                </span>
            </div>

            <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const activity = sorted[virtualRow.index];
                        return (
                            <ActivityTableRow
                                key={activity.ns}
                                activity={activity}
                                history={history.get(activity.ns) ?? []}
                                mode={mode}
                                isHot={hotNamespaces.has(activity.ns)}
                                dimIdle={dimIdle}
                                gridCols={GRID_COLS}
                                height={ROW_HEIGHT}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
