import type { ClientSummary as ClientSummaryType } from "@mongotop-web/types";
import { cn } from "../../lib/utils";

interface BreakdownListProps {
    entries: [string, number][];
    activeValue: string | undefined;
    onSelect: (value: string) => void;
}

const BreakdownList = ({ entries, activeValue, onSelect }: BreakdownListProps) => {
    if (entries.length === 0) {
        return <div className="font-mono text-xs text-muted-foreground">NO_DATA</div>;
    }

    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
            {entries.map(([label, count]) => (
                <button
                    key={label}
                    type="button"
                    className="flex cursor-pointer items-center gap-1.5 transition-colors hover:text-primary"
                    onClick={() => onSelect(label)}
                >
                    <span className="text-primary">▸</span>
                    <span className="font-bold text-primary tabular-nums">{count}</span>
                    <span className={cn("truncate", activeValue === label ? "text-primary" : "text-foreground")}>
                        {label}
                    </span>
                </button>
            ))}
        </div>
    );
};

interface ClientSummaryProps {
    summary: ClientSummaryType;
    appFilter?: string;
    userFilter?: string;
    onAppSelect: (app: string) => void;
    onUserSelect: (user: string) => void;
}

export const ClientSummary = ({ summary, appFilter, userFilter, onAppSelect, onUserSelect }: ClientSummaryProps) => {
    const appEntries = Object.entries(summary.byApp)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6);
    const userEntries = Object.entries(summary.byUser)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 6);

    return (
        <div className="mb-4 border-2 border-border bg-card">
            <div className="flex items-center border-b-2 border-border bg-muted px-4 py-2.5">
                <span className="font-mono text-xs tracking-wider text-primary uppercase">■ CONNECTION_SUMMARY</span>
            </div>

            <div className="grid grid-cols-[minmax(150px,auto)_minmax(120px,auto)_1fr_1fr] gap-0">
                <div className="border-r-2 border-border p-3">
                    <div className="mb-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        TOTAL_CONNS
                    </div>
                    <div className="font-mono text-lg text-primary tabular-nums">{summary.totalConnections}</div>
                    <div className="mt-1 font-mono text-[10px] text-muted-foreground uppercase">
                        <span className="text-primary tabular-nums">{summary.activeConnections}</span> ACTIVE ·{" "}
                        <span className="tabular-nums">{summary.idleConnections}</span> IDLE
                    </div>
                </div>

                <div className="border-r-2 border-border p-3">
                    <div className="mb-0.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        UNIQUE_IPS
                    </div>
                    <div className="font-mono text-lg text-primary tabular-nums">
                        {Object.keys(summary.byIp).length}
                    </div>
                </div>

                <div className="border-r-2 border-border p-3">
                    <div className="mb-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        CLIENTS
                    </div>
                    <BreakdownList entries={appEntries} activeValue={appFilter} onSelect={onAppSelect} />
                </div>

                <div className="p-3">
                    <div className="mb-1.5 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        USERS
                    </div>
                    <BreakdownList entries={userEntries} activeValue={userFilter} onSelect={onUserSelect} />
                </div>
            </div>
        </div>
    );
};
