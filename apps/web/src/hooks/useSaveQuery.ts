import type { ProcessedQuery } from "@mongotop-web/types";
import { useUnmount } from "ahooks";
import { log } from "evlog";
import { useCallback, useRef, useState } from "react";
import { apiClient } from "../utils/api";

export const useSaveQuery = (serverId: string) => {
    const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
    const clearSavedTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    useUnmount(() => {
        clearSavedTimeouts.current.forEach(clearTimeout);
    });

    const handleSave = useCallback(
        async (query: ProcessedQuery) => {
            setSavingIds((prev) => new Set(prev).add(query.opid));
            try {
                await apiClient.post(`/queries/${serverId}/save`, { query });
                setSavedIds((prev) => new Set(prev).add(query.opid));
                const timeoutId = setTimeout(() => {
                    setSavedIds((prev) => {
                        const next = new Set(prev);
                        next.delete(query.opid);
                        return next;
                    });
                    clearSavedTimeouts.current.delete(query.opid);
                }, 2000);
                clearSavedTimeouts.current.set(query.opid, timeoutId);
            } catch (err) {
                log.error({
                    action: "save_query",
                    query: { opid: query.opid },
                    error: err instanceof Error ? err.message : String(err),
                });
            } finally {
                setSavingIds((prev) => {
                    const next = new Set(prev);
                    next.delete(query.opid);
                    return next;
                });
            }
        },
        [serverId],
    );

    return { savingIds, savedIds, handleSave };
};
