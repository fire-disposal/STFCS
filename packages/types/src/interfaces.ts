/**
 * 游戏接口定义
 *
 * 这些接口定义游戏状态的结构，server Schema 类将实现这些接口
 */

import type {
	ConnectionQualityValue,
	DamageTypeValue,
	FactionValue,
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

export interface Point {
	x: number;
	y: number;
}

export interface Transform {
	x: number;
	y: number;
	heading: number;
}

// ==================== 护甲状态 ====================

export interface ArmorState {
	maxPerQuadrant: number;
	quadrants: number[];
}

// ==================== 护盾状态 ====================

export interface ShieldState {
	type: ShieldTypeValue;
	active: boolean;
	orientation: number;
	arc: number;
	radius: number;
}

// ==================== 辐能状态 ====================

export interface FluxState {
	hard: number;
	soft: number;
	max: number;
	dissipation: number;
}

// ==================== 船体状态 ====================

export interface HullState {
	current: number;
	max: number;
}

// ==================== 武器槽位 ====================

export interface WeaponSlot {
	mountId: string;
	weaponSpecId: string;
	name: string;
	category: WeaponCategoryValue;
	damageType: DamageTypeValue;
	mountType: MountTypeValue;

	offsetX: number;
	offsetY: number;
	mountFacing: number;
	arcMin: number;
	arcMax: number;

	damage: number;
	range: number;
	fluxCost: number;

	cooldownMax: number;
	cooldownRemaining: number;

	maxAmmo: number;
	currentAmmo: number;
	reloadTime: number;

	state: WeaponStateValue;
	ignoresShields: boolean;
	hasFiredThisTurn: boolean;
}

// ==================== 武器定义 ====================

export interface WeaponSpec {
	id: string;
	name: string;
	category: WeaponCategoryValue;
	damageType: DamageTypeValue;
	mountType: MountTypeValue;

	damage: number;
	range: number;
	arc: number;
	turnRate: number;

	fluxCost: number;
	ammo: number;
	ammoPerShot: number;

	cooldown: number;
	chargeTime: number;
	burstSize: number;
	burstDelay: number;
}

// ==================== 武器槽位定义 ====================

export interface WeaponMountSpec {
	id: string;
	type: MountTypeValue;
	size: WeaponSlotSizeValue;
	position: Point;
	facing: number;
	arc: number;
	defaultWeapon?: string;
}

// ==================== 船体定义 ====================

export interface ShipHullSpec {
	id: string;
	name: string;
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
	shieldEfficiency: number;
	shieldMaintenanceCost: number;

	maxSpeed: number;
	maxTurnRate: number;
	acceleration: number;

	weaponMounts: WeaponMountSpec[];
}

// ==================== 舰船状态 ====================

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

	weapons: Map<string, WeaponSlot> | Record<string, WeaponSlot>;

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

// ==================== 游戏房间状态 ====================

export interface GameRoomState {
	currentPhase: GamePhaseValue;
	turnCount: number;
	players: Map<string, PlayerState> | Record<string, PlayerState>;
	ships: Map<string, ShipState> | Record<string, ShipState>;
	activeFaction: FactionValue;
	mapWidth: number;
	mapHeight: number;
}
