import type { ConnectedClient, ReadPreferenceMode } from "@mongotop-web/types";
import { createFileRoute } from "@tanstack/react-router";
import { useSetState, useTitle } from "ahooks";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { NodePicker } from "../components/collection-activity/NodePicker";
import { ClientSummary } from "../components/connected-clients/ClientSummary";
import { ClientTable, getClientUserKeys } from "../components/connected-clients/ClientTable";
import { ConnectionBadge } from "../components/shared/ConnectionBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { useConnectedClients } from "../hooks/useConnectedClients";
import { useFetchServers } from "../hooks/useFetchServers";
import { useTopNodes } from "../hooks/useTopNodes";
import { useUrlPreferences } from "../hooks/useUrlPreferences";
import { getNodeRole } from "../lib/formatActivity";
import { cn } from "../lib/utils";
import { apiClient, getApiBaseUrl } from "../utils/api";

// Stable empty reference so useDeferredValue doesn't churn before data arrives
const EMPTY_CLIENTS: ConnectedClient[] = [];

export const Route = createFileRoute("/clients")({ component: ConnectedUsers });

function ConnectedUsers() {
    const { servers, loading: serversLoading } = useFetchServers();
    const { serverId, setServerId, refreshInterval, showAll, appFilter, userFilter, setAppFilter, setUserFilter } =
        useUrlPreferences();

    const [connectionState, setConnectionState] = useSetState({
        isConnecting: false,
        mongoConnected: false,
        connectError: null as string | null,
    });

    const [selectedNode, setSelectedNode] = useState<string>();
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

    const { data, error, isConnected, isReconnecting } = useConnectedClients(
        serverId,
        refreshInterval,
        showAll,
        readPreference,
        selectedNode,
        connectionState.mongoConnected,
    );

    // Defer the client list feeding the virtualized table so a burst of connections
    // can't block scroll — sort + render run at low priority
    const deferredClients = useDeferredValue(data?.clients ?? EMPTY_CLIENTS);

    const filteredClients = useMemo(() => {
        return deferredClients.filter((client) => {
            if (appFilter && client.userAgent !== appFilter) {
                return false;
            }
            if (userFilter && !getClientUserKeys(client).includes(userFilter)) {
                return false;
            }
            return true;
        });
    }, [deferredClients, appFilter, userFilter]);

    const handleAppSelect = (app: string) => {
        setAppFilter(appFilter === app ? undefined : app);
    };

    const handleUserSelect = (user: string) => {
        setUserFilter(userFilter === user ? undefined : user);
    };

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

    const currentServer = servers.find((s) => s.id === serverId);
    const serverName = currentServer?.name ?? serverId;
    const connCount = data?.summary.totalConnections ?? 0;
    useTitle(connCount >= 1 ? `(${connCount}) [${serverName}] Connected Clients` : `[${serverName}] Connected Clients`);

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
                <div className={cn("mb-2", accentClass.text)}>
                    ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
                </div>
                <header className="space-y-2">
                    <div className="flex items-start justify-between">
                        <div className="space-y-0.5 pl-3">
                            <h1 className={cn("terminal-cursor text-xl tracking-wider", accentClass.text)}>
                                CONNECTED_CLIENTS
                            </h1>
                            <p className="text-[10px] tracking-wide text-muted-foreground uppercase">
                                ▸ LIVE CLIENT CONNECTIONS{" "}
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
                            <div>
                                <ConnectionBadge
                                    isConnecting={connectionState.isConnecting}
                                    isConnected={isConnected}
                                    isReconnecting={isReconnecting}
                                    isSecondary={isSecondary}
                                />
                            </div>
                        </div>
                    </div>
                </header>
                <div className={cn(accentClass.text)}>
                    ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
                </div>
            </div>

            {connectionState.connectError && (
                <div className="mb-4 shrink-0 border-2 border-destructive bg-destructive/10 p-4">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-lg">▼</span>
                        <h4 className="font-mono text-xs font-bold text-destructive uppercase">CONNECTION_ERROR</h4>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">└─ {connectionState.connectError}</p>
                </div>
            )}

            {error && !isReconnecting && (
                <div className="mb-4 shrink-0 border-2 border-destructive bg-destructive/10 p-6">
                    <div className="mb-2 flex items-center gap-2">
                        <span className="text-xl">▼</span>
                        <p className="font-mono text-sm font-bold text-destructive uppercase">STREAM_ERROR</p>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">└─ {error}</p>
                    <p className="mt-2 font-mono text-xs text-muted-foreground">└─ API_SERVER: {getApiBaseUrl()}</p>
                </div>
            )}

            {data ? (
                <div className="animate-reveal flex min-h-0 flex-1 flex-col space-y-4 opacity-0 delay-100">
                    <div className="shrink-0">
                        <ClientSummary
                            summary={data.summary}
                            appFilter={appFilter}
                            userFilter={userFilter}
                            onAppSelect={handleAppSelect}
                            onUserSelect={handleUserSelect}
                        />
                    </div>
                    <ClientTable clients={filteredClients} className="min-h-0 flex-1" />
                </div>
            ) : (
                !error && (
                    <div className="py-24 text-center">
                        <div className="inline-block h-16 w-16 animate-spin border-4 border-border border-t-primary" />
                        <p className="mt-6 font-mono text-sm tracking-wide text-muted-foreground uppercase">
                            INITIALIZING_MONGODB_CONNECTION
                        </p>
                        <p className="mt-2 font-mono text-xs text-muted-foreground">Loading connected clients...</p>
                    </div>
                )
            )}
        </div>
    );
}
