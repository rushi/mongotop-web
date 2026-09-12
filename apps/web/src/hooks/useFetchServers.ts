import { useRequest } from "ahooks";
import { apiClient } from "../utils/api";

export interface ServerInfo {
    id: string;
    name: string;
    connected: boolean;
}

export const useFetchServers = () => {
    const { data, loading, error } = useRequest(
        async () => {
            const response = await apiClient.get<{ servers: ServerInfo[] }>("/servers");
            return response.servers;
        },
        {
            cacheKey: "servers-list",
            staleTime: 60000, // Cache for 60 seconds
        },
    );

    return {
        servers: data ?? [],
        loading,
        error: error?.message ?? null,
    };
};
