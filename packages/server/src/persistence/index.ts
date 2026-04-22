/**
 * 持久化层 - 统一导出
 *
 * 提供 Repository 模式和内存存储实现
 * MongoDB 实现可通过 mongoose 子模块切换
 */

// 类型定义
export type {
	BaseEntity,
	Timestamp,
	QueryOptions,
	PaginatedResult,
	UserStats,
	UserPreferences,
	UserProfile,
	RoomArchiveMetadata,
	RoomArchive,
} from "./types.js";

export type { ShipBuild, WeaponBuild } from "@vt/data";

// 接口
export type { Repository, QueryableRepository, StorageProvider } from "./interfaces.js";

// 内存实现
export {
	MemoryBaseRepository,
	MemoryUserRepository,
	MemoryShipRepository,
	MemoryWeaponRepository,
	MemoryRoomSaveRepository,
} from "./memory/index.js";

// MongoDB 实现
export { connectMongo, disconnectMongo, mongoRepositories, type MongoConfig } from "./mongoose/index.js";

// 管理器
export { PersistenceManager, persistence, type PersistenceType } from "./PersistenceManager.js";
