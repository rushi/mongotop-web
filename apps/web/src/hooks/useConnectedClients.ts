import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { ClientsData, ReadPreferenceMode } from "@mongotop-web/types";
import { createEvlogError } from "evlog";
import { useEffect, useRef, useState } from "react";
import { API_BASE, API_KEY } from "../utils/api";

const MAX_RETRY_DELAY = 30000;
const INITIAL_RETRY_DELAY = 500;

export const useConnectedClients = (
    serverId: string,
    refreshInterval: number,
    showAll: boolean,
    readPreference: ReadPreferenceMode,
    node: string | undefined,
    enabled = true,
) => {
    const [data, setData] = useState<ClientsData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);

    const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        const resetConnection = () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
            setIsConnected(false);
            setIsReconnecting(false);
        };

        if (!enabled) {
            resetConnection();
            return;
        }

        let isActive = true;

        const connect = async () => {
            if (!isActive) {
                return;
            }

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            const params = new URLSearchParams({
                refreshInterval: String(refreshInterval),
                showAll: String(showAll),
                readPreference,
            });
            if (node) {
                params.set("node", node);
            }
            const url = `${API_BASE}/clients/${serverId}/stream?${params.toString()}`;

            try {
                await fetchEventSource(url, {
                    signal: abortController.signal,
                    headers: { "X-API-Key": API_KEY },
                    async onopen(response) {
                        if (response.ok) {
                            setIsConnected(true);
                            setIsReconnecting(false);
                            setError(null);
                            retryDelayRef.current = INITIAL_RETRY_DELAY;
                        } else {
                            throw createEvlogError({
                                message: `Failed to connect: ${response.statusText}`,
                                status: response.status,
                            });
                        }
                    },
                    onmessage(event) {
                        if (event.event === "clients") {
                            try {
                                setData(JSON.parse(event.data));
                                setError(null);
                            } catch {
                                setError("Failed to parse client data");
                            }
                        }
                    },
                    onerror(err) {
                        setError("Connection lost");
                        setIsConnected(false);

                        if (!isActive) {
                            throw err; // Stops reconnection
                        }

                        // Exponential backoff: double the delay, up to MAX_RETRY_DELAY
                        setIsReconnecting(true);
                        retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY);

                        // fetchEventSource schedules the next retry after this many ms
                        return retryDelayRef.current;
                    },
                    onclose() {
                        setIsConnected(false);
                    },
                });
            } catch (err: unknown) {
                const errName = err instanceof Error ? err.name : "";
                if (errName !== "AbortError" && isActive) {
                    setError(err instanceof Error ? err.message : "Connection failed");
                    setIsConnected(false);
                }
            }
        };

        connect();

        return () => {
            isActive = false;
            resetConnection();
        };
    }, [serverId, refreshInterval, showAll, readPreference, node, enabled]);

    return { data, error, isConnected, isReconnecting };
};
