import type { ReadPreferenceMode } from "@mongotop-web/types";
import { createFileRoute } from "@tanstack/react-router";
import { useSetState, useTitle } from "ahooks";
import { useEffect, useState } from "react";
import { ActivityControls } from "../components/collection-activity/ActivityControls";
import { ActivityTable } from "../components/collection-activity/ActivityTable";
import { NodePicker } from "../components/collection-activity/NodePicker";
import { ConnectionBadge } from "../components/shared/ConnectionBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useCollectionActivity } from "../hooks/useCollectionActivity";
import { useFetchServers } from "../hooks/useFetchServers";
import { useTopNodes } from "../hooks/useTopNodes";
import { useUrlPreferences } from "../hooks/useUrlPreferences";
import { getNodeRole } from "../lib/formatActivity";
import { cn } from "../lib/utils";
import { apiClient, getApiBaseUrl } from "../utils/api";

export const Route = createFileRoute("/activity")({ component: CollectionActivityPage });

function CollectionActivityPage() {
    const { servers, loading: serversLoading } = useFetchServers();
    const {
        serverId,
        setServerId,
        refreshInterval,
        setRefreshInterval,
        showAll,
        toggleShowAll,
        isPaused,
        togglePause,
        mode,
        setMode,
    } = useUrlPreferences();

    const [selectedNode, setSelectedNode] = useState<string>();
    const [connectionState, setConnectionState] = useSetState({
        isConnecting: false,
        mongoConnected: false,
        connectError: null as string | null,
    });

    const nodes = useTopNodes(serverId, connectionState.mongoConnected);
    const selectedRole = getNodeRole(nodes, selectedNode);
    const isSecondary = selectedRole === "secondary";
    const readPreference: ReadPreferenceMode = isSecondary ? "secondaryPreferred" : "primary";
    const accentClass = isSecondary
        ? { border: "border-secondary-read", text: "text-secondary-read" }
        : { border: "border-primary", text: "text-primary" };

    // Default the node picker to the primary once the member list loads (or when the
    // current selection no longer belongs to the selected server).
    useEffect(() => {
        if (nodes.length === 0) {
            return;
        }

        const isStillValid = selectedNode && nodes.some((node) => node.host === selectedNode);
        if (isStillValid) {
            return;
        }

        const primary = nodes.find((node) => node.role === "primary");
        setSelectedNode((primary ?? nodes[0]).host);
    }, [nodes, selectedNode]);

    const { data, error, isConnected, isReconnecting, history } = useCollectionActivity(
        serverId,
        refreshInterval,
        showAll,
        readPreference,
        selectedNode,
        connectionState.mongoConnected && !isPaused,
    );

    // Auto-connect to MongoDB on mount / server change
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

    const currentServer = servers.find((server) => server.id === serverId);
    const serverName = currentServer?.name ?? serverId;
    const collectionCount = data?.collections.length ?? 0;
    useTitle(`[${serverName}] Collection Activity`);

    const handleServerChange = (newServerId: string) => {
        setServerId(newServerId);
        setSelectedNode(undefined);
        setConnectionState({ mongoConnected: false, connectError: null });
    };

    return (
        <div className="flex h-full flex-col overflow-hidden bg-background p-6">
            <div
                className={cn(
                    "animate-reveal mb-4 shrink-0 border-2 p-4 font-mono text-xs leading-tight opacity-0",
                    accentClass.border,
                )}
            >
                <header className="flex items-start justify-between">
                    <div className="space-y-0.5">
                        <h1 className={cn("terminal-cursor text-xl tracking-wider", accentClass.text)}>
                            COLLECTION_ACTIVITY
                        </h1>
                        <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                            ▸ LIVE READ/WRITE ACTIVITY PER COLLECTION{" "}
                            {data?.metadata && (
                                <span className="text-[10px] text-muted-foreground">
                                    LAST_UPDATE: {new Date(data.metadata.timestamp).toLocaleTimeString()} ·{" "}
                                    {collectionCount} NS
                                </span>
                            )}
                        </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">SRV:</span>
                            <Select value={serverId} disabled={serversLoading} onValueChange={handleServerChange}>
                                <SelectTrigger className="h-8 w-50 border-2 border-border bg-input font-mono text-xs">
                                    <SelectValue placeholder="Select a server">{serverName}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="border-2 border-border">
                                    {servers.map((server) => (
                                        <SelectItem key={server.id} value={server.id} className="font-mono text-xs">
                                            {server.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <span className="ml-2 text-muted-foreground">NODE:</span>
                            <NodePicker
                                isSecondary={isSecondary}
                                nodes={nodes}
                                value={selectedNode}
                                onChange={setSelectedNode}
                            />
                        </div>
                        <ConnectionBadge
                            isConnecting={connectionState.isConnecting}
                            isConnected={isConnected}
                            isReconnecting={isReconnecting}
                            isSecondary={isSecondary}
                        />
                    </div>
                </header>
            </div>

            <div className="mb-4 shrink-0">
                <ActivityControls
                    isPaused={isPaused}
                    showAll={showAll}
                    mode={mode}
                    refreshInterval={refreshInterval}
                    serverStartedAt={data?.metadata.serverStartedAt}
                    onModeChange={setMode}
                    onRefreshIntervalChange={setRefreshInterval}
                    onTogglePause={togglePause}
                    onToggleShowAll={toggleShowAll}
                />
            </div>

            {connectionState.connectError && (
                <div className="mb-4 shrink-0 border-2 border-destructive bg-destructive/10 p-4">
                    <p className="font-mono text-xs text-muted-foreground">└─ {connectionState.connectError}</p>
                </div>
            )}

            {error && !isReconnecting && (
                <div className="mb-4 shrink-0 border-2 border-destructive bg-destructive/10 p-6">
                    <p className="font-mono text-sm font-bold text-destructive uppercase">▼ STREAM_ERROR</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">└─ {error}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">└─ API_SERVER: {getApiBaseUrl()}</p>
                </div>
            )}

            {data ? (
                <ActivityTable
                    collections={data.collections}
                    history={history}
                    mode={mode}
                    className="animate-reveal min-h-0 flex-1 opacity-0 delay-100"
                />
            ) : (
                !error && (
                    <div className="py-24 text-center">
                        <div className="inline-block h-16 w-16 animate-spin border-4 border-border border-t-primary" />
                        <p className="mt-6 font-mono text-sm tracking-wide text-muted-foreground uppercase">
                            INITIALIZING_MONGODB_CONNECTION
                        </p>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">Loading collection activity...</p>
                    </div>
                )
            )}
        </div>
    );
}
