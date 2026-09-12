import { log } from "evlog";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Application settings store with persistent localStorage
 * Configures default values, auto-save behavior, and issue detection thresholds
 */

export interface IssueThresholds {
    longRunningWarningSecs: number;
    longRunningCriticalSecs: number;
    docsExaminedRatioWarning: number;
    largeResultSetWarning: number;
    highMemoryWarningMB: number;
    timeoutRiskSecs: number;
}

export interface AutoSaveSettings {
    enabled: boolean;
    longRunningThresholdSecs: number;
    saveCollscanQueries: boolean;
    saveTimeoutRiskQueries: boolean;
}

export interface DefaultFilters {
    minTimeMs: number;
    refreshSec: number;
    showAll: boolean;
}

export interface UiPreferences {
    killOpEnabled: boolean;
}

interface SettingsState {
    // Default filter values
    defaultFilters: DefaultFilters;

    // Auto-save configuration
    autoSave: AutoSaveSettings;

    // Issue detection thresholds
    issueThresholds: IssueThresholds;

    // UI preferences
    uiPreferences: UiPreferences;

    // Settings version - increments when settings should be applied (e.g., on modal close)
    settingsVersion: number;

    // Actions
    setDefaultFilters: (filters: Partial<DefaultFilters>) => void;
    setAutoSave: (autoSave: Partial<AutoSaveSettings>) => void;
    setIssueThresholds: (thresholds: Partial<IssueThresholds>) => void;
    setUiPreferences: (preferences: Partial<UiPreferences>) => void;
    applySettings: () => void;
    resetToDefaults: () => void;
}

const onSettingsRehydrated = (state: SettingsState | undefined, error: unknown) => {
    if (!error) {
        log.debug({ settings: { event: "hydrated", defaultFilters: state?.defaultFilters } });
    }
};

const DEFAULT_STATE = {
    defaultFilters: {
        minTimeMs: 1000,
        refreshSec: 2,
        showAll: false,
    },
    autoSave: {
        enabled: false,
        longRunningThresholdSecs: 60,
        saveCollscanQueries: true,
        saveTimeoutRiskQueries: true,
    },
    issueThresholds: {
        longRunningWarningSecs: 30,
        longRunningCriticalSecs: 60,
        docsExaminedRatioWarning: 10,
        largeResultSetWarning: 1000,
        highMemoryWarningMB: 100,
        timeoutRiskSecs: 300,
    },
    uiPreferences: {
        killOpEnabled: false,
    },
    settingsVersion: 0,
};

export const useSettings = create<SettingsState>()(
    persist(
        (set) => ({
            ...DEFAULT_STATE,

            setDefaultFilters: (filters) =>
                set((state) => ({
                    defaultFilters: { ...state.defaultFilters, ...filters },
                })),

            setAutoSave: (autoSave) =>
                set((state) => ({
                    autoSave: { ...state.autoSave, ...autoSave },
                })),

            setIssueThresholds: (thresholds) =>
                set((state) => ({
                    issueThresholds: { ...state.issueThresholds, ...thresholds },
                })),

            setUiPreferences: (preferences) =>
                set((state) => ({
                    uiPreferences: { ...state.uiPreferences, ...preferences },
                })),

            applySettings: () =>
                set((state) => ({
                    settingsVersion: state.settingsVersion + 1,
                })),

            resetToDefaults: () => set(DEFAULT_STATE),
        }),
        {
            name: "mongotop-web-settings",
            onRehydrateStorage: () => onSettingsRehydrated,
        },
    ),
);
