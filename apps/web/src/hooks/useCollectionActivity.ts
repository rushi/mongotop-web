import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { ReadPreferenceMode, TopData } from "@mongotop-web/types";
import { createEvlogError } from "evlog";
import { useEffect, useRef, useState } from "react";
import { API_BASE, API_KEY } from "../utils/api";

const MAX_RETRY_DELAY = 30000; // 30 seconds max
const INITIAL_RETRY_DELAY = 500; // Start with 0.5 second
const MAX_HISTORY = 20; // sparkline window: last N intervals

export const useCollectionActivity = (
    serverId: string,
    refreshInterval: number,
    showAll: boolean,
    readPreference: ReadPreferenceMode,
    node: string | undefined,
    enabled = true,
) => {
    const [data, setData] = useState<TopData>();
    const [error, setError] = useState<string>();
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);

    const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
    const abortControllerRef = useRef<AbortController | null>(null);
    // Rolling per-namespace history of total.deltaTime, read during render for sparklines.
    const historyRef = useRef<Map<string, number[]>>(new Map());

    useEffect(() => {
        const cleanup = () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
            historyRef.current.clear();
            setIsConnected(false);
            setIsReconnecting(false);
        };

        if (!enabled) {
            cleanup();
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
            const url = `${API_BASE}/top/${serverId}/stream?${params.toString()}`;

            try {
                await fetchEventSource(url, {
                    signal: abortController.signal,
                    headers: { "X-API-Key": API_KEY },
                    // Keep streaming while the tab is backgrounded. Default (false) closes
                    // on hide and reopens on focus — that reconnect resets the server's
                    // previous sample, emitting an all-zero diff frame that dims the table.
                    openWhenHidden: true,
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
                        if (event.event !== "top") {
                            return;
                        }
                        try {
                            const parsed = JSON.parse(event.data) as TopData;
                            const history = historyRef.current;
                            const seen = new Set<string>();
                            for (const activity of parsed.collections) {
                                seen.add(activity.ns);
                                // Replace the array (not mutate) so memoized rows see a new reference on change.
                                const series = history.get(activity.ns) ?? [];
                                history.set(activity.ns, [...series, activity.total.deltaTime].slice(-MAX_HISTORY));
                            }
                            // Drop namespaces no longer reported so the map doesn't grow unbounded.
                            for (const ns of history.keys()) {
                                if (!seen.has(ns)) {
                                    history.delete(ns);
                                }
                            }
                            setData(parsed);
                            setError(null);
                        } catch {
                            setError("Failed to parse activity data");
                        }
                    },
                    onerror(err) {
                        if (!isActive) {
                            throw err; // Stops reconnection
                        }

                        setError("Connection lost");
                        setIsConnected(false);
                        setIsReconnecting(true);
                        retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY);
                        return retryDelayRef.current;
                    },
                    onclose() {
                        setIsConnected(false);
                    },
                });
            } catch (err: unknown) {
                const isAbort = err instanceof Error && err.name === "AbortError";
                if (!isAbort && isActive) {
                    setError(err instanceof Error ? err.message : "Connection failed");
                    setIsConnected(false);
                }
            }
        };

        connect();

        return () => {
            isActive = false;
            cleanup();
        };
    }, [serverId, refreshInterval, showAll, readPreference, node, enabled]);

    return { data, error, isConnected, isReconnecting, history: historyRef.current };
};
