import type { ActivityMode } from "@mongotop-web/types";
import { InfoIcon, PauseIcon, PlayIcon } from "@phosphor-icons/react";
import { formatUptime } from "../../lib/formatActivity";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

const MODES: { value: ActivityMode; label: string }[] = [
    { value: "diff", label: "PER_INTERVAL" },
    { value: "cumulative", label: "CUMULATIVE" },
];

interface ActivityControlsProps {
    isPaused: boolean;
    showAll: boolean;
    mode: ActivityMode;
    refreshInterval: number;
    serverStartedAt: string | undefined;
    onModeChange: (mode: ActivityMode) => void;
    onRefreshIntervalChange: (seconds: number) => void;
    onTogglePause: () => void;
    onToggleShowAll: () => void;
}

export const ActivityControls = ({
    isPaused,
    showAll,
    mode,
    refreshInterval,
    serverStartedAt,
    onModeChange,
    onRefreshIntervalChange,
    onTogglePause,
    onToggleShowAll,
}: ActivityControlsProps) => {
    return (
        <Card className="border-2 border-border bg-card p-0">
            <div className="flex items-center border-b-2 border-border bg-muted px-4 py-2.5">
                <span className="font-mono text-xs tracking-wider text-primary uppercase">■ FILTER_CONTROLS</span>
            </div>

            <div className="flex flex-wrap items-end gap-4 p-4">
                <div className="space-y-1">
                    <Label
                        htmlFor="refresh"
                        className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase"
                    >
                        REFRESH_SEC
                    </Label>
                    <Input
                        id="refresh"
                        type="number"
                        value={refreshInterval}
                        min={1}
                        className="h-9 w-24 border-2 border-border bg-input font-mono text-sm"
                        onChange={(e) => onRefreshIntervalChange(Number(e.target.value))}
                    />
                </div>

                <div className="space-y-1">
                    <Label className="flex items-center gap-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        VIEW
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                        <InfoIcon weight="bold" className="h-3 w-3" />
                                    </span>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md border-2 border-border bg-popover p-3 text-pretty">
                                    <p className="font-mono text-xs font-bold text-muted-foreground uppercase">
                                        VIEW_MODE
                                    </p>
                                    <p className="mt-2 font-mono text-[10px] leading-relaxed text-foreground">
                                        <span className="text-primary">PER_INTERVAL</span>: activity in the last refresh
                                        (current minus previous sample), like mongotop. Shows what is hot right now;
                                        idle collections drop to 0.
                                    </p>
                                    <p className="mt-1.5 font-mono text-[10px] leading-relaxed text-foreground">
                                        <span className="text-primary">CUMULATIVE</span>: raw totals since server start
                                        {serverStartedAt && ` (${formatUptime(serverStartedAt)})`}. Numbers only grow;
                                        best for all-time workload. Sparklines and hot-row highlight are per-interval
                                        only.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </Label>
                    <div className="flex gap-2">
                        {MODES.map(({ value, label }) => (
                            <Button
                                key={value}
                                variant={mode === value ? "default" : "outline"}
                                className="h-9 border-2 font-mono text-xs tracking-wide uppercase"
                                onClick={() => onModeChange(value)}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        OPTIONS
                    </Label>
                    <div className="flex gap-2">
                        <Button
                            variant={isPaused ? "default" : "outline"}
                            title={isPaused ? "Resume updates" : "Pause updates"}
                            className="h-9 border-2 font-mono text-xs tracking-wide uppercase"
                            onClick={onTogglePause}
                        >
                            {isPaused ? (
                                <>
                                    <PlayIcon weight="fill" className="mr-1.5 h-3.5 w-3.5" />
                                    PAUSED
                                </>
                            ) : (
                                <>
                                    <PauseIcon weight="fill" className="mr-1.5 h-3.5 w-3.5" />
                                    LIVE
                                </>
                            )}
                        </Button>
                        <Button
                            variant={showAll ? "default" : "outline"}
                            className="h-9 border-2 font-mono text-xs tracking-wide uppercase"
                            onClick={onToggleShowAll}
                        >
                            {showAll ? "● " : "○ "}SHOW_SYSTEM
                        </Button>
                    </div>
                </div>

                {serverStartedAt && (
                    <div className="ml-auto space-y-1">
                        <Label className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                            SERVER_UPTIME
                        </Label>
                        <p className="font-mono text-sm text-foreground">{formatUptime(serverStartedAt)}</p>
                    </div>
                )}
            </div>
        </Card>
    );
};
