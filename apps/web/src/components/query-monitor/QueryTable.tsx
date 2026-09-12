import type { ProcessedQuery } from "@mongotop-web/types";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useRef } from "react";
import { useSaveQuery } from "../../hooks/useSaveQuery";
import { useSortedQueries } from "../../hooks/useSortedQueries";
import { useUrlPreferences } from "../../hooks/useUrlPreferences";
import { cn } from "../../lib/utils";
import { QueryTableHeader } from "./QueryTableHeader";
import { QueryTableRow } from "./QueryTableRow";

interface QueryTableProps {
    queries: ProcessedQuery[];
    className?: string;
    onQueryClick: (query: ProcessedQuery) => void;
}

const ROW_HEIGHT = 60;

export const QueryTable = ({ queries, className, onQueryClick }: QueryTableProps) => {
    const parentRef = useRef<HTMLDivElement>(null);
    const { serverId, sortBy: sortColumn, sortDirection, setSortColumn, setIpFilter } = useUrlPreferences();
    const { savingIds, savedIds, handleSave } = useSaveQuery(serverId);

    const sortedQueries = useSortedQueries(queries, sortColumn, sortDirection);

    const virtualizer = useVirtualizer({
        count: sortedQueries.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 8,
    });

    const handleFilterByIp = useCallback(
        (query: ProcessedQuery) => {
            setIpFilter(query.client.ip);
        },
        [setIpFilter],
    );

    if (queries.length === 0) {
        return (
            <div className={cn("border-2 border-border p-12 text-center", className)}>
                <div className="mb-3 font-mono text-4xl text-muted-foreground">∅</div>
                <p className="font-mono text-sm tracking-wide text-muted-foreground uppercase">NO_QUERIES_DETECTED</p>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                    Adjust filters or wait for database operations
                </p>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col overflow-hidden border-2 border-border", className)}>
            <QueryTableHeader sortColumn={sortColumn} sortDirection={sortDirection} onSortChange={setSortColumn} />

            <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
                <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const query = sortedQueries[virtualRow.index];

                        return (
                            <QueryTableRow
                                // Key by opid so React reconciles a query to the same DOM node
                                // across reorders instead of by list position (prevents row-swap jank)
                                key={query.opid}
                                isSaving={savingIds.has(query.opid)}
                                isSaved={savedIds.has(query.opid)}
                                query={query}
                                style={{
                                    position: "absolute",
                                    top: 0,
                                    left: 0,
                                    width: "100%",
                                    height: ROW_HEIGHT,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                                onRowClick={onQueryClick}
                                onFilterByIp={handleFilterByIp}
                                onSave={handleSave}
                            />
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-primary bg-muted px-4 py-2">
                <span className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    ▸ SHOWING {sortedQueries.length} {sortedQueries.length === 1 ? "QUERY" : "QUERIES"}
                </span>
            </div>
        </div>
    );
};
