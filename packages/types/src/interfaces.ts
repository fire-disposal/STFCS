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

// ==================== 基础类型 ====================

export interface SchemaMap<T> {
	get(key: string): T | undefined;
	set(key: string, value: T): unknown;
	forEach(callback: (value: T, key: string) => void): void;
}

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
	movePhaseAX: number;
	movePhaseAStrafe: number;
	movePhaseBX: number;
	movePhaseBStrafe: number;
	turnAngle: number;
	movePhase: "PHASE_A" | "PHASE_B" | "PHASE_C";
	phaseAForwardUsed: number;
	phaseAStrafeUsed: number;
	phaseTurnUsed: number;
	phaseBForwardUsed: number;
	phaseBStrafeUsed: number;
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

export interface RoomMetadata {
	roomType: string;
	name: string;
	phase: string;
	ownerId: string | null;
	ownerShortId: number | null;
	maxPlayers: number;
	isPrivate: boolean;
	createdAt: number;
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

// ==================== 类型别名（兼容旧代码） ====================

export type ArmorInstanceState = ArmorState;
export type FluxInstanceState = FluxState;
export type ShieldInstanceState = ShieldState;
export type HullInstanceState = HullState;
export type WeaponInstanceState = WeaponSlot;
export type FactionId = FactionValue;

// ==================== 相机状态 ====================

export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	followingShipId?: string;
}

export interface PlayerCamera {
	id: string;
	ownerId: string;
	x: number;
	y: number;
	zoom: number;
}

// ==================== Token 信息 ====================

export const TokenType = {
	SHIP: "SHIP",
	STATION: "STATION",
	ASTEROID: "ASTEROID",
} as const;

export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];

export interface TokenInfo {
	id: string;
	type: TokenTypeValue;
	x: number;
	y: number;
	heading: number;
	name: string;
	size: number;
	metadata?: Record<string, unknown>;
	faction?: FactionValue;
	position: Point;
}

export interface ShipTokenV2Visual {
	collisionRadius: number;
}

export interface ShipTokenV2Shield {
	type: string;
	radius: number;
	coverageAngle: number;
	active: boolean;
	efficiency: number;
}

export interface ShipTokenV2Flux {
	current: number;
	capacity: number;
	softFlux: number;
	hardFlux: number;
	state: string;
}

export interface ShipTokenV2Weapons {
	mounts: Record<string, { position: Point; facing: number; arc: number }>;
}

export interface ShipTokenV2 {
	id: string;
	factionId: FactionValue;
	faction: FactionValue;
	name: string;
	shipName: string;
	hullType: string;
	hullSize: HullSizeValue;
	x: number;
	y: number;
	heading: number;
	position: Point;
	isEnemy: boolean;
	hull: HullState;
	armor: ArmorState;
	shield: ShipTokenV2Shield;
	flux: ShipTokenV2Flux;
	visual: ShipTokenV2Visual;
	weapons: ShipTokenV2Weapons;
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
