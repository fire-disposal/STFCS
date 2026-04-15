/**
 * 存档系统类型定义
 *
 * 包含：
 * - 存档数据结构
 * - 存档元数据
 * - 存档操作接口
 * - 玩家档案数据
 */

import type {
	ChatMessageTypeValue,
	FactionValue,
	GamePhaseValue,
	PlayerRoleValue,
} from "./enums.js";
import type { Transform } from "./interfaces.js";

// ==================== 玩家档案 ====================

/**
 * 玩家档案数据
 * 用于显示和存档保存
 */
export interface PlayerProfile {
	/** 玩家短 ID（6 位数字） */
	shortId: number;
	/** 玩家登录名（唯一标识） */
	name: string;
	/** 玩家昵称（可自定义） */
	nickname: string;
	/** 玩家头像（emoji 或图标 ID） */
	avatar: string;
}

/**
 * 玩家档案（存档用）
 * 包含额外的游戏状态信息
 */
export interface PlayerSave {
	shortId: number;
	name: string;
	nickname: string;
	avatar: string;
	role: PlayerRoleValue;
	isReady: boolean;
}

// ==================== 舰船存档 ====================

export interface WeaponSave {
	mountId: string;
	weaponSpecId: string;
	currentAmmo: number;
	cooldownRemaining: number;
	hasFiredThisTurn: boolean;
}

export interface ShipSave {
	id: string;
	ownerId: string;
	hullType: string;
	faction: FactionValue;
	name: string;
	transform: Transform;
	width: number;
	length: number;
	hull: { current: number; max: number };
	armor: { maxPerQuadrant: number; quadrants: number[] };
	flux: { hard: number; soft: number; max: number; dissipation: number };
	shield: { type: string; active: boolean; orientation: number; arc: number; radius: number };
	isOverloaded: boolean;
	isDestroyed: boolean;
	hasMoved: boolean;
	hasFired: boolean;
	movePhaseAX: number;
	movePhaseAStrafe: number;
	movePhaseCX: number;
	movePhaseCStrafe: number;
	turnAngle: number;
	weapons: WeaponSave[];
}

// ==================== 聊天消息存档 ====================

export interface ChatMessageSave {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: ChatMessageTypeValue;
}

// ==================== 存档数据 ====================

/**
 * 完整游戏存档
 * 用于保存和加载游戏状态
 */
export interface GameSave {
	/** 存档唯一 ID */
	saveId: string;
	/** 存档显示名称 */
	saveName: string;
	/** 游戏版本（用于兼容性检查） */
	version: string;
	/** 创建时间戳 */
	createdAt: number;
	/** 最后更新时间戳 */
	updatedAt: number;
	/** 原始房间 ID */
	roomId: string;
	/** 原始房间名称 */
	roomName: string;
	/** 最大玩家数 */
	maxPlayers: number;
	/** 是否私有房间 */
	isPrivate: boolean;
	/** 当前游戏阶段 */
	currentPhase: GamePhaseValue;
	/** 回合数 */
	turnCount: number;
	/** 当前行动阵营 */
	activeFaction: FactionValue;
	/** 玩家列表 */
	players: PlayerSave[];
	/** 舰船列表 */
	ships: ShipSave[];
	/** 聊天历史 */
	chatHistory: ChatMessageSave[];
}

// ==================== 存档元数据 ====================

/**
 * 存档摘要信息
 * 用于存档列表显示
 */
export interface SaveSummary {
	/** 存档唯一 ID */
	saveId: string;
	/** 存档显示名称 */
	saveName: string;
	/** 原始房间名称 */
	roomName: string;
	/** 玩家数量 */
	playerCount: number;
	/** 舰船数量 */
	shipCount: number;
	/** 回合数 */
	turnCount: number;
	/** 当前游戏阶段 */
	currentPhase: GamePhaseValue;
	/** 创建时间戳 */
	createdAt: number;
	/** 最后更新时间戳 */
	updatedAt: number;
	/** 文件大小（字节） */
	fileSize: number;
}

/**
 * 存档元数据（内部使用）
 * 包含额外的管理信息
 */
export interface SaveMetadata extends SaveSummary {
	/** 存档文件路径 */
	filePath?: string;
	/** 存档格式版本 */
	formatVersion: string;
	/** 校验和（用于验证完整性） */
	checksum?: string;
}

// ==================== 存档操作 ====================

/**
 * 存档存储接口
 * 实现存档的 CRUD 操作
 */
export interface SaveStore {
	/** 保存游戏 */
	save(data: GameSave): Promise<void>;
	/** 加载完整存档 */
	load(id: string): Promise<GameSave>;
	/** 删除存档 */
	delete(id: string): Promise<void>;
	/** 获取存档列表 */
	list(): Promise<SaveSummary[]>;
	/** 检查存档是否存在 */
	exists(id: string): Promise<boolean>;
	/** 获取存档摘要 */
	getSummary(id: string): Promise<SaveSummary>;
}

// ==================== 存档 WebSocket 消息 ====================

/**
 * 请求存档列表
 */
export interface SaveListRequest {
	type: "SAVE_LIST_REQUEST";
}

/**
 * 存档列表响应
 */
export interface SaveListResponse {
	saves: SaveSummary[];
}

/**
 * 保存游戏请求
 */
export interface SaveGameRequest {
	type: "SAVE_GAME_REQUEST";
	save: GameSave;
}

/**
 * 保存游戏响应
 */
export interface SaveGameResponse {
	success: boolean;
	saveId?: string;
	message?: string;
}

/**
 * 加载游戏请求
 */
export interface SaveLoadRequest {
	type: "SAVE_LOAD_REQUEST";
	saveId: string;
}

/**
 * 加载游戏响应
 */
export interface SaveLoadResponse {
	save: GameSave;
}

/**
 * 删除存档请求
 */
export interface SaveDeleteRequest {
	type: "SAVE_DELETE_REQUEST";
	saveId: string;
}

/**
 * 删除存档响应
 */
export interface SaveDeleteResponse {
	success: boolean;
	message?: string;
}

/**
 * 导出存档请求
 */
export interface SaveExportRequest {
	type: "SAVE_EXPORT_REQUEST";
	saveId: string;
}

/**
 * 导出存档响应
 */
export interface SaveExportResponse {
	success: boolean;
	save: GameSave;
}

/**
 * 导入存档请求
 */
export interface SaveImportRequest {
	type: "SAVE_IMPORT_REQUEST";
	save: GameSave;
}

/**
 * 导入存档响应
 */
export interface SaveImportResponse {
	success: boolean;
	saveId: string;
	message?: string;
}

// ==================== 玩家档案 WebSocket 消息 ====================

/**
 * 更新玩家档案请求
 */
export interface PlayerProfileUpdateRequest {
	type: "PLAYER_PROFILE_UPDATE_REQUEST";
	profile: {
		nickname: string;
		avatar: string;
	};
}

/**
 * 玩家档案变更广播
 */
export interface PlayerProfileUpdateBroadcast {
	type: "PLAYER_PROFILE_UPDATED";
	shortId: number;
	profile: {
		nickname: string;
		avatar: string;
	};
}

/**
 * 获取玩家档案列表请求（用于房间）
 */
export interface PlayerProfileListRequest {
	type: "PLAYER_PROFILE_LIST_REQUEST";
}

/**
 * 玩家档案列表响应
 */
export interface PlayerProfileListResponse {
	profiles: Array<{
		shortId: number;
		nickname: string;
		avatar: string;
	}>;
}

// ==================== 类型导出 ====================

// 存档消息联合类型
export type SaveMessage =
	| SaveListRequest
	| SaveGameRequest
	| SaveLoadRequest
	| SaveDeleteRequest
	| SaveExportRequest
	| SaveImportRequest;

// 存档响应联合类型
export type SaveResponse =
	| SaveListResponse
	| SaveGameResponse
	| SaveLoadResponse
	| SaveDeleteResponse
	| SaveExportResponse
	| SaveImportResponse;

// 玩家档案消息联合类型
export type PlayerProfileMessage =
	| PlayerProfileUpdateRequest
	| PlayerProfileUpdateBroadcast
	| PlayerProfileListRequest
	| PlayerProfileListResponse;
