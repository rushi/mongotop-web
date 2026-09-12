import axios, { type AxiosError } from "axios";
import { createEvlogError, parseError } from "evlog";
import config from "../config";

// If config.apiUrl is set, use it. Otherwise, use same hostname as web app with the dev API port.
export const getApiBaseUrl = () => {
    if (config.apiUrl) {
        return config.apiUrl;
    }

    // Fallback: Use current hostname but with dev API port (7001). config.apiUrl is always
    // set by generate-web-config.js in practice, so this rarely triggers.
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:7001`;
};

export const API_BASE = `${getApiBaseUrl()}/api`;
export const API_KEY = config.apiKey;

const axiosInstance = axios.create({
    baseURL: API_BASE,
    headers: {
        "X-API-Key": API_KEY,
    },
});

axiosInstance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
        // The API sends structured errors ({ message, why, fix, link }). Normalize whatever
        // we got and re-throw as an EvlogError so callers keep `.message` and gain `.why`/`.fix`.
        const parsed = parseError(error.response?.data ?? error);
        throw createEvlogError({
            message: parsed.message ?? error.message ?? "API request failed",
            status: parsed.status,
            why: parsed.why,
            fix: parsed.fix,
            link: parsed.link,
        });
    },
);

export const apiClient = {
    async get<T = unknown>(endpoint: string, params?: Record<string, unknown>): Promise<T> {
        const response = await axiosInstance.get(endpoint, { params });
        return response.data;
    },

    async post<T = unknown>(endpoint: string, body?: unknown): Promise<T> {
        const response = await axiosInstance.post(endpoint, body);
        return response.data;
    },
};
