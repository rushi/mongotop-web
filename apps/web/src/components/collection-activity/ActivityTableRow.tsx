import type { ActivityMetric, ActivityMode, CollectionActivity } from "@mongotop-web/types";
import { memo } from "react";
import { avgLatencyMicros, formatCount, formatMicros, metricCount, metricTime } from "../../lib/formatActivity";
import { cn } from "../../lib/utils";
import { ReadWriteDonut } from "./ReadWriteDonut";
import { Sparkline } from "./Sparkline";

interface ActivityTableRowProps {
    isHot: boolean;
    dimIdle: boolean;
    activity: CollectionActivity;
    history: number[];
    mode: ActivityMode;
    gridCols: string;
    height: number;
    style: React.CSSProperties;
}

const MetricCell = ({ metric, mode }: { metric: ActivityMetric; mode: ActivityMode }) => {
    const time = metricTime(metric, mode);
    const count = metricCount(metric, mode);
    return (
        <div className="text-right font-mono text-sm tabular-nums">
            <span className="text-foreground">{formatMicros(time)}</span>
            <span className="ml-1.5 text-[10px] text-muted-foreground">×{formatCount(count)}</span>
        </div>
    );
};

const ActivityTableRowComponent = ({
    isHot,
    dimIdle,
    activity,
    history,
    mode,
    gridCols,
    height,
    style,
}: ActivityTableRowProps) => {
    const { total, read, write } = activity;
    const time = metricTime(total, mode);
    const isIdle = dimIdle && time <= 0;
    const avgLatency = avgLatencyMicros(metricTime(total, mode), metricCount(total, mode));

    return (
        <div
            style={{ ...style, height }}
            className={cn(
                "grid items-center gap-3 border-b border-border/50 px-4 hover:bg-muted/40",
                gridCols,
                isHot && "bg-primary/5",
                isIdle && "opacity-40",
            )}
        >
            <div className="truncate font-mono text-sm">
                <span className="text-muted-foreground">{activity.db}.</span>
                <span className={cn("text-foreground", isHot && "text-primary")}>{activity.coll}</span>
            </div>
            <MetricCell metric={total} mode={mode} />
            <MetricCell metric={read} mode={mode} />
            <MetricCell metric={write} mode={mode} />
            <div className="text-right font-mono text-sm text-muted-foreground tabular-nums">
                {formatMicros(avgLatency)}
            </div>
            <div className="flex items-center">
                <ReadWriteDonut read={metricTime(read, mode)} write={metricTime(write, mode)} />
            </div>
            <div className="flex justify-end">
                {mode === "diff" ? (
                    <Sparkline values={history} />
                ) : (
                    <span className="text-[10px] text-muted-foreground">—</span>
                )}
            </div>
        </div>
    );
};

export const ActivityTableRow = memo(ActivityTableRowComponent);
