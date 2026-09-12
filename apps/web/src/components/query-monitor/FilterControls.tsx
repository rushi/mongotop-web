import {
    ArrowCounterClockwiseIcon,
    CheckIcon,
    FloppyDiskIcon,
    PauseIcon,
    PlayIcon,
    XIcon,
} from "@phosphor-icons/react/dist/ssr";
import { useTimeout } from "ahooks";
import { log } from "evlog";
import { useState } from "react";
import { useUrlPreferences } from "../../hooks/useUrlPreferences";
import { usePreferences } from "../../store/preferences";
import { apiClient } from "../../utils/api";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

export const FilterControls = () => {
    const {
        serverId,
        minTime,
        refreshInterval,
        showAll,
        isPaused,
        ipFilter,
        setMinTime,
        setRefreshInterval,
        toggleShowAll,
        togglePause,
        setIpFilter,
        resetFilters,
    } = useUrlPreferences();
    const readPreference = usePreferences((state) => state.readPreferenceByServer[serverId] ?? "primary");

    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const isSaveDisabled = isSaving || saved;

    useTimeout(() => setSaved(false), saved ? 2000 : undefined);

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await apiClient.post(`/queries/${serverId}/snapshot?minTime=${minTime}&readPreference=${readPreference}`);
            setSaved(true);
        } catch (err) {
            log.error({
                action: "save_snapshot",
                server: { id: serverId },
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Card className="border-2 border-border bg-card p-0">
            <div className="flex items-center border-b-2 border-border bg-muted px-4 py-2.5">
                <span className="font-mono text-xs tracking-wider text-primary uppercase">■ FILTER_CONTROLS</span>
            </div>

            <div className="flex flex-wrap items-end gap-4 p-4">
                <div className="space-y-1">
                    <Label
                        htmlFor="minTime"
                        className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase"
                    >
                        MIN_TIME_MS
                    </Label>
                    <Input
                        id="minTime"
                        type="number"
                        value={minTime}
                        min={0}
                        step={100}
                        className="h-9 w-24 border-2 border-border bg-input font-mono text-sm"
                        onChange={(e) => setMinTime(Number(e.target.value))}
                    />
                </div>

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
                        onChange={(e) => setRefreshInterval(Number(e.target.value))}
                    />
                </div>

                <div className="space-y-1">
                    <Label
                        htmlFor="ipFilter"
                        className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase"
                    >
                        IP_FILTER
                    </Label>
                    <div className="flex gap-1">
                        <Input
                            type="text"
                            id="ipFilter"
                            value={ipFilter ?? ""}
                            placeholder="0.0.0.0"
                            className="h-9 w-40 border-2 border-border bg-input font-mono text-sm placeholder:text-muted-foreground/40"
                            onChange={(e) => setIpFilter(e.target.value === "" ? undefined : e.target.value)}
                        />
                        {ipFilter && (
                            <Button
                                variant="ghost"
                                size="icon"
                                title="Clear IP filter"
                                className="h-9 w-9 border-2 border-border hover:border-destructive hover:bg-destructive/10 hover:text-foreground"
                                onClick={() => setIpFilter(undefined)}
                            >
                                <XIcon weight="bold" className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        OPTIONS
                    </Label>
                    <div className="flex gap-2">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={isPaused ? "default" : "outline"}
                                        title={isPaused ? "Resume updates" : "Pause updates"}
                                        className="h-9 border-2 font-mono text-xs tracking-wide uppercase"
                                        onClick={togglePause}
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
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md border-2 border-border bg-popover p-3">
                                    <p className="font-mono text-xs font-bold text-muted-foreground uppercase">
                                        {isPaused ? "RESUME_UPDATES" : "PAUSE_UPDATES"}
                                    </p>
                                    <p className="mt-2 font-mono text-[10px] leading-relaxed text-foreground">
                                        {isPaused
                                            ? "Click to resume real-time query updates from the server."
                                            : "Click to pause real-time updates and freeze the current view."}
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>

                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant={showAll ? "default" : "outline"}
                                        className="h-9 border-2 font-mono text-xs tracking-wide uppercase"
                                        onClick={toggleShowAll}
                                    >
                                        {showAll ? "● " : "○ "}SHOW_ALL
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-md border-2 border-border bg-popover p-3">
                                    <p className="font-mono text-xs font-bold text-muted-foreground uppercase">
                                        SHOW_ALL_QUERIES
                                    </p>
                                    <p className="mt-2 font-mono text-[10px] leading-relaxed text-foreground">
                                        When disabled, filters system queries, private IPs (192.*), MongoDB internal
                                        ops, monitoring tools, and health checks.
                                    </p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </div>
                </div>

                <div className="ml-auto flex gap-2">
                    <Button
                        variant="outline"
                        title="Reset filters to default"
                        className="h-9 border-2 font-mono text-xs tracking-wide uppercase"
                        onClick={resetFilters}
                    >
                        <ArrowCounterClockwiseIcon weight="bold" className="mr-2 h-3.5 w-3.5" />
                        RESET
                    </Button>

                    <Button
                        variant={saved ? "default" : "outline"}
                        disabled={isSaveDisabled}
                        className="h-9 border-2 font-mono text-xs tracking-wide uppercase"
                        onClick={handleSaveAll}
                    >
                        {saved ? (
                            <>
                                <CheckIcon weight="bold" className="mr-2 h-3.5 w-3.5" />
                                SAVED
                            </>
                        ) : (
                            <>
                                <FloppyDiskIcon weight="bold" className="mr-2 h-3.5 w-3.5" />
                                SAVE_ALL
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </Card>
    );
};
