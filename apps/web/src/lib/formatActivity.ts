import type { ActivityMetric, ActivityMode, TopNode } from "@mongotop-web/types";
import dayjs from "dayjs";

const MS_PER_SECOND = 1_000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

const durationParts = (totalMs: number) => ({
    days: Math.floor(totalMs / MS_PER_DAY),
    hours: Math.floor((totalMs % MS_PER_DAY) / MS_PER_HOUR),
    minutes: Math.floor((totalMs % MS_PER_HOUR) / MS_PER_MINUTE),
    seconds: Math.floor((totalMs % MS_PER_MINUTE) / MS_PER_SECOND),
});

export const formatMicros = (micros: number) => {
    if (micros <= 0) {
        return "0";
    }
    if (micros < 1_000) {
        return `${Math.round(micros)}µs`;
    }
    if (micros < MS_PER_SECOND * 1_000) {
        return `${(micros / 1_000).toFixed(1)}ms`;
    }

    const totalMs = micros / 1_000;
    if (totalMs < MS_PER_MINUTE) {
        return `${(totalMs / MS_PER_SECOND).toFixed(2)}s`;
    }

    const { days, hours, minutes, seconds } = durationParts(totalMs);
    if (days > 0) {
        return `${days}d ${hours}h`;
    }
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${seconds}s`;
};

export const avgLatencyMicros = (time: number, count: number) => {
    if (count <= 0) {
        return 0;
    }
    return time / count;
};

export const metricTime = (metric: ActivityMetric, mode: ActivityMode) =>
    mode === "diff" ? metric.deltaTime : metric.cumTime;

export const metricCount = (metric: ActivityMetric, mode: ActivityMode) =>
    mode === "diff" ? metric.deltaCount : metric.cumCount;

export const getNodeRole = (nodes: TopNode[], host: string | undefined) =>
    nodes.find((node) => node.host === host)?.role ?? "primary";

const COUNT_FORMAT = new Intl.NumberFormat();

export const formatCount = (count: number) => COUNT_FORMAT.format(count);

export const formatUptime = (startedAt: string) => {
    const { days, hours, minutes } = durationParts(dayjs().diff(dayjs(startedAt)));

    const parts: string[] = [];
    if (days > 0) {
        parts.push(`${days}d`);
    }
    if (days > 0 || hours > 0) {
        parts.push(`${hours}h`);
    }
    parts.push(`${minutes}m`);

    return parts.join(" ");
};
