import { fetchEventSource } from "@microsoft/fetch-event-source";
import type { QueryData, ReadPreferenceMode } from "@mongotop-web/types";
import { useDocumentVisibility, useInterval } from "ahooks";
import { createEvlogError, log } from "evlog";
import { useEffect, useRef, useState } from "react";
import { useSettings } from "../store/settings";
import { API_BASE, API_KEY } from "../utils/api";

const MAX_RETRY_DELAY = 30000; // 30 seconds max
const INITIAL_RETRY_DELAY = 500; // Start with 0.5 second

export const useServerSentEvents = (
    serverId: string,
    minTime: number,
    refreshInterval: number,
    showAll: boolean,
    readPreference: ReadPreferenceMode,
    enabled = true,
    isPaused = false,
) => {
    const settingsVersion = useSettings((state) => state.settingsVersion);
    const [error, setError] = useState<string>();
    const [data, setData] = useState<QueryData>();

    const [isStale, setIsStale] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);

    const reconnectAttemptsRef = useRef(0);
    const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
    const abortControllerRef = useRef<AbortController | null>(null);
    const lastUpdateTimeRef = useRef<number>(Date.now());

    useEffect(() => {
        if (isPaused || !enabled) {
            if (abortControllerRef.current) {
                // Cleanup connection if paused
                log.debug({ connection: { event: "pausing" } });
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            setIsConnected(false);
            setIsReconnecting(false);
            if (isPaused) {
                setError(undefined); // Clear error when paused
            }
            return;
        }

        let isActive = true;

        const connect = async () => {
            if (!isActive) {
                return;
            }

            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            // Read current settings when establishing connection
            const { autoSave, issueThresholds } = useSettings.getState();

            // Build URL with query params
            const params = new URLSearchParams({
                minTime: String(minTime),
                refreshInterval: String(refreshInterval),
                showAll: String(showAll),
                readPreference,
            });

            // Add auto-save settings
            params.append("autoSaveEnabled", String(autoSave.enabled));
            params.append("autoSaveLongRunningThreshold", String(autoSave.longRunningThresholdSecs));
            params.append("autoSaveCollscan", String(autoSave.saveCollscanQueries));
            params.append("autoSaveTimeoutRisk", String(autoSave.saveTimeoutRiskQueries));

            // Add timeout risk threshold
            params.append("timeoutRiskThreshold", String(issueThresholds.timeoutRiskSecs));

            const url = `${API_BASE}/queries/${serverId}/stream?${params.toString()}`;

            try {
                log.info({ connection: { event: "connecting", url } });
                await fetchEventSource(url, {
                    signal: abortController.signal,
                    headers: { "X-API-Key": API_KEY },
                    async onopen(response) {
                        if (response.ok) {
                            log.info({ connection: { event: "established", url } });
                            setIsConnected(true);
                            setIsReconnecting(false);
                            setError(undefined);
                            retryDelayRef.current = INITIAL_RETRY_DELAY;
                            reconnectAttemptsRef.current = 0;
                        } else {
                            log.warn({
                                connection: {
                                    event: "open_failed",
                                    status: response.status,
                                    statusText: response.statusText,
                                },
                            });
                            throw createEvlogError({
                                message: `Failed to connect: ${response.statusText}`,
                                status: response.status,
                            });
                        }
                    },
                    onmessage(event) {
                        if (event.event === "queries") {
                            try {
                                const parsedData = JSON.parse(event.data);
                                setData(parsedData);
                                setError(undefined);
                                lastUpdateTimeRef.current = Date.now();
                                setIsStale(false);
                            } catch (err) {
                                log.error({
                                    connection: { event: "parse_failed" },
                                    error: err instanceof Error ? err.message : String(err),
                                });
                                setError("Failed to parse query data");
                            }
                        }
                    },
                    onerror(err) {
                        setError("Connection lost");
                        log.warn({
                            connection: { event: "lost" },
                            error: err instanceof Error ? err.message : String(err),
                        });
                        setIsConnected(false);

                        if (!isActive) {
                            log.debug({ connection: { event: "aborted" } });
                            throw err; // Stops reconnection
                        }

                        // Attempt to reconnect with exponential backoff
                        setIsReconnecting(true);
                        reconnectAttemptsRef.current++;

                        // Exponential backoff: double the delay, up to MAX_RETRY_DELAY
                        retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_DELAY);
                        log.info({
                            connection: {
                                event: "reconnecting",
                                delayMs: retryDelayRef.current,
                                attempt: reconnectAttemptsRef.current,
                            },
                        });

                        // Return the retry delay to trigger reconnection
                        return retryDelayRef.current;
                    },
                    onclose() {
                        // Connection closed by server, will attempt to reconnect
                        log.info({ connection: { event: "closed_by_server" } });
                        setIsConnected(false);
                    },
                });
            } catch (err: unknown) {
                const errMessage = err instanceof Error ? err.message : "Connection failed";
                const errName = err instanceof Error ? err.name : "";
                log.warn({ connection: { event: "error", name: errName }, error: errMessage });
                if (errName !== "AbortError" && isActive) {
                    setError(errMessage);
                    setIsConnected(false);
                }
            }
        };

        connect();

        return () => {
            isActive = false;

            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }

            setIsConnected(false);
            setIsReconnecting(false);
        };
    }, [serverId, minTime, refreshInterval, showAll, readPreference, enabled, isPaused, settingsVersion]);

    // Check for stale connection (no updates for > 2 seconds)
    // Skip stale detection when page is hidden to avoid false positives
    const documentVisibility = useDocumentVisibility();

    // Reset stale state when page becomes visible
    useEffect(() => {
        if (documentVisibility === "visible") {
            lastUpdateTimeRef.current = Date.now();
            setIsStale(false);
        }
    }, [documentVisibility]);

    // Use useInterval for stale checking with conditional execution
    useInterval(
        () => {
            const timeSinceLastUpdate = Date.now() - lastUpdateTimeRef.current;
            const isCurrentlyStale = timeSinceLastUpdate > 3000;

            if (isCurrentlyStale !== isStale) {
                setIsStale(isCurrentlyStale);
                if (isCurrentlyStale) {
                    log.debug({ connection: { event: "stale" } });
                }
            }
        },
        // Only run when connected, not paused, and page is visible
        isConnected && !isPaused && documentVisibility === "visible" ? 500 : undefined,
    );

    return { data, error, isConnected, isReconnecting, isStale };
};
