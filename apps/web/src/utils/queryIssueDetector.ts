import type { ProcessedQuery } from "@mongotop-web/types";

/**
 * Severity levels for query issues
 * - warning: Performance concern, should be addressed
 * - critical: Severe issue requiring immediate attention
 * - info: Informational, not necessarily a problem
 */
export type IssueSeverity = "warning" | "critical" | "info";

/**
 * Represents a detected issue with a MongoDB query
 */
export interface QueryIssue {
    id: string;
    label: string;
    message: string;
    severity: IssueSeverity;
    icon: string;
}

/**
 * Configuration thresholds for issue detection
 * Adjust these values based on your environment and requirements
 */
export const DEFAULT_THRESHOLDS = {
    LONG_RUNNING_WARNING_SECS: 30,
    LONG_RUNNING_CRITICAL_SECS: 60,
    /** Documents examined to returned ratio above this triggers inefficiency warning */
    DOCS_EXAMINED_RATIO_WARNING: 10,
    /** Queries returning more than this many documents trigger a warning */
    LARGE_RESULT_SET_WARNING: 1000,
    /** Memory usage above this (bytes) triggers a warning */
    HIGH_MEMORY_WARNING_BYTES: 100 * 1024 * 1024, // 100MB
    /** Approaching MongoDB's default socket timeout (seconds) */
    TIMEOUT_RISK_SECS: 300,
} as const;

export type ThresholdsConfig = typeof DEFAULT_THRESHOLDS;

/**
 * Convert settings thresholds to detector thresholds format
 */
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
 * Issue Detector: Long-Running Queries
 *
 * Detects queries that have been running for an extended period.
 * Long-running queries can:
 * - Consume server resources
 * - Block other operations
 * - Indicate missing indexes or inefficient query patterns
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
 * Issue Detector: High Memory Usage
 *
 * Detects queries consuming excessive memory.
 * High memory queries can:
 * - Cause out-of-memory errors
 * - Trigger disk-based sorting (very slow)
 * - Impact other operations on the server
 *
 * Looks for: executionStats.memUsage or executionStats.memoryUsageBytes
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectHighMemoryUsage(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const executionStats = query.query?.executionStats ?? query.query?.command?.executionStats;
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
 * Issue Detector: Large Result Sets
 *
 * Detects queries returning a large number of documents.
 * Large result sets can:
 * - Consume excessive network bandwidth
 * - Increase client-side memory usage
 * - Indicate missing pagination or filters
 *
 * Looks for: nReturned, docsExamined, or limit in command
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectLargeResultSet(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const executionStats = query.query?.executionStats ?? query.query?.command?.executionStats;
    const nReturned = executionStats?.nReturned;
    const limit = query.query?.command?.limit;

    // If there's a large limit without proper pagination warning
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
 * Issue Detector: Excessive Documents Examined
 *
 * Detects queries that examine many more documents than they return.
 * A high ratio indicates:
 * - Missing or inefficient indexes
 * - Queries that could benefit from better filtering
 * - Potential full collection scans on filtered queries
 *
 * Looks for: totalDocsExamined vs nReturned ratio
 *
 * @param query - The processed query to analyze
 * @param thresholds - Optional custom thresholds (defaults to DEFAULT_THRESHOLDS)
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectExcessiveDocsExamined(query: ProcessedQuery, thresholds = DEFAULT_THRESHOLDS): QueryIssue | null {
    const executionStats = query.query?.executionStats ?? query.query?.command?.executionStats;
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
 * Issue Detector: Missing Projection
 *
 * Detects find queries without a projection.
 * Missing projections can:
 * - Transfer unnecessary data over the network
 * - Increase memory usage on both server and client
 * - Slow down query execution
 *
 * Only flags queries that are likely to benefit from projection
 * (not aggregations, counts, etc.)
 *
 * @param query - The processed query to analyze
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectMissingProjection(query: ProcessedQuery): QueryIssue | null {
    const command = query.query?.command;
    const operation = query.operation?.toLowerCase();

    // Only check find operations
    if (operation !== "query" && operation !== "find") {
        return null;
    }

    // Check if projection exists and has fields
    const projection = command?.projection;
    const hasProjection = projection && Object.keys(projection).length > 0;

    // If no projection or empty projection, suggest adding one
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
 * Issue Detector: In-Memory Sort
 *
 * Detects sorts that cannot use an index and must be done in memory.
 * In-memory sorts:
 * - Are limited to 100MB by default (can cause query failure)
 * - Are significantly slower than index-based sorts
 * - Can cause high memory pressure
 *
 * Looks for: planSummary containing SORT or hasSortStage flag
 *
 * @param query - The processed query to analyze
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectInMemorySort(query: ProcessedQuery): QueryIssue | null {
    const planSummary = query.planSummary ?? "";
    const executionStats = query.query?.executionStats;

    // Check for in-memory sort indicators
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
 * Issue Detector: Timeout Risk
 *
 * Detects queries approaching MongoDB's socket/cursor timeout.
 * Queries at risk of timeout:
 * - May fail unexpectedly
 * - Indicate serious performance problems
 * - Should be killed or optimized immediately
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
 * Issue Detector: Blocking Write
 *
 * Detects write operations that are waiting for a lock.
 * Blocked writes:
 * - Can cause application hangs
 * - May lead to write timeouts
 * - Indicate resource contention issues
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
 * Issue Detector: Retry Indicator
 *
 * Detects operations that have been retried.
 * Retried operations indicate:
 * - Transient failures in the cluster
 * - Network issues
 * - Possible data consistency concerns
 *
 * Looks for: numYields, retryCount, or similar retry indicators
 *
 * @param query - The processed query to analyze
 *
 * @returns QueryIssue if detected, null otherwise
 */
export function detectRetryIndicator(query: ProcessedQuery): QueryIssue | null {
    const executionStats = query.query?.executionStats;
    const retryCount = executionStats?.retryCount ?? query.query?.retryCount;

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

/**
 * List of all available issue detectors.
 * Add or remove detectors here to customize issue detection.
 *
 * Each detector is a function that takes a ProcessedQuery and optional thresholds,
 * and returns either a QueryIssue or null if no issue is detected.
 */
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
 * Analyzes a query and returns all detected issues.
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

    // Sort by severity: critical > warning > info
    const severityOrder: Record<IssueSeverity, number> = {
        critical: 0,
        warning: 1,
        info: 2,
    };

    return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Get the appropriate Tailwind CSS classes for an issue severity
 */
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
