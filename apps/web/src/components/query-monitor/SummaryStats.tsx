import type { QuerySummary } from "@mongotop-web/types";
import { cn } from "../../lib/utils";

interface SummaryStatsProps {
    summary: QuerySummary;
}

export const SummaryStats = ({ summary }: SummaryStatsProps) => {
    const operationsEntries = Object.entries(summary.operations).sort(([, a], [, b]) => b - a);
    const collectionsEntries = Object.entries(summary.collections).sort(([, a], [, b]) => b - a);
    const topCollections = collectionsEntries.slice(0, 5);
    const remainingCollections = collectionsEntries.length - 5;

    return (
        <div className="mb-4 border-2 border-border bg-card">
            {/* ASCII Divider */}
            <div className="flex items-center border-b-2 border-border bg-muted px-4 py-2.5">
                <span className="font-mono text-xs tracking-wider text-primary uppercase">■ OPERATION_SUMMARY</span>
            </div>

            <div className="grid grid-cols-[minmax(160px,auto)_minmax(180px,auto)_1fr_1fr] gap-0">
                {/* Total Queries */}
                <div className="border-r-2 border-border p-3">
                    <div className="mb-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        TOTAL_QUERIES
                    </div>
                    <div className="font-mono text-lg text-primary tabular-nums">{summary.totalQueries}</div>
                </div>

                {/* Unindexed Queries */}
                <div className="border-r-2 border-border p-3">
                    <div className="mb-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        COLLSCAN_DETECT
                    </div>
                    <div
                        className={cn(
                            "font-mono text-lg tabular-nums",
                            summary.unindexedCount > 0 ? "text-warning" : "text-muted-foreground",
                        )}
                    >
                        {summary.unindexedCount}
                    </div>
                    {summary.unindexedCount > 0 && (
                        <div className="mt-1 font-mono text-[10px] text-warning uppercase">⚠ UNINDEXED</div>
                    )}
                </div>

                {/* Operations Breakdown */}
                <div className="border-r-2 border-border p-3">
                    <div className="mb-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        OPERATIONS
                    </div>
                    {operationsEntries.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                            {operationsEntries.map(([op, count]) => (
                                <div key={op} className="flex items-center gap-1.5">
                                    <span className="text-primary">▸</span>
                                    <span className="font-bold text-primary tabular-nums">{count}</span>
                                    <span className="text-foreground uppercase">{op}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="font-mono text-xs text-muted-foreground">NO_DATA</div>
                    )}
                </div>

                {/* Collections */}
                <div className="p-3">
                    <div className="mb-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        COLLECTIONS
                    </div>
                    {topCollections.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                            {topCollections.map(([coll, count]) => (
                                <div key={coll} className="flex items-center gap-1.5">
                                    <span className="text-primary">▸</span>
                                    <span className="font-bold text-primary tabular-nums">{count}</span>
                                    <span className="truncate text-foreground">{coll}</span>
                                </div>
                            ))}
                            {remainingCollections > 0 && (
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <span>▸</span>
                                    <span>+{remainingCollections} MORE</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="font-mono text-xs text-muted-foreground">NO_DATA</div>
                    )}
                </div>
            </div>
        </div>
    );
};
