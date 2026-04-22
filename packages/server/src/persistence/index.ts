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

export type { Repository, QueryableRepository, StorageProvider } from "./interfaces.js";

export {
	FileBaseRepository,
	FileShipRepository,
	FileWeaponRepository,
	FileRoomSaveRepository,
	FileUserRepository,
} from "./file/index.js";

export { PersistenceManager, persistence } from "./PersistenceManager.js";