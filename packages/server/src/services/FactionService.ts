/**
 * FactionService — 全局自定义派系存储（文件持久化）
 *
 * 存储位置：storage/factions.json
 * 预设派系属于 @vt/data，不在此服务管理范围内。
 */

import { mkdir, writeFile, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { createLogger } from "../infra/simple-logger.js";

const logger = createLogger("faction-service");

interface FactionRecord {
    $id: string;
    name: string;
    color: string;
    flagAssetId?: string | undefined;
    ownerId?: string | undefined;
}

const STORAGE_PATH = join(process.cwd(), "storage", "factions.json");

async function ensureDir(): Promise<void> {
    const dir = join(process.cwd(), "storage");
    if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true });
    }
}

async function readAll(): Promise<Record<string, FactionRecord>> {
    try {
        if (!existsSync(STORAGE_PATH)) return {};
        const raw = await readFile(STORAGE_PATH, "utf-8");
        return JSON.parse(raw) as Record<string, FactionRecord>;
    } catch {
        return {};
    }
}

async function writeAll(map: Record<string, FactionRecord>): Promise<void> {
    await ensureDir();
    await writeFile(STORAGE_PATH, JSON.stringify(map, null, 2), "utf-8");
}

export class FactionService {
    async list(): Promise<FactionRecord[]> {
        const map = await readAll();
        return Object.values(map);
    }

    async get(id: string): Promise<FactionRecord | null> {
        const map = await readAll();
        return map[id] ?? null;
    }

    async create(record: FactionRecord): Promise<void> {
        const map = await readAll();
        if (map[record.$id]) {
            logger.warn(`Faction ${record.$id} already exists, overwriting`);
        }
        map[record.$id] = record;
        await writeAll(map);
        logger.info(`Created faction: ${record.$id} (${record.name})`);
    }

    async delete(id: string): Promise<void> {
        const map = await readAll();
        if (!map[id]) return;
        delete map[id];
        await writeAll(map);
        logger.info(`Deleted faction: ${id}`);
    }
}

export const factionService = new FactionService();
