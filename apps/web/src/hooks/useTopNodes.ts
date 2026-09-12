import type { TopNode } from "@mongotop-web/types";
import { useEffect, useState } from "react";
import { apiClient } from "../utils/api";

// Lists the replica-set members so the user can pin sampling to one node.
export const useTopNodes = (serverId: string, enabled: boolean) => {
    const [nodes, setNodes] = useState<TopNode[]>([]);

    useEffect(() => {
        if (!enabled) {
            return;
        }

        let isActive = true;
        apiClient
            .get<{ nodes: TopNode[] }>(`/top/${serverId}/nodes`)
            .then((res) => {
                if (isActive) {
                    setNodes(res.nodes);
                }
            })
            .catch(() => {
                if (isActive) {
                    setNodes([]);
                }
            });

        return () => {
            isActive = false;
        };
    }, [serverId, enabled]);

    return nodes;
};
