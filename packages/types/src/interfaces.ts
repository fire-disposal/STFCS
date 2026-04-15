/**
 * 游戏接口定义
 *
 * 唯一的数据结构定义来源
 * server Schema 实现这些接口，data 使用这些接口
 */

import type {
	ChatMessageTypeValue,
	ConnectionQualityValue,
	DamageTypeValue,
	FactionValue,
	FluxStateValue,
	GamePhaseValue,
	HullSizeValue,
	MountTypeValue,
	PlayerRoleValue,
	ShieldTypeValue,
	ShipClassValue,
	WeaponCategoryValue,
	WeaponSlotSizeValue,
	WeaponStateValue,
} from "./enums.js";
import type { MovePhaseValue } from "./movement.js";

// ==================== 基础类型 ====================

/**
 * Colyseus Schema Map 接口
 * 用于描述 @colyseus/schema 的 MapSchema 类型
 */
export interface SchemaMap<T> {
	get(key: string): T | undefined;
	set(key: string, value: T): unknown;
	forEach(callback: (value: T, key: string) => void): void;
}

/**
 * Colyseus Schema Array 接口
 * 用于描述 @colyseus/schema 的 ArraySchema 类型
 */
export interface SchemaArray<T> {
	length: number;
	[index: number]: T;
	push(...items: T[]): number;
	forEach(callback: (value: T, index: number) => void): void;
}

export interface Point {
	x: number;
	y: number;
}

export interface Transform {
	x: number;
	y: number;
	heading: number;
}

// ==================== 状态接口（运行时） ====================

export interface HullState {
	current: number;
	max: number;
	percent: number;
}

export interface ArmorState {
	maxPerQuadrant: number;
	quadrants: SchemaArray<number>;
}

export interface ShieldState {
	type: ShieldTypeValue;
	active: boolean;
	orientation: number;
	arc: number;
	coverageAngle: number;
	radius: number;
	efficiency: number;
	current: number;
	max: number;
}

export interface FluxState {
	hard: number;
	hardFlux: number;
	soft: number;
	softFlux: number;
	max: number;
	capacity: number;
	dissipation: number;
	total: number;
	percent: number;
	state: FluxStateValue;
	isOverloaded: boolean;
}

// ==================== 武器槽位（运行时） ====================

export interface WeaponSlot {
	mountId: string;
	mountOffsetX?: number;
	mountOffsetY?: number;
	weaponSpecId: string;
	instanceId: string;
	name: string;
	category: WeaponCategoryValue;
	damageType: DamageTypeValue;
	mountType: MountTypeValue;
	mountFacing: number;
	arcMin: number;
	arcMax: number;
	arc: number;
	damage: number;
	baseDamage: number;
	range: number;
	fluxCost: number;
	fluxCostPerShot: number;
	cooldownMax: number;
	cooldownRemaining: number;
	maxAmmo: number;
	currentAmmo: number;
	reloadTime: number;
	state: WeaponStateValue;
	hasFiredThisTurn: boolean;
	ignoresShields: boolean;
}

// ==================== 舰船状态（运行时） ====================

export interface ShipState {
	id: string;
	ownerId: string;
	faction: FactionValue;
	hullType: string;
	name: string;
	width: number;
	length: number;
	transform: Transform;
	hull: HullState;
	armor: ArmorState;
	shield: ShieldState;
	flux: FluxState;
	weapons: SchemaMap<WeaponSlot>;
	maxSpeed: number;
	maxTurnRate: number;
	isOverloaded: boolean;
	overloadTime: number;
	isDestroyed: boolean;
	hasMoved: boolean;
	hasFired: boolean;
	// ==================== 三阶段移动系统 ====================
	/** 当前移动阶段 */
	movePhase: MovePhaseValue;
	/** Phase A 前进/后退距离 */
	movePhaseAX: number;
	/** Phase A 侧移距离 */
	movePhaseAStrafe: number;
	/** Phase B 转向角度 */
	turnAngle: number;
	/** Phase C 前进/后退距离 */
	movePhaseCX: number;
	/** Phase C 侧移距离 */
	movePhaseCStrafe: number;
}

// ==================== 玩家状态 ====================

export interface PlayerState {
	sessionId: string;
	shortId: number;
	role: PlayerRoleValue;
	name: string;
	nickname: string;
	avatar: string;
	isReady: boolean;
	connected: boolean;
	pingMs: number;
	jitterMs: number;
	connectionQuality: ConnectionQualityValue;
}

// ==================== 聊天消息 ====================

export interface ChatMessage {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: ChatMessageTypeValue;
}

// ==================== 游戏房间状态 ====================

export interface GameRoomState {
	currentPhase: GamePhaseValue;
	turnCount: number;
	activeFaction: FactionValue;
	mapWidth: number;
	mapHeight: number;
	players: SchemaMap<PlayerState>;
	ships: SchemaMap<ShipState>;
	chatMessages: SchemaArray<ChatMessage>;
}

// ==================== 房间元数据 ====================

/**
 * 房间元数据接口
 * 用于大厅房间列表显示和房间状态同步
 */
export interface RoomMetadata {
	roomType: string;      // 房间类型：battle
	name: string;          // 房间名称
	phase: string;         // 当前阶段：lobby, deployment, action, etc.
	ownerId: string | null;        // 房主会话 ID
	ownerShortId: number | null;   // 房主短 ID（显示用）
	maxPlayers: number;    // 最大玩家数
	isPrivate: boolean;    // 是否私有房间
	createdAt: number;     // 创建时间戳
	turnCount?: number;    // 当前回合数（可选，仅战斗阶段）
}

// ==================== DTO（传输对象） ====================

export interface RoomListItemDTO {
	roomId: string;
	name: string;
	clients: number;
	maxClients: number;
	roomType: string;
	metadata: RoomMetadata;
}

export interface HealthStatusDTO {
	status: "ok";
	uptimeSec: number;
}

export interface ErrorDTO {
	message: string;
}

export interface RoleDTO {
	role: PlayerRoleValue;
}

export interface IdentityDTO {
	userName: string;
	shortId: number;
}

export interface GameSavedDTO {
	saveId: string;
	saveName: string;
}

export interface GameLoadedDTO {
	saveId: string;
	saveName: string;
}

export interface ShipCreatedDTO {
	shipId: string;
	hullType: string;
	x: number;
	y: number;
}

export interface PhaseChangeDTO {
	phase: GamePhaseValue;
	turnCount: number;
}

export interface RoomKickedDTO {
	reason: string;
}

// ==================== 定义接口（静态数据） ====================

export interface WeaponSpec {
	id: string;
	name: string;
	category: WeaponCategoryValue;
	damageType: DamageTypeValue;
	mountType: MountTypeValue;
	damage: number;
	range: number;
	arc: number;
	cooldown: number;
	fluxCost: number;
	ammo: number;
	reloadTime: number;
	ignoresShields: boolean;
}

export interface WeaponMountSpec {
	id: string;
	type: MountTypeValue;
	size: WeaponSlotSizeValue;
	position: Point;
	facing: number;
	arc: number;
	defaultWeapon?: string;
}

export interface ShipHullSpec {
	id: string;
	name: string;
	description?: string;
	size: HullSizeValue;
	class: ShipClassValue;
	width: number;
	length: number;
	hitPoints: number;
	armorMax: number;
	fluxCapacity: number;
	fluxDissipation: number;
	hasShield: boolean;
	shieldType: ShieldTypeValue;
	shieldArc: number;
	shieldRadius: number;
	maxSpeed: number;
	maxTurnRate: number;
	weaponMounts: WeaponMountSpec[];
	hullPoints: number;
	armorValue: number;
}

// ==================== 类型别名（已废弃，直接使用原类型） ====================

/** @deprecated 直接使用 `ArmorState` */
export type ArmorInstanceState = ArmorState;
/** @deprecated 直接使用 `FluxState` */
export type FluxInstanceState = FluxState;
/** @deprecated 直接使用 `ShieldState` */
export type ShieldInstanceState = ShieldState;
/** @deprecated 直接使用 `WeaponSlot` */
export type WeaponInstanceState = WeaponSlot;
/** @deprecated 直接使用 `FactionValue` */
export type FactionId = FactionValue;

// ==================== 相机状态 ====================

/**
 * 通用相机状态接口
 * 用于本地玩家和其他玩家的相机状态
 * 
 * 字段说明：
 * - x/y: 相机中心点的世界坐标
 * - zoom: 缩放级别（0.3 ~ 6.0）
 * - viewRotation: 视图旋转角度（度数，0=北向朝上）
 * - followingShipId: 可选，跟随的舰船 ID
 */
export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	viewRotation: number;
	followingShipId?: string;
}

/**
 * 其他玩家相机状态
 * 用于在地图上显示其他玩家的相机位置和视野
 * 
 * 字段说明：
 * - playerId: 玩家会话 ID
 * - playerName: 玩家显示名称
 * - x/y: 相机中心点的世界坐标
 * - zoom: 缩放级别
 * - viewRotation: 视图旋转角度
 * - followingShipId: 可选，跟随的舰船 ID
 */
export interface PlayerCamera {
	playerId: string;
	playerName: string;
	x: number;
	y: number;
	zoom: number;
	viewRotation: number;
	followingShipId?: string;
}

// ==================== Token 信息（统一类型定义） ====================

export const TokenType = {
	SHIP: "ship",
	STATION: "station",
	ASTEROID: "asteroid",
} as const;

export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];

/**
 * Token 回合状态
 */
export type TokenTurnState = "waiting" | "active" | "done";

/**
 * Token 信息 - 统一类型定义
 * 用于地图上所有可交互对象（舰船、空间站、小行星等）
 */
export interface TokenInfo {
	/** Token 唯一标识 */
	id: string;
	/** Token 类型 */
	type: TokenTypeValue;
	/** 世界坐标 X */
	x: number;
	/** 世界坐标 Y */
	y: number;
	/** 朝向角度（度数） */
	heading: number;
	/** 显示名称 */
	name: string;
	/** 显示尺寸 */
	size: number;
	/** 缩放比例 */
	scale: number;
	/** 所属者 ID */
	ownerId: string;
	/** 阵营 */
	faction?: FactionValue;
	/** 位置（冗余字段，兼容旧代码） */
	position: Point;
	/** 碰撞半径 */
	collisionRadius: number;
	/** 渲染层级 */
	layer: number;
	/** 元数据（扩展字段） */
	metadata?: Record<string, unknown>;
	// ==================== 回合制状态 ====================
	/** 当前回合状态 */
	turnState: TokenTurnState;
	/** 每回合最大移动距离 */
	maxMovement: number;
	/** 剩余移动距离 */
	remainingMovement: number;
	/** 每回合行动点数 */
	actionsPerTurn: number;
	/** 剩余行动点数 */
	remainingActions: number;
}

// ==================== 定义类型 ====================

export interface HullDefinition {
	id: string;
	name: string;
	size: HullSizeValue;
	hitPoints: number;
	armorValue: number;
	fluxCapacity: number;
	fluxDissipation: number;
	sprite?: string;
	spriteScale?: number;
	collisionRadius?: number;
}

export interface ShipDefinition {
	id: string;
	name: string;
	hullId: string;
	faction?: FactionValue;
	cost?: number;
	nameLocalized?: { zh?: string; en?: string };
	variant?: string;
	weaponLoadout: Record<string, string>;
}

export interface WeaponDefinition {
	id: string;
	name: string;
	type: WeaponCategoryValue;
	damage: number;
	range: number;
}

export interface AssetManifest {
	hulls: Record<string, HullDefinition>;
	ships: Record<string, ShipDefinition>;
	weapons: Record<string, WeaponDefinition>;
}

// ==================== 战斗结果 ====================

export interface AttackPreviewDetails {
	baseDamage: number;
	estimatedShieldAbsorb: number;
	estimatedArmorReduction: number;
	estimatedHullDamage: number;
	hitQuadrant: string;
	fluxCost: number;
	willGenerateHardFlux: boolean;
}

export interface AttackPreviewResult {
	attackerId: string;
	weaponId: string;
	targetId: string;
	canAttack: boolean;
	preview: AttackPreviewDetails | null;
	blockReason: string | null;
	expectedDamage: number;
	hitChance: number;
	armorDamage: number;
	hullDamage: number;
}

export interface CombatResult {
	attackerId: string;
	targetId: string;
	weaponId: string;
	damage: number;
	armorDamage: number;
	hullDamage: number;
	shieldDamage: number;
	fluxGenerated: number;
	isHit: boolean;
	isCritical: boolean;
}

export interface ExplosionData {
	x: number;
	y: number;
	size: number;
	duration: number;
}

export interface AttackCommand {
	attackerId: string;
	weaponId: string;
	targetId: string;
}

// ==================== 阵营回合 ====================

export const FactionTurnPhase = {
	DRAW: "DRAW",
	PLAY: "PLAY",
	END: "END",
} as const;

export type FactionTurnPhaseValue = (typeof FactionTurnPhase)[keyof typeof FactionTurnPhase];

export interface FactionTurnState {
	factionOrder: FactionValue[];
	currentFactionIndex: number;
	currentFaction: FactionValue;
	phase: FactionTurnPhaseValue;
	roundNumber: number;
	playerEndStatus: Record<string, boolean>;
}

export interface PlayerFactionInfo {
	sessionId: string;
	factionId: FactionValue;
	isReady: boolean;
}

// ==================== 武器挂载实例 ====================

export interface WeaponMountInstance {
	id: string;
	weaponSlotId: string;
	position: Point;
	facing: number;
	arc: number;
}
