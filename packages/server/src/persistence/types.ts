/**
 * 持久化层 - 领域模型类型定义
 *
 * 与 @vt/data schema 对齐的持久化领域模型
 */

import type { ShipJSON, GameSave, Faction, PlayerRoleValue } from "@vt/data";

// ==================== 基础类型 ====================

/** 时间戳 */
export type Timestamp = number;

/** 实体基类 */
export interface BaseEntity {
	id: string;
	createdAt: Timestamp;
	updatedAt: Timestamp;
}

/** 查询选项 */
export interface QueryOptions {
	limit?: number;
	offset?: number;
	sortBy?: string;
	sortOrder?: "asc" | "desc";
}

/** 分页结果 */
export interface PaginatedResult<T> {
	items: T[];
	total: number;
	limit: number;
	offset: number;
}

// ==================== 用户档案 ====================

/** 用户统计 */
export interface UserStats {
	gamesPlayed: number;
	gamesWon: number;
	gamesLost: number;
	totalDamageDealt: number;
	totalDamageTaken: number;
	totalShipsDestroyed: number;
	totalShipsLost: number;
}

/** 用户偏好设置 */
export interface UserPreferences {
	defaultFaction: Faction;
	showDamageNumbers: boolean;
	showMovementRange: boolean;
	showWeaponRange: boolean;
	uiScale: number;
	language: string;
}

/** 用户档案实体 */
export interface UserProfile extends BaseEntity {
	name: string;
	nickname?: string;
	avatar?: string; // base64 data URL or URL
	role: PlayerRoleValue;
	faction: Faction;
	ready: boolean;
	connected: boolean;
	pingMs: number;
	jitterMs?: number;
	connectionQuality?: string;
	stats: UserStats;
	preferences: UserPreferences;
	shipBuildIds: string[]; // 用户拥有的舰船自定义ID列表
}

// ==================== 舰船自定义 ====================

/** 舰船自定义配置 */
export interface ShipCustomization {
	name?: string;
	description?: string;
	colorScheme?: {
		hull?: string;
		engine?: string;
		weapon?: string;
		shield?: string;
	};
	decals?: string[];
}

/** 舰船构建（自定义舰船） */
export interface ShipBuild extends BaseEntity {
	ownerId: string; // 所属用户ID
	shipJson: ShipJSON; // 基于 @vt/data ShipJSON 的完整舰船数据
	customizations: ShipCustomization;
	isPreset: boolean; // 是否为预设（false = 用户自定义）
	isPublic: boolean; // 是否公开分享
	tags: string[];
	usageCount: number; // 使用次数
}

// ==================== 房间战局存档 ====================

/** 存档元数据 */
export interface RoomArchiveMetadata {
	roomId: string;
	roomName: string;
	mapWidth: number;
	mapHeight: number;
	maxPlayers: number;
	playerCount: number;
	totalTurns: number;
	winnerFaction?: Faction;
	gameDuration: number; // 毫秒
}

/** 房间战局存档 */
export interface RoomArchive extends BaseEntity {
	name: string;
	description?: string;
	saveJson: GameSave; // 基于 @vt/data GameSave 的完整存档数据
	metadata: RoomArchiveMetadata;
	playerIds: string[]; // 参与玩家ID列表
	isAutoSave: boolean; // 是否为自动存档
	tags: string[];
}
