/**
 * 内存存储 - 基础 Repository 实现
 */

import type { Repository, QueryableRepository } from "../interfaces.js";
import type { QueryOptions, PaginatedResult, BaseEntity } from "../types.js";

/**
 * 内存基础 Repository
 *
 * 提供通用的 CRUD 操作，具体 Repository 可继承扩展
 */
export class MemoryBaseRepository<T extends BaseEntity>
	implements Repository<T>, QueryableRepository<T>
{
	protected storage = new Map<string, T>();

	async findById(id: string): Promise<T | null> {
		return this.storage.get(id) || null;
	}

	async findAll(options?: QueryOptions): Promise<PaginatedResult<T>> {
		let items = Array.from(this.storage.values());

		// 排序
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
		this.storage.set(entity.id, entity);
		return entity;
	}

	async update(id: string, updates: Partial<T>): Promise<T | null> {
		const existing = this.storage.get(id);
		if (!existing) return null;

		const updated = { ...existing, ...updates, updatedAt: Date.now() } as T;
		this.storage.set(id, updated);
		return updated;
	}

	async delete(id: string): Promise<boolean> {
		return this.storage.delete(id);
	}

	async exists(id: string): Promise<boolean> {
		return this.storage.has(id);
	}

	async findBy(criteria: Partial<T>): Promise<T[]> {
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

	/** 清空存储 */
	clear(): void {
		this.storage.clear();
	}

	/** 获取数量 */
	count(): number {
		return this.storage.size;
	}
}
