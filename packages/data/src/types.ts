/**
 * @vt/data 独立类型定义
 *
 * 静态数据包的类型定义，不依赖任何外部包
 */

// ==================== 枚举常量 ====================

export const DamageType = {
	KINETIC: "KINETIC",
	HIGH_EXPLOSIVE: "HIGH_EXPLOSIVE",
	ENERGY: "ENERGY",
	FRAGMENTATION: "FRAGMENTATION",
} as const;

export type DamageTypeValue = (typeof DamageType)[keyof typeof DamageType];

export const WeaponCategory = {
	BALLISTIC: "BALLISTIC",
	ENERGY: "ENERGY",
	MISSILE: "MISSILE",
	SYNERGY: "SYNERGY",
} as const;

export type WeaponCategoryValue =
	(typeof WeaponCategory)[keyof typeof WeaponCategory];

export const MountType = {
	FIXED: "FIXED",
	TURRET: "TURRET",
	HIDDEN: "HIDDEN",
} as const;

export type MountTypeValue = (typeof MountType)[keyof typeof MountType];

export const WeaponSlotSize = {
	SMALL: "SMALL",
	MEDIUM: "MEDIUM",
	LARGE: "LARGE",
} as const;

export type WeaponSlotSizeValue =
	(typeof WeaponSlotSize)[keyof typeof WeaponSlotSize];

export const ShieldType = {
	FRONT: "FRONT",
	OMNI: "OMNI",
	NONE: "NONE",
} as const;

export type ShieldTypeValue = (typeof ShieldType)[keyof typeof ShieldType];

export const HullSize = {
	FIGHTER: "FIGHTER",
	FRIGATE: "FRIGATE",
	DESTROYER: "DESTROYER",
	CRUISER: "CRUISER",
	CAPITAL: "CAPITAL",
} as const;

export type HullSizeValue = (typeof HullSize)[keyof typeof HullSize];

export const ShipClass = {
	STRIKE: "STRIKE",
	ASSAULT: "ASSAULT",
	COMBAT: "COMBAT",
	SUPPORT: "SUPPORT",
	HEAVY: "HEAVY",
	CARRIER: "CARRIER",
	INTERCEPTOR: "INTERCEPTOR",
	BATTLESHIP: "BATTLESHIP",
} as const;

export type ShipClassValue = (typeof ShipClass)[keyof typeof ShipClass];

// ==================== 游戏状态枚举 ====================

export const WeaponState = {
	READY: "READY",
	COOLDOWN: "COOLDOWN",
	DISABLED: "DISABLED",
	OUT_OF_AMMO: "OUT_OF_AMMO",
} as const;
export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState];

export const ArmorQuadrant = {
	FRONT_TOP: "FRONT_TOP",
	FRONT_BOTTOM: "FRONT_BOTTOM",
	LEFT_TOP: "LEFT_TOP",
	LEFT_BOTTOM: "LEFT_BOTTOM",
	RIGHT_TOP: "RIGHT_TOP",
	RIGHT_BOTTOM: "RIGHT_BOTTOM",
} as const;
export type ArmorQuadrantValue = (typeof ArmorQuadrant)[keyof typeof ArmorQuadrant];
export const ARMOR_QUADRANTS: readonly ArmorQuadrantValue[] = Object.values(ArmorQuadrant);

export const FluxState = {
	NORMAL: "NORMAL",
	VENTING: "VENTING",
	OVERLOADED: "OVERLOADED",
} as const;
export type FluxStateValue = (typeof FluxState)[keyof typeof FluxState];

export const Faction = {
	PLAYER: "PLAYER",
	DM: "DM",
	NEUTRAL: "NEUTRAL",
	HEGEMONY: "hegemony",
	SINDRIAN: "sindrian",
	PERSEAN: "persean",
	TRI_TACHYON: "tri_tachyon",
	PIRATE: "pirate",
	INDEPENDENT: "independent",
} as const;
export type FactionValue = (typeof Faction)[keyof typeof Faction];

export const PlayerRole = {
	DM: "DM",
	PLAYER: "PLAYER",
} as const;
export type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole];

export const ConnectionQuality = {
	EXCELLENT: "EXCELLENT",
	GOOD: "GOOD",
	FAIR: "FAIR",
	POOR: "POOR",
	OFFLINE: "OFFLINE",
} as const;
export type ConnectionQualityValue = (typeof ConnectionQuality)[keyof typeof ConnectionQuality];

export const ChatMessageType = {
	CHAT: "chat",
	SYSTEM: "system",
	COMBAT: "combat",
} as const;
export type ChatMessageTypeValue = (typeof ChatMessageType)[keyof typeof ChatMessageType];

export const GamePhase = {
	DEPLOYMENT: "DEPLOYMENT",
	PLAYER_TURN: "PLAYER_TURN",
	DM_TURN: "DM_TURN",
	END_PHASE: "END_PHASE",
	BATTLE: "BATTLE",
	END: "END",
} as const;
export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase];

export const TurnPhase = {
	START: "START",
	MOVEMENT: "MOVEMENT",
	COMBAT: "COMBAT",
	END: "END",
} as const;
export type TurnPhaseValue = (typeof TurnPhase)[keyof typeof TurnPhase];

export const MovePhase = {
	PHASE_A: "PHASE_A",
	PHASE_B: "PHASE_B",
	PHASE_C: "PHASE_C",
} as const;
export type MovePhaseValue = (typeof MovePhase)[keyof typeof MovePhase];

export const FactionTurnPhase = {
	DRAW: "DRAW",
	PLAY: "PLAY",
	END: "END",
} as const;
export type FactionTurnPhaseValue = (typeof FactionTurnPhase)[keyof typeof FactionTurnPhase];

export const TokenType = {
	SHIP: "ship",
	STATION: "station",
	ASTEROID: "asteroid",
} as const;
export type TokenTypeValue = (typeof TokenType)[keyof typeof TokenType];

export const TokenTurnState = {
	WAITING: "waiting",
	ACTIVE: "active",
	DONE: "done",
} as const;
export type TokenTurnStateValue = (typeof TokenTurnState)[keyof typeof TokenTurnState];

export const ClientCommand = {
	CMD_MOVE_TOKEN: "CMD_MOVE_TOKEN",
	CMD_TOGGLE_SHIELD: "CMD_TOGGLE_SHIELD",
	CMD_FIRE_WEAPON: "CMD_FIRE_WEAPON",
	CMD_VENT_FLUX: "CMD_VENT_FLUX",
	CMD_ASSIGN_SHIP: "CMD_ASSIGN_SHIP",
	CMD_TOGGLE_READY: "CMD_TOGGLE_READY",
	CMD_NEXT_PHASE: "CMD_NEXT_PHASE",
	CMD_CREATE_OBJECT: "CMD_CREATE_OBJECT",
	CMD_CLEAR_OVERLOAD: "CMD_CLEAR_OVERLOAD",
	CMD_SET_ARMOR: "CMD_SET_ARMOR",
	CMD_ADVANCE_MOVE_PHASE: "CMD_ADVANCE_MOVE_PHASE",
} as const;
export type ClientCommandValue = (typeof ClientCommand)[keyof typeof ClientCommand];

// ==================== 基础类型 ====================

export interface Point {
	x: number;
	y: number;
}

// ==================== 武器规格 ====================

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

// ==================== 武器挂载规格 ====================

export interface WeaponMountSpec {
	id: string;
	type: MountTypeValue;
	size: WeaponSlotSizeValue;
	position: Point;
	facing: number;
	arc: number;
	defaultWeapon?: string;
}

// ==================== 舰船规格 ====================

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

// ==================== 伤害倍率 ====================

export interface DamageModifierConfig {
	shield: number;
	armor: number;
	hull: number;
	description?: string;
}

export type DamageModifiersMap = Record<DamageTypeValue, DamageModifierConfig>;