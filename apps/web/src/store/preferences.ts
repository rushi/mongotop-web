import type { ReadPreferenceMode } from "@mongotop-web/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
    serverId: string;
    isPaused: boolean;
    ipFilter?: string;
    readPreferenceByServer: Record<string, ReadPreferenceMode>;

    setServerId: (id: string) => void;
    togglePause: () => void;
    setIpFilter: (ip?: string) => void;
    setReadPreference: (serverId: string, pref: ReadPreferenceMode) => void;
    resetFilters: () => void;
}

export const usePreferences = create<PreferencesState>()(
    persist(
        (set) => ({
            serverId: "localhost",
            isPaused: false,
            ipFilter: undefined,
            readPreferenceByServer: {} as Record<string, ReadPreferenceMode>,

            setServerId: (id) => set({ serverId: id }),
            togglePause: () => set((state) => ({ isPaused: !state.isPaused })),
            setIpFilter: (ip) => set({ ipFilter: ip }),
            setReadPreference: (serverId, pref) =>
                set((state) => ({
                    readPreferenceByServer: { ...state.readPreferenceByServer, [serverId]: pref },
                })),
            resetFilters: () => set({ isPaused: false, ipFilter: undefined }),
        }),
        {
            // localStorage key. Renaming it discards every existing user's saved state.
            name: "mongo-query-top-preferences",
        },
    ),
);
