import fs from "fs/promises";
import path from "path";
import type { Repository, QueryableRepository } from "../interfaces.js";
import type { QueryOptions, PaginatedResult, BaseEntity } from "../types.js";

const DATA_DIR = path.resolve(process.cwd(), "data");
const PLAYERS_DIR = path.join(DATA_DIR, "players");

async function ensureDir(dir: string): Promise<void> {
	try {
		await fs.mkdir(dir, { recursive: true });
	} catch {}
}

export abstract class FileBaseRepository<T extends BaseEntity>
	implements Repository<T>, QueryableRepository<T>
{
	protected storage = new Map<string, T>();
	protected dataDir: string;
	protected entityName: string;
	protected initialized = false;

	constructor(entityName: string) {
		this.entityName = entityName;
		this.dataDir = PLAYERS_DIR;
	}

	protected abstract getFileName(entity: T): string;
	protected abstract extractPlayerId(entity: T): string;

	async init(): Promise<void> {
		if (this.initialized) return;
		await ensureDir(this.dataDir);
		await this.loadAll();
		this.initialized = true;
	}

	protected async loadAll(): Promise<void> {
		try {
			const files = await fs.readdir(this.dataDir);
			for (const file of files) {
				if (!file.endsWith(".json")) continue;
				const content = await fs.readFile(path.join(this.dataDir, file), "utf-8");
				const playerData = JSON.parse(content) as Record<string, unknown>;
				const entities = playerData[this.entityName] as T[] | undefined;
				if (entities) {
					for (const entity of entities) {
						this.storage.set(entity.id, entity);
					}
				}
			}
		} catch {}
	}

	protected async savePlayerFile(playerId: string): Promise<void> {
		const entities = Array.from(this.storage.values()).filter(
			(e) => this.extractPlayerId(e) === playerId
		);
		const filePath = path.join(this.dataDir, `${playerId}.json`);
		
		try {
			const existing = await fs.readFile(filePath, "utf-8");
			const data = JSON.parse(existing) as Record<string, unknown>;
			data[this.entityName] = entities;
			await fs.writeFile(filePath, JSON.stringify(data, null, 2));
		} catch {
			const data: Record<string, unknown> = { [this.entityName]: entities };
			await fs.writeFile(filePath, JSON.stringify(data, null, 2));
		}
	}

	async findById(id: string): Promise<T | null> {
		await this.init();
		return this.storage.get(id) || null;
	}

	async findAll(options?: QueryOptions): Promise<PaginatedResult<T>> {
		await this.init();
		let items = Array.from(this.storage.values());

		if (options?.sortBy) {
			const sortKey = options.sortBy as keyof T;
			const order = options.sortOrder === "desc" ? -1 : 1;
			items.sort((a, b) => {
				const aVal = a[sortKey];
				const bVal = b[sortKey];
				if (aVal < bVal) return -1 * order;
				if (aVal > bVal) return 1 * order;
				return 0;
			});
		}

		const total = items.length;
		const offset = options?.offset || 0;
		const limit = options?.limit || total;
		items = items.slice(offset, offset + limit);

		return { items, total, limit, offset };
	}

	async create(entity: T): Promise<T> {
		await this.init();
		this.storage.set(entity.id, entity);
		await this.savePlayerFile(this.extractPlayerId(entity));
		return entity;
	}

	async update(id: string, updates: Partial<T>): Promise<T | null> {
		await this.init();
		const existing = this.storage.get(id);
		if (!existing) return null;

		const updated = { ...existing, ...updates, updatedAt: Date.now() } as T;
		this.storage.set(id, updated);
		await this.savePlayerFile(this.extractPlayerId(updated));
		return updated;
	}

	async delete(id: string): Promise<boolean> {
		await this.init();
		const entity = this.storage.get(id);
		if (!entity) return false;

		const playerId = this.extractPlayerId(entity);
		const result = this.storage.delete(id);
		if (result) {
			await this.savePlayerFile(playerId);
		}
		return result;
	}

	async exists(id: string): Promise<boolean> {
		await this.init();
		return this.storage.has(id);
	}

	async findBy(criteria: Partial<T>): Promise<T[]> {
		await this.init();
		const entries = Array.from(this.storage.values());
		const criteriaEntries = Object.entries(criteria);

		if (criteriaEntries.length === 0) return entries;

		return entries.filter((item) =>
			criteriaEntries.every(([key, value]) => {
				if (value === undefined) return true;
				return item[key as keyof T] === value;
			})
		);
	}

	async findOneBy(criteria: Partial<T>): Promise<T | null> {
		const results = await this.findBy(criteria);
		return results[0] || null;
	}

	clear(): void {
		this.storage.clear();
	}

	count(): number {
		return this.storage.size;
	}
}