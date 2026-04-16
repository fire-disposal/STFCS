/**
 * 服务端类型定义
 *
 * 枚举从 @vt/data 导入（唯一来源）
 * 本文件只定义服务端独有类型：
 * - DTO（服务端响应）
 * - 存档接口
 * - Schema 辅助类型
 */

// ==================== 从 @vt/data 导入枚举（唯一来源）====================

import {
	// 武器相关
	DamageType,
	WeaponCategory,
	MountType,
	WeaponState,
	WeaponSlotSize,
	ShieldType,
	FluxState,

	// 舰船相关
	HullSize,
	ShipClass,
	ArmorQuadrant,
	ARMOR_QUADRANTS,

	// 游戏状态
	Faction,
	PlayerRole,
	GamePhase,
	TurnPhase,
	MovePhase,
	FactionTurnPhase,
	ConnectionQuality,

	// Token/命令
	TokenType,
	TokenTurnState,
	ClientCommand,

	// 基础类型
	Point,
} from "@vt/data";

import type {
	DamageTypeValue,
	WeaponCategoryValue,
	MountTypeValue,
	WeaponStateValue,
	WeaponSlotSizeValue,
	ShieldTypeValue,
	FluxStateValue,
	HullSizeValue,
	ShipClassValue,
	ArmorQuadrantValue,
	FactionValue,
	PlayerRoleValue,
	GamePhaseValue,
	TurnPhaseValue,
	MovePhaseValue,
	FactionTurnPhaseValue,
	ConnectionQualityValue,
	TokenTypeValue,
	TokenTurnStateValue,
	ClientCommandValue,
} from "@vt/data";

// 重新导出供其他模块使用（值）
export {
	DamageType,
	WeaponCategory,
	MountType,
	WeaponState,
	WeaponSlotSize,
	ShieldType,
	FluxState,
	HullSize,
	ShipClass,
	ArmorQuadrant,
	ARMOR_QUADRANTS,
	Faction,
	PlayerRole,
	GamePhase,
	TurnPhase,
	MovePhase,
	FactionTurnPhase,
	ConnectionQuality,
	TokenType,
	TokenTurnState,
	ClientCommand,
};

// 重新导出类型（interface 和 type alias）
export type {
	Point,
	DamageTypeValue,
	WeaponCategoryValue,
	MountTypeValue,
	WeaponStateValue,
	WeaponSlotSizeValue,
	ShieldTypeValue,
	FluxStateValue,
	HullSizeValue,
	ShipClassValue,
	ArmorQuadrantValue,
	FactionValue,
	PlayerRoleValue,
	GamePhaseValue,
	TurnPhaseValue,
	MovePhaseValue,
	FactionTurnPhaseValue,
	ConnectionQualityValue,
	TokenTypeValue,
	TokenTurnStateValue,
	ClientCommandValue,
};

// ==================== 服务端独有类型 ====================

/** 移动计划（不在 @vt/data） */
export interface MovementPlan {
	phaseAForward: number;
	phaseAStrafe: number;
	turnAngle: number;
	phaseCForward: number;
	phaseCStrafe: number;
}

// ==================== DTO 类型（服务端响应）====================

/** 错误响应 */
export interface ErrorDTO {
	message: string;
}

/** 玩家角色响应 */
export interface RoleDTO {
	role: PlayerRoleValue;
}

/** 玩家身份响应 */
export interface IdentityDTO {
	userName: string;
	shortId: number;
}

/** 游戏保存成功响应 */
export interface GameSavedDTO {
	saveId: string;
	saveName: string;
}

/** 游戏加载成功响应 */
export interface GameLoadedDTO {
	saveId: string;
	saveName: string;
}

/** 游戏阶段切换响应 */
export interface PhaseChangeDTO {
	phase: GamePhaseValue;
	turnCount: number;
}

/** 被踢出房间响应 */
export interface RoomKickedDTO {
	reason: string;
}

/** 舰船创建响应 */
export interface ShipCreatedDTO {
	shipId: string;
	hullType: string;
	x: number;
	y: number;
}

/** 房间元数据 */
export interface RoomMetadata {
	roomType: string;
	name: string;
	phase: string;
	ownerId: string | null;
	ownerShortId: number | null;
	maxPlayers: number;
	isPrivate: boolean;
	createdAt: number;
	turnCount?: number;
}

/** 房间列表项 */
export interface RoomListItemDTO {
	roomId: string;
	name: string;
	clients: number;
	maxClients: number;
	roomType: string;
	metadata: RoomMetadata;
}

/** 健康检查响应 */
export interface HealthStatusDTO {
	status: "ok" | "error";
	uptimeSec: number;
}

/** 网络心跳响应 */
export interface NetPongPayload {
	seq: number;
	serverTime: number;
	pingMs: number;
	jitterMs: number;
	quality: ConnectionQualityValue;
}

// ==================== 存档接口 ====================

export interface WeaponSave {
	mountId: string;
	instanceId: string;
	state: WeaponStateValue;
	cooldownRemaining: number;
	currentAmmo?: number;
}

export interface ShipSave {
	id: string;
	hullId: string;
	name: string;
	faction: FactionValue;
	ownerId: string;
	x: number;
	y: number;
	heading: number;
	hullCurrent: number;
	hullMax: number;
	fluxHard: number;
	fluxSoft: number;
	fluxMax: number;
	shieldActive: boolean;
	shieldCurrent: number;
	shieldMax: number;
	armorGrid: number[];
	weapons: WeaponSave[];
	isOverloaded: boolean;
	hasMoved: boolean;
	hasFired: boolean;
	movePhase: MovePhaseValue;
	phaseAForwardUsed: number;
	phaseAStrafeUsed: number;
	phaseTurnUsed: number;
	phaseCForwardUsed: number;
	phaseCStrafeUsed: number;
}

export interface GameSave {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	turnCount: number;
	currentPhase: GamePhaseValue;
	activeFaction: FactionValue;
	ships: ShipSave[];
	mapWidth: number;
	mapHeight: number;
}

export interface SaveMetadata {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	turnCount: number;
}

export interface SaveSummary {
	saves: SaveMetadata[];
	total: number;
}

// ==================== Schema 容器类型辅助 ====================

export interface SchemaMap<T> {
	get(key: string): T | undefined;
	set(key: string, value: T): void;
	has(key: string): boolean;
	delete(key: string): boolean;
	clear(): void;
	forEach(cb: (value: T, key: string) => void): void;
	entries(): IterableIterator<[string, T]>;
	keys(): IterableIterator<string>;
	values(): IterableIterator<T>;
	size: number;
}

export interface SchemaArray<T> {
	length: number;
	[index: number]: T;
	push(...items: T[]): number;
	pop(): T | undefined;
	forEach(cb: (value: T, index: number) => void): void;
	at(index: number): T | undefined;
}