/**
 * 服务端独有类型定义
 *
 * 枚举和基础类型请直接从 @vt/data 导入：
 *   import { Faction, GamePhase } from "@vt/data";
 *   import type { FactionValue, GamePhaseValue } from "@vt/data";
 *
 * 移动计划从 @vt/rules 导入：
 *   import type { MovementPlan } from "@vt/rules";
 *
 * 本文件只定义服务端独有的：
 * - DTO（服务端响应）
 * - 存档接口
 * - 其他服务端特有类型
 */

import type {
	FactionValue,
	GamePhaseValue,
	MovePhaseValue,
	PlayerRoleValue,
	WeaponStateValue,
	ConnectionQualityValue,
} from "@vt/data";
import type { MovementPlan } from "@vt/rules";

// 重导出 MovementPlan 以保持向后兼容
export type { MovementPlan };

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
	weaponSpecId: string;          // 武器规格 ID
	state: WeaponStateValue;
	cooldownRemaining: number;
	currentAmmo?: number;
	reloadProgress?: number;       // 装填进度
	burstRemaining?: number;       // 连发剩余
	currentTurretAngle?: number;   // 炮塔当前朝向（相对于船体）
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
	shieldOrientation: number;     // 护盾朝向
	armorGrid: number[];
	weapons: WeaponSave[];
	isOverloaded: boolean;
	overloadTime: number;          // 过载剩余时间
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
	description?: string;          // 存档描述
	createdAt: number;
	updatedAt: number;
	version: string;               // 存档版本号
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
	description?: string;
	createdAt: number;
	updatedAt: number;
	turnCount: number;
}

export interface SaveSummary {
	saves: SaveMetadata[];
	total: number;
}

// ==================== 玩家档案接口 ====================

/** 舰船变体配置 */
export interface VariantConfig {
	mountId: string;
	weaponSpecId: string;          // 空字符串 = 不装备
}

/** 自定义舰船变体 */
export interface CustomVariant {
	id: string;                    // 变体唯一 ID
	hullId: string;                // 基础舰船 ID
	name: string;                  // 变体名称
	description?: string;          // 变体描述
	weaponLoadout: VariantConfig[];
	opUsed: number;                // 已用 OP 点数
	createdAt: number;
	updatedAt: number;
	isPublic: boolean;             // 是否公开分享
}

/** 玩家档案 */
export interface PlayerProfile {
	id: string;                    // 档案 ID（关联用户账号）
	displayName: string;           // 显示名称
	customVariants: CustomVariant[];  // 自定义变体列表
	favoriteVariants: string[];    // 收藏的变体 ID
	settings: PlayerSettings;      // 玩家设置
	createdAt: number;
	updatedAt: number;
}

/** 玩家设置 */
export interface PlayerSettings {
	showWeaponArcs: boolean;       // 默认显示武器射界
	showGrid: boolean;             // 显示网格
	coordinatePrecision: "exact" | "rounded10" | "rounded100";
	angleMode: "degrees" | "radians" | "nav";
	theme: "dark" | "light";
}

/** 玩家档案摘要（用于列表显示） */
export interface ProfileSummary {
	id: string;
	displayName: string;
	variantCount: number;
	createdAt: number;
}