import type { ProcessedQuery, QuerySummary, ReadPreferenceMode } from "@mongotop-web/types";
import { createFileRoute } from "@tanstack/react-router";
import { useBoolean, useSetState, useTitle } from "ahooks";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { FilterControls } from "../components/query-monitor/FilterControls";
import { QueryDetails } from "../components/query-monitor/QueryDetails";
import { QueryTable } from "../components/query-monitor/QueryTable";
import { SummaryStats } from "../components/query-monitor/SummaryStats";
import { Settings } from "../components/settings/Settings";
import { ConnectionBadge } from "../components/shared/ConnectionBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useFetchServers } from "../hooks/useFetchServers";
import { useServerSentEvents } from "../hooks/useServerSentEvents";
import { useUrlPreferences } from "../hooks/useUrlPreferences";
import { cn } from "../lib/utils";
import { usePreferences } from "../store/preferences";
import { apiClient, getApiBaseUrl } from "../utils/api";

// Generate summary from filtered queries
const generateSummary = (queries: ProcessedQuery[]): QuerySummary => {
    const operations: Record<string, number> = {};
    const collections: Record<string, number> = {};
    const clients: Record<string, number> = {};
    let unindexedCount = 0;

    queries.forEach((query) => {
        const op = query.operation;
        operations[op] = (operations[op] || 0) + 1;

        const collection = query.collection;
        collections[collection] = (collections[collection] || 0) + 1;

        const clientIp = query.client.ip;
        clients[clientIp] = (clients[clientIp] || 0) + 1;

        if (query.isCollscan) {
            unindexedCount++;
        }
    });

    return {
        totalQueries: queries.length,
        shownQueries: queries.length,
        operations,
        collections,
        clients,
        unindexedCount,
    };
};

const resolveReadPreference = (
    urlValue: ReadPreferenceMode | undefined,
    perServerValue: ReadPreferenceMode | undefined,
): ReadPreferenceMode => urlValue ?? perServerValue ?? "primary";

export const Route = createFileRoute("/")({ component: Dashboard });

function Dashboard() {
    const { servers, loading: serversLoading } = useFetchServers();
    const {
        serverId,
        setServerId,
        minTime,
        refreshInterval,
        showAll,
        isPaused,
        ipFilter,
        readPreference: urlReadPreference,
        setReadPreference: setUrlReadPreference,
    } = useUrlPreferences();
    const readPreferenceByServer = usePreferences((state) => state.readPreferenceByServer);
    const setStoredReadPreference = usePreferences((state) => state.setReadPreference);
    const readPreference = resolveReadPreference(urlReadPreference, readPreferenceByServer[serverId]);
    const isSecondary = readPreference === "secondaryPreferred";
    const accentClass = isSecondary
        ? { border: "border-secondary-read", text: "text-secondary-read" }
        : { border: "border-primary", text: "text-primary" };

    const handleReadPreferenceChange = (pref: ReadPreferenceMode) => {
        setUrlReadPreference(pref);
        setStoredReadPreference(serverId, pref);
    };

    const [connectionState, setConnectionState] = useSetState({
        isConnecting: false,
        mongoConnected: false,
        connectError: null as string | null,
    });

    const { data, error, isConnected, isReconnecting, isStale } = useServerSentEvents(
        serverId,
        minTime,
        refreshInterval,
        showAll,
        readPreference,
        connectionState.mongoConnected,
        isPaused,
    );

    const [isDialogOpen, { setTrue: openDialog, setFalse: closeDialog }] = useBoolean(false);
    const [selectedQuery, setSelectedQuery] = useState<ProcessedQuery | null>(null);

    const filteredQueries = useMemo(() => {
        if (!data?.queries) {
            return [];
        }

        // Common path (no filter): reuse the source array, skip a full copy every SSE tick
        if (!ipFilter) {
            return data.queries;
        }

        return data.queries.filter((query) => query.client.ip === ipFilter);
    }, [data?.queries, ipFilter]);

    // Defer the list feeding the virtualized table so a burst of incoming
    // queries can't block scroll/hover — sort + render run at low priority
    const deferredQueries = useDeferredValue(filteredQueries);

    // Generate summary from filtered queries
    const filteredSummary = useMemo(() => {
        if (!data) {
            return undefined;
        }

        // If IP filter is active, always regenerate summary from filtered queries
        if (ipFilter) {
            return generateSummary(filteredQueries);
        }

        // If no filter is active, use the original summary from the backend
        return data.summary;
    }, [filteredQueries, data, ipFilter]);

    // Auto-connect to MongoDB on mount
    useEffect(() => {
        const connectToMongo = async () => {
            setConnectionState({ isConnecting: true, connectError: null });
            try {
                await apiClient.post(`/servers/${serverId}/connect`);
                setConnectionState({ mongoConnected: true, connectError: null, isConnecting: false });
            } catch (err: unknown) {
                setConnectionState({
                    connectError: err instanceof Error ? err.message : "Failed to connect to MongoDB",
                    mongoConnected: false,
                    isConnecting: false,
                });
            }
        };

        connectToMongo();
    }, [serverId, setConnectionState]);

    // Update browser tab title with query count
    const serverName = servers.find((s) => s.id === serverId)?.name ?? serverId;
    const queryCount = filteredQueries.length;
    const baseTitle = serverName ? `[${serverName}] MongoDB Query Monitor` : "MongoDB Query Monitor";
    useTitle(queryCount >= 2 ? `(${queryCount}) ${baseTitle}` : baseTitle);

    const handleQueryClick = (query: ProcessedQuery) => {
        setSelectedQuery(query);
        openDialog();
    };

    const handleServerChange = (newServerId: string) => {
        setServerId(newServerId);
        setUrlReadPreference(undefined);
        setConnectionState({ mongoConnected: false, connectError: null });
    };

    const currentServer = servers.find((s) => s.id === serverId);

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background p-6">
            {/* ASCII Header Border */}
            <div
                className={cn(
                    "animate-reveal mb-4 shrink-0 border-2 p-4 font-mono text-xs leading-tight opacity-0",
                    accentClass.border,
                )}
            >
                <div className={cn("mb-2", accentClass.text)}>
                    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
                </div>
                <header className="space-y-2">
                    <div className="flex items-start justify-between">
                        <div className="space-y-0.5 pl-3">
                            <h1 className={cn("terminal-cursor text-xl tracking-wider", accentClass.text)}>
                                MONGODB_QUERY_MONITOR
                            </h1>
                            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                                ▸ REAL-TIME DATABASE OPERATIONS STREAM{" "}
                                {data?.metadata && (
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                        LAST_UPDATE: {new Date(data.metadata.timestamp).toLocaleTimeString()}
                                    </span>
                                )}
                            </p>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">SRV:</span>
                                <Select value={serverId} disabled={serversLoading} onValueChange={handleServerChange}>
                                    <SelectTrigger className="h-8 w-50 border-2 border-border bg-input font-mono text-xs">
                                        <SelectValue placeholder="Select a server">
                                            {currentServer?.name ?? serverId}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent className="border-2 border-border">
                                        {servers.map((server) => (
                                            <SelectItem key={server.id} value={server.id} className="font-mono text-xs">
                                                {server.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <span className="ml-2 text-muted-foreground">READ:</span>
                                <Button
                                    variant={readPreference === "primary" ? "default" : "outline"}
                                    className="h-8 border-2 font-mono text-xs tracking-wide uppercase"
                                    onClick={() => handleReadPreferenceChange("primary")}
                                >
                                    PRIMARY
                                </Button>
                                <Button
                                    variant={isSecondary ? "default" : "outline"}
                                    className={cn(
                                        "h-8 border-2 font-mono text-xs tracking-wide uppercase",
                                        isSecondary &&
                                            "border-secondary-read bg-secondary-read text-secondary-read-foreground",
                                    )}
                                    onClick={() => handleReadPreferenceChange("secondaryPreferred")}
                                >
                                    SECONDARY
                                </Button>
                                <Settings />
                            </div>
                            <div className="flex flex-col items-end gap-3">
                                <div>
                                    <ConnectionBadge
                                        isConnecting={connectionState.isConnecting}
                                        isStale={isStale}
                                        isConnected={isConnected}
                                        isReconnecting={isReconnecting}
                                        isSecondary={isSecondary}
                                    />
                                </div>
                                {data?.metadata?.isMockData && (
                                    <Badge
                                        variant="outline"
                                        className="gap-1 border-warning bg-warning font-mono text-warning-foreground"
                                    >
                                        ⚠ MOCK_DATA
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>
                </header>
                <div className={cn(accentClass.text)}>
                    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                </div>
            </div>

            <div className="animate-reveal shrink-0 space-y-4 opacity-0 delay-100">
                <FilterControls />

                {connectionState.connectError && (
                    <div className="mb-4 border-2 border-destructive bg-destructive/10 p-4">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-lg">▼</span>
                            <h4 className="font-mono text-xs font-bold text-destructive uppercase">CONNECTION_ERROR</h4>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">└─ {connectionState.connectError}</p>
                    </div>
                )}

                {error && !isReconnecting && (
                    <div className="border-2 border-destructive bg-destructive/10 p-6">
                        <div className="mb-2 flex items-center gap-2">
                            <span className="text-xl">▼</span>
                            <p className="font-mono text-sm font-bold text-destructive uppercase">STREAM_ERROR</p>
                        </div>
                        <p className="font-mono text-xs text-muted-foreground">└─ {error}</p>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">└─ API_SERVER: {getApiBaseUrl()}</p>
                    </div>
                )}

                {isReconnecting && (
                    <div className="border-2 border-border bg-muted p-6">
                        <div className="flex items-center gap-3">
                            <div className="h-4 w-4 animate-spin border-2 border-muted-foreground/20 border-t-muted-foreground" />
                            <p className="font-mono text-sm font-bold uppercase">RECONNECTING_TO_SERVER</p>
                        </div>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">
                            └─ Connection interrupted. Auto-reconnect in progress...
                        </p>
                    </div>
                )}
            </div>

            {data && filteredSummary && (
                <div className="flex min-h-0 flex-1 flex-col">
                    <div className="animate-reveal shrink-0 opacity-0 delay-200">
                        <SummaryStats summary={filteredSummary} />
                    </div>
                    <QueryTable
                        queries={deferredQueries}
                        className="animate-reveal min-h-0 flex-1 opacity-0 delay-300"
                        onQueryClick={handleQueryClick}
                    />
                </div>
            )}

            {!data && !error && (
                <div className="py-24 text-center">
                    <div className="inline-block h-16 w-16 animate-spin border-4 border-border border-t-primary" />
                    <p className="mt-6 font-mono text-sm tracking-wide text-muted-foreground uppercase">
                        INITIALIZING_MONGODB_CONNECTION
                    </p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">Loading query stream...</p>
                </div>
            )}

            <QueryDetails query={selectedQuery} open={isDialogOpen} onOpenChange={closeDialog} />
        </div>
    );
}
