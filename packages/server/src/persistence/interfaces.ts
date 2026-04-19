/**
 * 持久化层 - Repository 接口定义
 *
 * 采用 Repository 模式，抽象数据访问，未来可无缝切换 MongoDB
 */

import type { QueryOptions, PaginatedResult } from "./types.js";

/**
 * 基础 Repository 接口
 *
 * @template T - 实体类型
 * @template ID - ID 类型（默认 string）
 */
export interface Repository<T, ID = string> {
	/** 根据 ID 查找 */
	findById(id: ID): Promise<T | null>;

	/** 查找所有（支持分页） */
	findAll(options?: QueryOptions): Promise<PaginatedResult<T>>;

	/** 创建实体 */
	create(entity: T): Promise<T>;

	/** 更新实体 */
	update(id: ID, updates: Partial<T>): Promise<T | null>;

	/** 删除实体 */
	delete(id: ID): Promise<boolean>;

	/** 检查是否存在 */
	exists(id: ID): Promise<boolean>;
}

/**
 * 支持查询的 Repository 接口
 */
export interface QueryableRepository<T, ID = string> extends Repository<T, ID> {
	/** 条件查询 */
	findBy(criteria: Partial<T>): Promise<T[]>;

	/** 查找单个（条件） */
	findOneBy(criteria: Partial<T>): Promise<T | null>;
}

/**
 * 存储提供者接口（用于切换存储后端）
 */
export interface StorageProvider {
	/** 连接存储 */
	connect(): Promise<void>;

	/** 断开连接 */
	disconnect(): Promise<void>;

	/** 是否已连接 */
	isConnected(): boolean;
}
