import { promises as fs } from "fs";
import type { ProcessedQuery } from "@mongotop-web/types";
import dayjs from "dayjs";

export class QueryLoggerService {
    async saveSnapshot(serverId: string, queries: ProcessedQuery[]): Promise<{ raw: string; sanitized: string }> {
        const timestamp = dayjs().format("YYYY-MM-DD-HH-mm-ss");
        const dir = `logs/${serverId}`;

        await this.ensureDirectory(dir);

        const rawFile = `${dir}/queries-raw-${timestamp}.json`;
        const sanitizedFile = `${dir}/queries-sanitized-${timestamp}.json`;

        await Promise.all([
            fs.writeFile(rawFile, JSON.stringify(queries, null, 2)),
            fs.writeFile(
                sanitizedFile,
                JSON.stringify(
                    queries.map((q) => q.query),
                    null,
                    2,
                ),
            ),
        ]);

        return { raw: rawFile, sanitized: sanitizedFile };
    }

    async saveQuery(serverId: string, query: ProcessedQuery, type = "long-running"): Promise<void> {
        const dir = `logs/${serverId}/raw`;
        await this.ensureDirectory(dir);

        const collscanLabel = query.isCollscan ? "-COLLSCAN" : "";
        const filename = `query-${query.opid}-${query.collection}${collscanLabel}-${type}.json`;

        await fs.writeFile(`${dir}/${filename}`, JSON.stringify(query, null, 2));
    }

    async listLogs(serverId: string): Promise<string[]> {
        try {
            const files = await fs.readdir(`logs/${serverId}`);
            return files.filter((f) => f.endsWith(".json"));
        } catch {
            return [];
        }
    }

    async readLog(serverId: string, filename: string): Promise<unknown> {
        const content = await fs.readFile(`logs/${serverId}/${filename}`, "utf-8");
        return JSON.parse(content);
    }

    private async ensureDirectory(dir: string): Promise<void> {
        try {
            await fs.access(dir);
        } catch {
            await fs.mkdir(dir, { recursive: true });
        }
    }
}
