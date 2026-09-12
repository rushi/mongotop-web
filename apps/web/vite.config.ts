import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import evlog from "evlog/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig({
    server: {
        port: 7000,
        watch: {
            awaitWriteFinish: { stabilityThreshold: Number(process.env.STABILITY_THRESHOLD) || 1000 },
        },
    },
    plugins: [
        // evlog: sets the service name (via the __EVLOG_CONFIG__ define the bundled logger reads),
        // strips log.debug() from prod builds, and injects file:line in dev. Console-only:
        // the bundled `log` prints wide events to the browser console (no transport/ingest).
        // Symbols (log, createEvlogError, parseError) are imported explicitly from "evlog".
        // No `client` option: its injected inline script uses a bare "evlog/client" specifier
        // that the browser can't resolve in dev, and it's redundant — the bundled logger already
        // self-initializes from the define above.
        ...evlog({
            service: "mongotop-web-web",
            strip: ["debug"],
            sourceLocation: "dev",
        }),
        // this is the plugin that enables path aliases
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        TanStackRouterVite(),
        viteReact(),
        tailwindcss(),
    ],
});

export default config;
