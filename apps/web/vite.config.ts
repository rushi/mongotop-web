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
        // evlog: sets the service name, strips log.debug() from prod builds, injects file:line in
        // dev; console-only (no transport/ingest). No `client` option: its inline script uses a
        // bare "evlog/client" specifier the browser can't resolve in dev, and the bundled logger
        // already self-initializes from the define above.
        ...evlog({
            service: "mongotop-web-web",
            strip: ["debug"],
            sourceLocation: "dev",
        }),
        viteTsConfigPaths({
            projects: ["./tsconfig.json"],
        }),
        TanStackRouterVite(),
        viteReact(),
        tailwindcss(),
    ],
});

export default config;
