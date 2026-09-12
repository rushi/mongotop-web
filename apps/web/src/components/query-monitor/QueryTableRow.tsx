import type { ProcessedQuery } from "@mongotop-web/types";
import { CheckIcon, EyeIcon, FloppyDiskIcon, FunnelIcon } from "@phosphor-icons/react/dist/ssr";
import { memo } from "react";
import type { CSSProperties } from "react";
import { isInternalIp } from "../../lib/isInternalIp";
import { cn } from "../../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

interface QueryTableRowProps {
    isSaving: boolean;
    isSaved: boolean;
    query: ProcessedQuery;
    style: CSSProperties;
    onRowClick: (query: ProcessedQuery) => void;
    onFilterByIp: (query: ProcessedQuery) => void;
    onSave: (query: ProcessedQuery) => void;
}

const QueryTableRowComponent = ({
    isSaving,
    isSaved,
    query,
    style,
    onRowClick,
    onFilterByIp,
    onSave,
}: QueryTableRowProps) => {
    const isCollscan = query.isCollscan;
    const isSaveDisabled = [isSaving, isSaved].some(Boolean);

    return (
        <div
            style={style}
            className={cn(
                "grid cursor-pointer grid-cols-[40px_80px_100px_120px_minmax(200px,1fr)_140px_150px_110px] gap-4 border-b border-border px-4 py-3 transition-colors hover:bg-muted/90",
                isCollscan && "border-l-4 border-l-warning bg-warning/5",
            )}
            onClick={() => onRowClick(query)}
        >
            <div className="flex items-center font-mono text-sm text-muted-foreground tabular-nums">{query.idx}</div>
            <div className="flex items-center font-mono text-sm text-foreground tabular-nums">{query.opid}</div>
            <div className="flex items-center justify-end pr-2 font-mono text-sm font-medium text-primary tabular-nums">
                {query.runtime_formatted}
            </div>
            <div className="flex items-center truncate font-mono text-sm text-muted-foreground uppercase">
                {query.operation}
            </div>
            <div className="flex items-center gap-2 truncate font-mono text-sm text-foreground">
                <div className="flex items-center truncate">
                    <span className="text-muted-foreground">{query.database}.</span>
                    <span className="font-medium">{query.collection}</span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    {isCollscan && (
                        <Badge
                            variant="destructive"
                            className="border border-warning bg-warning/20 font-mono text-[10px] text-warning uppercase"
                        >
                            ⚠ COLLSCAN
                        </Badge>
                    )}
                    {query.waitingForLock && (
                        <Badge variant="outline" className="border border-destructive font-mono text-[10px] uppercase">
                            🔒 LOCK
                        </Badge>
                    )}
                </div>
            </div>
            <div
                className={cn(
                    "flex items-center truncate font-mono text-sm",
                    isInternalIp(query.client.ip) ? "text-muted-foreground/80" : "text-foreground",
                )}
            >
                {query.client.ip}
            </div>
            <div className="flex items-center truncate font-mono text-sm">{query.userAgent}</div>
            <div className="flex items-center justify-end gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    title="Filter by IP"
                    className="h-6 w-6 border border-border p-0 hover:border-primary hover:bg-primary/10 hover:text-white"
                    onClick={(e) => {
                        e.stopPropagation();
                        onFilterByIp(query);
                    }}
                >
                    <FunnelIcon weight="bold" className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    title="View Details"
                    className="h-6 w-6 border border-border p-0 hover:border-primary hover:bg-primary/10 hover:text-white"
                    onClick={(e) => {
                        e.stopPropagation();
                        onRowClick(query);
                    }}
                >
                    <EyeIcon weight="bold" className="h-3 w-3" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    disabled={isSaveDisabled}
                    title="Save Query"
                    className="h-6 w-6 border border-border p-0 hover:border-primary hover:bg-primary/10 hover:text-white"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSave(query);
                    }}
                >
                    {isSaved ? (
                        <CheckIcon weight="bold" className="h-3 w-3 text-primary" />
                    ) : (
                        <FloppyDiskIcon weight="bold" className="h-3 w-3" />
                    )}
                </Button>
            </div>
        </div>
    );
};

export const QueryTableRow = memo(QueryTableRowComponent);
