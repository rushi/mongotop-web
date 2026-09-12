import type { ProcessedQuery } from "@mongotop-web/types";
import { useMemo } from "react";
import type { SortColumn, SortDirection } from "./useUrlPreferences";

const getSortValue = (query: ProcessedQuery, column: SortColumn): string | number => {
    switch (column) {
        case "opid":
            return query.opid;
        case "operation":
            return query.operation;
        case "namespace":
            return query.namespace;
        case "client":
            return query.client.ip;
        case "runtime":
        default:
            return query.secs_running;
    }
};

export const useSortedQueries = (queries: ProcessedQuery[], sortColumn: SortColumn, sortDirection: SortDirection) => {
    return useMemo(() => {
        return [...queries].sort((a, b) => {
            const aValue = getSortValue(a, sortColumn);
            const bValue = getSortValue(b, sortColumn);

            let cmp: number;
            if (typeof aValue === "string" && typeof bValue === "string") {
                cmp = sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
            } else {
                cmp = sortDirection === "asc" ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
            }

            // Deterministic tiebreak keeps equal-value rows from reshuffling between SSE ticks
            return cmp === 0 ? a.opid.localeCompare(b.opid) : cmp;
        });
    }, [queries, sortColumn, sortDirection]);
};
