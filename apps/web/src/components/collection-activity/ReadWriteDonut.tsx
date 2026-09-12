import { cn } from "../../lib/utils";

interface ReadWriteDonutProps {
    read: number;
    write: number;
    className?: string;
}

const RADIUS = 6;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS; // ~37.7

// 16px ring showing the read/write time split, with the two percentages beside it.
// Compact by design: the READ/WRITE columns already carry the raw numbers, this is
// the at-a-glance ratio.
export const ReadWriteDonut = ({ read, write, className }: ReadWriteDonutProps) => {
    const total = read + write;

    if (total <= 0) {
        return <span className={cn("font-mono text-[10px] text-muted-foreground", className)}>—</span>;
    }

    const readPct = Math.round((read / total) * 100);
    const readArc = (readPct / 100) * CIRCUMFERENCE;

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <svg width={16} height={16} className="-rotate-90" aria-hidden="true">
                <circle cx={8} cy={8} r={RADIUS} fill="none" strokeWidth={4} className="stroke-secondary-read/60" />
                <circle
                    cx={8}
                    cy={8}
                    r={RADIUS}
                    fill="none"
                    strokeWidth={4}
                    strokeDasharray={`${readArc} ${CIRCUMFERENCE}`}
                    className="stroke-primary/70"
                />
            </svg>
            <span className="font-mono text-[10px] tabular-nums">
                <span className="text-primary">{readPct}%</span>
                <span className="mx-0.5 text-muted-foreground">/</span>
                <span className="text-secondary-read">{100 - readPct}%</span>
            </span>
        </div>
    );
};
