/**
 * 类型定义 - Schema 使用此文件
 *
 * 类型先行原则：
 * 1. 所有枚举和基础类型在此定义
 * 2. Schema 类导入并使用这些类型
 * 3. 客户端直接导入此文件
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
export type WeaponCategoryValue = (typeof WeaponCategory)[keyof typeof WeaponCategory];

export const MountType = {
	FIXED: "FIXED",
	TURRET: "TURRET",
	HIDDEN: "HIDDEN",
} as const;
export type MountTypeValue = (typeof MountType)[keyof typeof MountType];

export const WeaponState = {
	READY: "READY",
	COOLDOWN: "COOLDOWN",
	DISABLED: "DISABLED",
	OUT_OF_AMMO: "OUT_OF_AMMO",
} as const;
export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState];

export const WeaponSlotSize = {
	SMALL: "SMALL",
	MEDIUM: "MEDIUM",
	LARGE: "LARGE",
} as const;
export type WeaponSlotSizeValue = (typeof WeaponSlotSize)[keyof typeof WeaponSlotSize];

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

export const ShieldType = {
	FRONT: "FRONT",
	OMNI: "OMNI",
	NONE: "NONE",
} as const;
export type ShieldTypeValue = (typeof ShieldType)[keyof typeof ShieldType];

export const FluxState = {
	NORMAL: "NORMAL",
	VENTING: "VENTING",
	OVERLOADED: "OVERLOADED",
} as const;
export type FluxStateValue = (typeof FluxState)[keyof typeof FluxState];

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
} as const;
export type ShipClassValue = (typeof ShipClass)[keyof typeof ShipClass];

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

// ==================== 基础接口 ====================

export interface Point {
	x: number;
	y: number;
}

export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	viewRotation?: number;
	followingShipId?: string | null;
}

export interface PlayerCamera extends CameraState {
	playerId: string;
}

// ==================== 命令 Payload ====================

export interface ChatPayload {
	message: string;
}

export interface MoveTokenPayload {
	shipId: string;
	targetX: number;
	targetY: number;
}

export interface ToggleShieldPayload {
	shipId: string;
}

export interface FireWeaponPayload {
	shipId: string;
	weaponId: string;
	targetId: string;
}

export interface VentFluxPayload {
	shipId: string;
}

export interface ClearOverloadPayload {
	shipId: string;
}

export interface SetArmorPayload {
	shipId: string;
	quadrant: ArmorQuadrantValue;
	value: number;
}

export interface AdvanceMovePhasePayload {
	shipId: string;
}

export interface AssignShipPayload {
	shipId: string;
	playerId: string;
}

export interface ToggleReadyPayload {
	ready: boolean;
}

export interface NextPhasePayload {}

export interface CreateObjectPayload {
	type: TokenTypeValue;
	x: number;
	y: number;
	heading?: number;
	name?: string;
	faction?: FactionValue;
}

export interface NetPingPayload {
	timestamp: number;
}

export interface NetPongPayload {
	pingTimestamp: number;
	pongTimestamp: number;
}

// ==================== 其他接口 ====================

export interface MovementPlan {
	phaseAForward: number;
	phaseAStrafe: number;
	turnAngle: number;
	phaseCForward: number;
	phaseCStrafe: number;
}

export interface MovementValidation {
	valid: boolean;
	error?: string;
}

export interface FactionTurnState {
	factionOrder: FactionValue[];
	currentFactionIndex: number;
	currentFaction: FactionValue;
	phase: FactionTurnPhaseValue;
	roundNumber: number;
}

export interface TokenInfo {
	id: string;
	type: TokenTypeValue;
	x: number;
	y: number;
	heading: number;
	name: string;
	faction?: FactionValue;
	ownerId: string;
}

export interface AttackPreviewResult {
	attackerId: string;
	weaponId: string;
	targetId: string;
	canAttack: boolean;
	expectedDamage: number;
	blockReason?: string;
}

export interface CombatResult {
	attackerId: string;
	targetId: string;
	weaponId: string;
	damage: number;
	isHit: boolean;
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
}

export interface ChatMessageSave {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: ChatMessageTypeValue;
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
	chatMessages: ChatMessageSave[];
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