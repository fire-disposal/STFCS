/**
 * 持久化层 - 统一导出
 *
 * 提供 Repository 模式和内存存储实现
 * 未来可无缝切换 MongoDB 等外部存储
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
	ShipCustomization,
	ShipBuild,
	RoomArchiveMetadata,
	RoomArchive,
} from "./types.js";

// 接口
export type { Repository, QueryableRepository, StorageProvider } from "./interfaces.js";

// 内存实现
export {
	MemoryBaseRepository,
	MemoryUserRepository,
	MemoryShipRepository,
	MemoryRoomSaveRepository,
} from "./memory/index.js";

// 管理器
export { PersistenceManager } from "./PersistenceManager.js";
