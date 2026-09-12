import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { parseAsString, parseAsStringLiteral, useQueryState } from "nuqs";
import { NuqsAdapter } from "nuqs/adapters/tanstack-router";
import type { CSSProperties } from "react";
import { READ_PREFERENCE_MODES } from "../hooks/useUrlPreferences";
import { usePreferences } from "../store/preferences";

export const Route = createRootRoute({
    component: RootComponent,
});

const NAV_LINKS = [
    { to: "/", label: "QUERY_MONITOR" },
    { to: "/clients", label: "CONNECTED_CLIENTS" },
    { to: "/activity", label: "COLLECTION_ACTIVITY" },
] as const;

const DEFAULT_SERVER_ID = "localhost";

// Overrides --primary (lime) with --secondary-read (cyan) for every descendant that uses
// text-primary/bg-primary/border-primary, so reading from a secondary is unmistakable
// app-wide, not just on the few elements that were manually flagged with secondary-read.
const SECONDARY_THEME_STYLE = {
    "--primary": "var(--secondary-read)",
    "--primary-foreground": "var(--secondary-read-foreground)",
} as CSSProperties;

function RootComponent() {
    return (
        <NuqsAdapter>
            <AppShell />
        </NuqsAdapter>
    );
}

function AppShell() {
    const [serverId] = useQueryState("serverId", parseAsString.withDefault(DEFAULT_SERVER_ID));
    const [urlReadPreference] = useQueryState("readPreference", parseAsStringLiteral(READ_PREFERENCE_MODES));
    const readPreferenceByServer = usePreferences((state) => state.readPreferenceByServer);
    const isSecondary = (urlReadPreference ?? readPreferenceByServer[serverId] ?? "primary") === "secondaryPreferred";

    return (
        <div className="flex h-screen flex-col overflow-hidden" style={isSecondary ? SECONDARY_THEME_STYLE : undefined}>
            <nav className="flex shrink-0 items-center gap-1 border-b-2 border-border bg-card px-6 py-2 font-mono text-xs">
                <span className="mr-3 tracking-wider text-muted-foreground uppercase">▸ MONGO_TOP</span>
                {NAV_LINKS.map(({ to, label }) => (
                    <Link
                        key={to}
                        to={to}
                        search={(prev) => prev}
                        className="border-2 border-transparent px-3 py-1 tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
                        activeProps={{ className: "border-primary bg-primary/10 text-primary" }}
                        activeOptions={{ exact: true }}
                    >
                        {label}
                    </Link>
                ))}
            </nav>
            <main className="min-h-0 flex-1 overflow-hidden">
                <Outlet />
            </main>
        </div>
    );
}
