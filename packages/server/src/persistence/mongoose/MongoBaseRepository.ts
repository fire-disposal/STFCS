/**
 * MongoDB Repository 基础实现
 */

import mongoose from "mongoose";
import type { Repository, QueryableRepository } from "../interfaces.js";
import type { QueryOptions, PaginatedResult, BaseEntity } from "../types.js";

export class MongoBaseRepository<T extends BaseEntity> implements Repository<T>, QueryableRepository<T> {
	constructor(private model: mongoose.Model<any>) {}

	async findById(id: string): Promise<T | null> {
		const doc = await this.model.findOne({ id }).lean();
		return doc ?? null;
	}

	async findAll(options?: QueryOptions): Promise<PaginatedResult<T>> {
		let query = this.model.find();

		if (options?.sortBy) {
			const order = options.sortOrder === "desc" ? -1 : 1;
			query = query.sort({ [options.sortBy]: order });
		}

		const total = await this.model.countDocuments();
		const offset = options?.offset ?? 0;
		const limit = options?.limit ?? total;

		const docs = await query.skip(offset).limit(limit).lean();
		return { items: docs as T[], total, limit, offset };
	}

	async create(entity: T): Promise<T> {
		await this.model.create(entity);
		return entity;
	}

	async update(id: string, updates: Partial<T>): Promise<T | null> {
		const doc = await this.model.findOneAndUpdate(
			{ id },
			{ ...updates, updatedAt: Date.now() },
			{ new: true }
		).lean();
		return doc ?? null;
	}

	async delete(id: string): Promise<boolean> {
		const result = await this.model.deleteOne({ id });
		return result.deletedCount > 0;
	}

	async exists(id: string): Promise<boolean> {
		return await this.model.exists({ id }) !== null;
	}

	async findBy(criteria: Partial<T>): Promise<T[]> {
		const docs = await this.model.find(criteria).lean();
		return docs as T[];
	}

	async findOneBy(criteria: Partial<T>): Promise<T | null> {
		const doc = await this.model.findOne(criteria).lean();
		return doc ?? null;
	}

	async clear(): Promise<void> {
		await this.model.deleteMany({});
	}

	async count(): Promise<number> {
		return this.model.countDocuments();
	}
}