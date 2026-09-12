import type { ProcessedQuery } from "@mongotop-web/types";

/**
 * Severity levels: critical (immediate attention), warning (should be addressed),
 * info (not necessarily a problem).
 */
export type IssueSeverity = "warning" | "critical" | "info";

export interface QueryIssue {
    id: string;
    label: string;
    message: string;
    severity: IssueSeverity;
    icon: string;
}

export interface ThresholdsConfig {
    LONG_RUNNING_WARNING_SECS: number;
    LONG_RUNNING_CRITICAL_SECS: number;
    DOCS_EXAMINED_RATIO_WARNING: number;
    LARGE_RESULT_SET_WARNING: number;
    HIGH_MEMORY_WARNING_BYTES: number;
    TIMEOUT_RISK_SECS: number;
}

export const DEFAULT_THRESHOLDS: ThresholdsConfig = {
    LONG_RUNNING_WARNING_SECS: 30,
    LONG_RUNNING_CRITICAL_SECS: 60,
    DOCS_EXAMINED_RATIO_WARNING: 10,
    LARGE_RESULT_SET_WARNING: 1000,
    HIGH_MEMORY_WARNING_BYTES: 100 * 1024 * 1024, // 100MB
    /** MongoDB's default socket/cursor timeout is around 5 minutes (300s). */
    TIMEOUT_RISK_SECS: 300,
};

// currentOp returns an untyped document, so name the plan fields this module reads.
interface ExecutionStats {
    memUsage?: number;
    memoryUsageBytes?: number;
    nReturned?: number;
    totalDocsExamined?: number;
    docsExamined?: number;
    hasSortStage?: boolean;
    usedDisk?: boolean;
    retryCount?: number;
}

interface QueryDocument {
    executionStats?: ExecutionStats;
    retryCount?: number;
    command?: {
        executionStats?: ExecutionStats;
        limit?: number;
        projection?: Record<string, unknown>;
    };
}

const queryDocument = (query: ProcessedQuery): QueryDocument => query.query as QueryDocument;

export function convertSettingsToThresholds(settings: {
    longRunningWarningSecs: number;
    longRunningCriticalSecs: number;
    docsExaminedRatioWarning: number;
    largeResultSetWarning: number;
    highMemoryWarningMB: number;
    timeoutRiskSecs: number;
}): ThresholdsConfig {
    return {
        LONG_RUNNING_WARNING_SECS: settings.longRunningWarningSecs,
        LONG_RUNNING_CRITICAL_SECS: settings.longRunningCriticalSecs,
        DOCS_EXAMINED_RATIO_WARNING: settings.docsExaminedRatioWarning,
        LARGE_RESULT_SET_WARNING: settings.largeResultSetWarning,
        HIGH_MEMORY_WARNING_BYTES: settings.highMemoryWarningMB * 1024 * 1024,
        TIMEOUT_RISK_SECS: settings.timeoutRiskSecs,
    };
}

/**
 * Flags queries running long enough to risk server resources or indicate a missing index.
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectLongRunning(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const { secs_running } = query;

    if (secs_running >= thresholds.LONG_RUNNING_CRITICAL_SECS) {
        return {
            id: "long-running-critical",
            label: "LONG_RUNNING",
            message: `Query has been running for ${secs_running}s. This may impact database performance and other operations.`,
            severity: "critical",
            icon: "⏱️",
        };
    }

    if (secs_running >= thresholds.LONG_RUNNING_WARNING_SECS) {
        return {
            id: "long-running-warning",
            label: "LONG_RUNNING",
            message: `Query running for ${secs_running}s. Consider optimizing if this is unexpected.`,
            severity: "warning",
            icon: "⏱️",
        };
    }

    return null;
}

/**
 * Flags queries whose reported memory usage exceeds the threshold.
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectHighMemoryUsage(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const executionStats = queryDocument(query).executionStats ?? queryDocument(query).command?.executionStats;
    const memUsage = executionStats?.memUsage ?? executionStats?.memoryUsageBytes;

    if (memUsage && memUsage > thresholds.HIGH_MEMORY_WARNING_BYTES) {
        const memMB = Math.round(memUsage / (1024 * 1024));
        return {
            id: "high-memory",
            label: "HIGH_MEMORY",
            message: `Query is using ${memMB}MB of memory. Consider limiting result set or using projection.`,
            severity: "warning",
            icon: "💾",
        };
    }

    return null;
}

/**
 * Flags queries with a large limit or returned document count, which may need pagination.
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectLargeResultSet(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const executionStats = queryDocument(query).executionStats ?? queryDocument(query).command?.executionStats;
    const nReturned = executionStats?.nReturned;
    const limit = queryDocument(query).command?.limit;

    if (limit && limit > thresholds.LARGE_RESULT_SET_WARNING) {
        return {
            id: "large-result-set",
            label: "LARGE_RESULT",
            message: `Query has a limit of ${limit.toLocaleString()} documents. Consider using pagination for better performance.`,
            severity: "warning",
            icon: "📦",
        };
    }

    if (nReturned && nReturned > thresholds.LARGE_RESULT_SET_WARNING) {
        return {
            id: "large-result-set",
            label: "LARGE_RESULT",
            message: `Query returned ${nReturned.toLocaleString()} documents. Consider adding filters or pagination.`,
            severity: "warning",
            icon: "📦",
        };
    }

    return null;
}

/**
 * Flags queries examining far more documents than they return, a sign of a missing or
 * inefficient index.
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectExcessiveDocsExamined(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const executionStats = queryDocument(query).executionStats ?? queryDocument(query).command?.executionStats;
    const totalDocsExamined = executionStats?.totalDocsExamined ?? executionStats?.docsExamined;
    const nReturned = executionStats?.nReturned;

    if (totalDocsExamined && nReturned && nReturned > 0) {
        const ratio = totalDocsExamined / nReturned;

        if (ratio > thresholds.DOCS_EXAMINED_RATIO_WARNING) {
            return {
                id: "excessive-docs-examined",
                label: "INEFFICIENT_SCAN",
                message: `Examined ${totalDocsExamined.toLocaleString()} docs to return ${nReturned.toLocaleString()} (${Math.round(ratio)}x ratio). Index optimization recommended.`,
                severity: "warning",
                icon: "🔍",
            };
        }
    }

    return null;
}

/**
 * Flags find queries that fetch full documents instead of a projection. Skips aggregations,
 * counts, and other operations that don't take a projection.
 *
 * @param query - The processed query to analyze
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectMissingProjection(query: ProcessedQuery): QueryIssue | null {
    const command = queryDocument(query).command;
    const operation = query.operation?.toLowerCase();

    if (operation !== "query" && operation !== "find") {
        return null;
    }

    const projection = command?.projection;
    const hasProjection = projection && Object.keys(projection).length > 0;

    if (!hasProjection) {
        return {
            id: "missing-projection",
            label: "NO_PROJECTION",
            message: "Query fetches all fields. Add a projection to return only needed fields.",
            severity: "info",
            icon: "📋",
        };
    }

    return null;
}

/**
 * Flags sorts that fall back to an in-memory sort instead of using an index. In-memory sorts
 * are capped at 100MB by default and can fail outright on large result sets.
 *
 * @param query - The processed query to analyze
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectInMemorySort(query: ProcessedQuery): QueryIssue | null {
    const planSummary = query.planSummary ?? "";
    const executionStats = queryDocument(query).executionStats;

    const hasSortInPlan = planSummary.includes("SORT");
    const hasSortStage = executionStats?.hasSortStage === true;
    const usedDisk = executionStats?.usedDisk === true;
    const hasInMemorySort = [hasSortInPlan, hasSortStage, usedDisk].some(Boolean);

    if (hasInMemorySort && !planSummary.includes("IXSCAN")) {
        return {
            id: "in-memory-sort",
            label: "IN_MEMORY_SORT",
            message: "Sort operation not using an index. Large result sets may fail or be slow.",
            severity: "warning",
            icon: "🔀",
        };
    }

    return null;
}

/**
 * Flags queries approaching MongoDB's socket/cursor timeout, which risk failing outright.
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectTimeoutRisk(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const { secs_running } = query;

    if (secs_running >= thresholds.TIMEOUT_RISK_SECS) {
        return {
            id: "timeout-risk",
            label: "TIMEOUT_RISK",
            message: `Query running for ${secs_running}s, approaching timeout threshold. Consider killing this operation.`,
            severity: "critical",
            icon: "⚠️",
        };
    }

    return null;
}

/**
 * Flags write operations blocked waiting for a lock.
 *
 * @param query - The processed query to analyze
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectBlockingWrite(query: ProcessedQuery): QueryIssue | null {
    const operation = query.operation?.toLowerCase();
    const isWriteOp = ["insert", "update", "delete", "remove", "findandmodify"].includes(operation);

    if (isWriteOp && query.waitingForLock) {
        return {
            id: "blocking-write",
            label: "BLOCKED_WRITE",
            message: "Write operation waiting for lock. This may cause application timeouts.",
            severity: "critical",
            icon: "✏️",
        };
    }

    return null;
}

/**
 * Flags operations that were retried, which can indicate transient cluster or network failures.
 *
 * @param query - The processed query to analyze
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectRetryIndicator(query: ProcessedQuery): QueryIssue | null {
    const executionStats = queryDocument(query).executionStats;
    const retryCount = executionStats?.retryCount ?? queryDocument(query).retryCount;

    if (retryCount && retryCount > 0) {
        return {
            id: "retry-indicator",
            label: "RETRIED",
            message: `Operation was retried ${retryCount} time(s). Check for transient failures or network issues.`,
            severity: "warning",
            icon: "🔄",
        };
    }

    return null;
}

export const issueDetectorFns = [
    detectLongRunning,
    detectHighMemoryUsage,
    detectLargeResultSet,
    detectExcessiveDocsExamined,
    detectMissingProjection,
    detectInMemorySort,
    detectTimeoutRisk,
    detectBlockingWrite,
    detectRetryIndicator,
];

/**
 * Runs all detectors against a query and returns the issues found, sorted most severe first.
 *
 * @param query - The processed query to analyze
 * @param options - Optional configuration
 * @param options.excludeIds - Array of issue IDs to exclude from detection
 * @param options.thresholds - Custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns Array of detected QueryIssue objects, sorted by severity
 */
export function detectQueryIssues(
    query: ProcessedQuery,
    options?: { excludeIds?: string[]; thresholds?: ThresholdsConfig },
): QueryIssue[] {
    const { excludeIds = [], thresholds = DEFAULT_THRESHOLDS } = options ?? {};

    const issues = issueDetectorFns
        .map((detector) => detector(query, thresholds as typeof DEFAULT_THRESHOLDS))
        .filter((issue): issue is QueryIssue => issue !== null)
        .filter((issue) => !excludeIds.includes(issue.id));

    const severityOrder: Record<IssueSeverity, number> = {
        critical: 0,
        warning: 1,
        info: 2,
    };

    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

export function getSeverityClasses(severity: IssueSeverity): {
    border: string;
    bg: string;
    text: string;
} {
    switch (severity) {
        case "critical":
            return {
                border: "border-orange-500",
                bg: "bg-orange-500/10",
                text: "text-orange-500",
            };
        case "warning":
            return {
                border: "border-warning",
                bg: "bg-warning/10",
                text: "text-warning",
            };
        case "info":
            return {
                border: "border-muted-foreground",
                bg: "bg-muted",
                text: "text-muted-foreground",
            };
    }
}
