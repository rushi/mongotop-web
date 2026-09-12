import JsonView from "@microlink/react-json-view";
import type { ProcessedQuery } from "@mongotop-web/types";
import { CheckIcon, CopyIcon, FloppyDiskIcon, ProhibitIcon, WarningIcon } from "@phosphor-icons/react/dist/ssr";
import { useTimeout } from "ahooks";
import { log } from "evlog";
import { useEffect, useMemo, useState } from "react";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { useUrlPreferences } from "../../hooks/useUrlPreferences";
import { useSettings } from "../../store/settings";
import { apiClient } from "../../utils/api";
import { convertSettingsToThresholds, detectQueryIssues, getSeverityClasses } from "../../utils/queryIssueDetector";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Switch } from "../ui/switch";

interface QueryDetailsProps {
    query: ProcessedQuery | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

/**
 * Component to display detected query issues
 * Uses the modular issue detection system
 */
const QueryIssuesDisplay = ({ query }: { query: ProcessedQuery }) => {
    const { issueThresholds } = useSettings();
    const issues = useMemo(
        () => detectQueryIssues(query, { thresholds: convertSettingsToThresholds(issueThresholds) }),
        [query, issueThresholds],
    );

    // Always show COLLSCAN and WAITING_FOR_LOCK from the query object plus any additional detected issues
    const coreIssues = useMemo(() => {
        const items: Array<{
            id: string;
            label: string;
            message: string;
            icon: string;
            severity: "critical" | "warning" | "info";
        }> = [];

        if (query.isCollscan) {
            items.push({
                id: "collscan",
                icon: "⚠",
                label: "COLLSCAN",
                severity: "warning",
                message: "Full collection scan detected. Consider adding an index for better performance.",
            });
        }

        if (query.waitingForLock) {
            items.push({
                id: "waiting-for-lock",
                icon: "🔒",
                severity: "critical",
                label: "WAITING_FOR_LOCK",
                message: "Query is waiting for a lock. This may indicate resource contention.",
            });
        }

        return items;
    }, [query.isCollscan, query.waitingForLock]);

    // Combine core issues with detected issues, avoiding duplicates
    const allIssues = useMemo(() => {
        const filteredDetected = issues.filter((issue) => {
            return !["collscan", "waiting-for-lock", "blocking-write"].includes(issue.id) || !query.waitingForLock;
        });
        return [...coreIssues, ...filteredDetected];
    }, [coreIssues, issues, query.waitingForLock]);

    if (allIssues.length === 0 && !query.planSummary) {
        return null;
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Plan Summary Badge (when not COLLSCAN) */}
            {query.planSummary && !query.isCollscan && (
                <Badge variant="outline" className="w-fit border-2 font-mono text-xs uppercase">
                    {query.planSummary}
                </Badge>
            )}

            {/* Detected Issues */}
            {allIssues.map((issue) => {
                const classes = getSeverityClasses(issue.severity);
                return (
                    <div key={issue.id} className="flex gap-2">
                        <Badge
                            variant={issue.severity === "critical" ? "destructive" : "outline"}
                            className={`w-fit border-2 ${classes.border} ${classes.bg} font-mono text-xs ${classes.text} uppercase`}
                        >
                            {issue.icon} {issue.label}
                        </Badge>
                        <p
                            className={`border-l-2 ${classes.border} ${classes.bg}/50 px-3 py-2 font-mono text-xs text-muted-foreground`}
                        >
                            {issue.message}
                        </p>
                    </div>
                );
            })}
        </div>
    );
};

export const QueryDetails = ({ query, open, onOpenChange }: QueryDetailsProps) => {
    const { serverId } = useUrlPreferences();
    const { uiPreferences } = useSettings();
    const { killOpEnabled } = uiPreferences;
    const [saved, setSaved] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    const [killStatus, setKillStatus] = useState<"idle" | "killing" | "success" | "error">("idle");
    const [killError, setKillError] = useState<string>();
    const isKilling = killStatus === "killing";
    const [showRawLog, setShowRawLog] = useState(false);
    const { copied: copiedKillOp, copy: copyKillOp } = useCopyToClipboard();
    const { copied: copiedCommand, copy: copyCommand } = useCopyToClipboard();

    useEffect(() => {
        setKillStatus("idle");
        setKillError(undefined);
        setShowRawLog(false);
    }, [query?.opid]);

    // Self-cleaning reset: only arms the timeout while `saved` is true, avoiding a
    // state update after unmount if the dialog closes right after saving.
    useTimeout(() => setSaved(false), saved ? 500 : undefined);

    if (!query) {
        return null;
    }

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await apiClient.post(`/queries/${serverId}/save`, { query });
            setSaved(true);
        } catch (err) {
            log.error({
                action: "save_query",
                query: { opid: query.opid },
                error: err instanceof Error ? err.message : String(err),
            });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyKillOp = async () => {
        const killOpQuery = `db.killOp(${query.opid})`;
        await copyKillOp(killOpQuery);
    };

    const handleKillOp = async () => {
        setKillStatus("killing");
        setKillError(undefined);
        try {
            await apiClient.post(`/queries/${serverId}/kill/${query.opid}`, {});
            setKillStatus("success");
        } catch (err) {
            log.error({
                action: "kill_operation",
                query: { opid: query.opid },
                error: err instanceof Error ? err.message : String(err),
            });
            setKillError(err instanceof Error ? err.message : "Unknown error");
            setKillStatus("error");
        }
    };

    const handleCopyCommand = async () => {
        const command = showRawLog ? query.rawLog : (query.query?.command ?? query.query);
        await copyCommand(JSON.stringify(command, null, 2));
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-[900px] overflow-auto border-l-4 border-l-primary bg-background pb-6 sm:max-w-[900px]">
                <SheetHeader className="flex-row items-start justify-between border-b-2 border-border pr-12 pb-4">
                    <div className="flex flex-col gap-2">
                        <SheetTitle className="font-mono text-xl tracking-wider text-primary uppercase">
                            QUERY_DETAILS
                        </SheetTitle>
                        <SheetDescription className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                            ▸ OPERATION_ID: {query.opid}
                        </SheetDescription>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                variant={copiedKillOp ? "default" : "outline"}
                                disabled={copiedKillOp}
                                className="cursor-copy border-2 font-mono text-xs uppercase"
                                onClick={handleCopyKillOp}
                            >
                                {copiedKillOp ? (
                                    <>
                                        <CheckIcon weight="bold" className="mr-2 h-3 w-3" />
                                        COPIED
                                    </>
                                ) : (
                                    <>
                                        <CopyIcon weight="bold" className="mr-2 h-3 w-3" />
                                        COPY KILLOP
                                    </>
                                )}
                            </Button>
                            {killOpEnabled && (
                                <Button
                                    disabled={isKilling}
                                    size="sm"
                                    variant="outline"
                                    className="border-2 border-destructive/60 font-mono text-xs text-destructive uppercase hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                                    onClick={handleKillOp}
                                >
                                    <ProhibitIcon weight="bold" className="mr-2 h-3 w-3" />
                                    {isKilling ? "KILLING..." : "KILL OP"}
                                </Button>
                            )}
                            <Button
                                size="sm"
                                variant={saved ? "default" : "outline"}
                                disabled={isSaving || saved}
                                className="border-2 font-mono text-xs uppercase"
                                onClick={handleSave}
                            >
                                {saved ? (
                                    <>
                                        <CheckIcon weight="bold" className="mr-2 h-3 w-3" />
                                        SAVED
                                    </>
                                ) : (
                                    <>
                                        <FloppyDiskIcon weight="bold" className="mr-2 h-3 w-3" />
                                        SAVE
                                    </>
                                )}
                            </Button>
                        </div>
                        {killStatus === "success" && (
                            <div className="flex items-center gap-2 rounded border border-primary bg-primary/10 px-3 py-1">
                                <CheckIcon weight="bold" className="h-3 w-3 text-primary" />
                                <span className="font-mono text-[10px] text-primary uppercase">
                                    OP {query.opid} KILLED
                                </span>
                            </div>
                        )}
                        {killStatus === "error" && (
                            <div className="flex items-start gap-2 rounded border border-destructive bg-destructive/10 px-3 py-1">
                                <WarningIcon weight="bold" className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-mono text-[10px] text-destructive uppercase">
                                        KILL FAILED
                                    </span>
                                    {killError && (
                                        <span className="font-mono text-[10px] break-all text-destructive/80">
                                            {killError}
                                        </span>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </SheetHeader>

                <div className="mt-4 space-y-4 px-6">
                    {/* Metadata Grid */}
                    <div className="border-2 border-border bg-card">
                        <div className="border-b-2 border-border bg-muted px-4 py-2">
                            <span className="font-mono text-xs tracking-wider text-primary uppercase">■ METADATA</span>
                        </div>
                        <div className="grid grid-cols-2 gap-0">
                            <div className="border-r border-b border-border p-4">
                                <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                    OPERATION_ID
                                </div>
                                <div className="font-mono text-sm text-foreground">{query.opid}</div>
                            </div>
                            <div className="border-b border-border p-4">
                                <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                    RUNTIME
                                </div>
                                <div className="font-mono text-sm text-primary">{query.runtime_formatted}</div>
                                {query.secs_running >= 1 && (
                                    <div className="mt-1 font-mono text-[10px] text-muted-foreground">
                                        ({query.secs_running}s)
                                    </div>
                                )}
                            </div>
                            <div className="border-r border-b border-border p-4">
                                <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                    OPERATION
                                </div>
                                <div className="font-mono text-sm text-foreground uppercase">{query.operation}</div>
                            </div>
                            <div className="border-b border-border p-4">
                                <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                    NAMESPACE
                                </div>
                                <div className="font-mono text-sm text-foreground">
                                    <span className="text-muted-foreground">{query.database}.</span>
                                    <span className="font-medium">{query.collection}</span>
                                </div>
                            </div>
                            <div className="border-r border-border p-4">
                                <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                    USER / CLIENT_IP
                                </div>
                                <div className="flex space-x-2">
                                    {query.effectiveUsers && query.effectiveUsers.length > 0 && (
                                        <div className="font-mono text-sm text-foreground">
                                            {query.effectiveUsers.map((u, idx) => (
                                                <div key={idx}>
                                                    <span className="font-medium">{u.user}</span>
                                                    <span className="text-muted-foreground">@{u.db}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="font-mono text-sm text-foreground">{query.client.ip}</div>
                                </div>
                            </div>
                            <div className="border-r border-border p-4">
                                <div className="mb-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                                    USER_AGENT
                                </div>
                                <div className="font-mono text-sm text-foreground">{query.userAgent}</div>
                            </div>
                        </div>
                    </div>

                    {/* Geolocation */}
                    {query.client.geo && (
                        <div className="border-2 border-border bg-muted p-4">
                            <div className="mb-2 font-mono text-[10px] tracking-wide text-primary uppercase">
                                ▸ GEOLOCATION
                            </div>
                            <div className="font-mono text-sm text-foreground">
                                {query.client.geo.city && `${query.client.geo.city}, `}
                                {query.client.geo.region && `${query.client.geo.region}, `}
                                {query.client.geo.country}
                            </div>
                        </div>
                    )}

                    {/* Status Badges & Issues */}
                    <QueryIssuesDisplay query={query} />

                    {/* Message */}
                    {query.message && (
                        <div className="border-2 border-border bg-muted p-4">
                            <div className="mb-2 font-mono text-[10px] tracking-wide text-primary uppercase">
                                ▸ MESSAGE
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">{query.message}</div>
                        </div>
                    )}

                    {/* Query JSON */}
                    <div className="border">
                        <div className="flex items-center justify-between border-b bg-muted px-4 py-3">
                            <span className="font-mono text-xs tracking-wider text-primary uppercase">
                                ■ QUERY_OBJECT
                            </span>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <Label
                                        htmlFor="showRawLog"
                                        className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase"
                                    >
                                        Full Log
                                    </Label>
                                    <Switch id="showRawLog" checked={showRawLog} onCheckedChange={setShowRawLog} />
                                </div>
                                <Button
                                    size="sm"
                                    variant={copiedCommand ? "default" : "ghost"}
                                    disabled={copiedCommand}
                                    className="h-6 cursor-copy font-mono text-[10px] uppercase"
                                    onClick={handleCopyCommand}
                                >
                                    {copiedCommand ? (
                                        <>
                                            <CheckIcon weight="bold" className="mr-1 h-3 w-3" />
                                            COPIED
                                        </>
                                    ) : (
                                        <>
                                            <CopyIcon weight="bold" className="mr-1 h-3 w-3" />
                                            COPY
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                        <div className="bg-card p-4">
                            <JsonView
                                sortKeys
                                name={false}
                                collapsed={6}
                                src={showRawLog ? query.rawLog : query.query}
                                displayDataTypes={false}
                                displayObjectSize={false}
                                enableClipboard={false}
                                theme={{
                                    base00: "#0f0f0f", // Background
                                    base01: "#1a1a1a", // Lighter background
                                    base02: "#3c3c3c", // Selection background
                                    base03: "#787878", // Comments, invisibles
                                    base04: "#969696", // Dark foreground
                                    base05: "#e5e5e5", // Default foreground
                                    base06: "#f0f0f0", // Light foreground
                                    base07: "#ffffff", // Light background
                                    base08: "#ff3232", // Variables, XML tags, markup link text
                                    base09: "#ffc800", // Integers, boolean, constants
                                    base0A: "#d4ff00", // Classes, markup bold, search text background
                                    base0B: "#c0ff00", // Strings, inherited class, markup code
                                    base0C: "#d4ff00", // Support, regular expressions, escape characters
                                    base0D: "#c0ff00", // Functions, methods, attribute IDs, headings
                                    base0E: "#ff3232", // Keywords, storage, selector, markup italic
                                    base0F: "#ffc800", // Deprecated, opening/closing embedded language tags
                                }}
                                style={{
                                    fontSize: "12px",
                                    fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
                                    backgroundColor: "transparent",
                                    lineHeight: "1.6",
                                }}
                            />
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
};
