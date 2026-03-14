/**
 * 核心类型定义
 * 与 schemas/index.ts 保持严格一致
 */

export interface PlayerInfo {
	id: string;
	name: string;
	joinedAt: number;
	isActive: boolean;
	isDMMode: boolean;
}

// 导出通用结果类型
export type { Result, Success, Failure, OptionalResult } from "./result";
export { ok, fail } from "./result";

// ====== 舰船系统类型 ======

/** 舰船装甲象限类型（6 个象限，每个 60 度） */
export type ArmorQuadrant =
	| "FRONT_TOP"
	| "FRONT_BOTTOM"
	| "LEFT_TOP"
	| "LEFT_BOTTOM"
	| "RIGHT_TOP"
	| "RIGHT_BOTTOM";

export interface ArmorState {
	quadrants: Record<ArmorQuadrant, number>;
	maxArmor: number;
	maxQuadArmor: number;
}

export type FluxType = "soft" | "hard";

export interface FluxState {
	current: number;
	capacity: number;
	dissipation: number;
	softFlux: number;
	hardFlux: number;
}

export interface PlayerGameState {
	currentShipId: string | null;
	hasActivatedFluxVenting: boolean;
	readyForNextPhase: boolean;
	selectedWeapons: string[];
}

export type FluxOverloadState = "normal" | "venting" | "overloaded";

export interface ShieldSpec {
	type: "front" | "full";
	radius: number;
	centerOffset: { x: number; y: number };
	coverageAngle: number;
	efficiency: number;
	maintenanceCost: number;
	active: boolean;
}

export interface ShipStatus {
	id: string;
	hull: { current: number; max: number };
	armor: ArmorState;
	flux: FluxState;
	fluxState: FluxOverloadState;
	shield: ShieldSpec;
	position: { x: number; y: number };
	heading: number;
	speed: number;
	maneuverability: number;
	disabled: boolean;
	owner?: string;
}

export interface ShipMovement {
	shipId: string;
	phase: 1 | 2 | 3;
	type: "straight" | "strafe" | "rotate";
	distance?: number;
	angle?: number;
	newX: number;
	newY: number;
	newHeading: number;
	timestamp: number;
}

// ====== 战斗系统类型 ======

export interface ExplosionData {
	id: string;
	position: { x: number; y: number };
	radius: number;
	damage: number;
	sourceShipId?: string;
	targetShipId?: string;
	hitQuadrant?: ArmorQuadrant;
	timestamp: number;
}

export type WeaponType = "ballistic" | "energy" | "missile";
export type WeaponMountType = "fixed" | "turret";

export interface WeaponSpec {
	id: string;
	name: string;
	type: WeaponType;
	damage: number;
	range: number;
	arc: number;
	cooldown: number;
	fluxCost: number;
}

export interface WeaponMount {
	id: string;
	weaponId: string;
	mountType: WeaponMountType;
	position: { x: number; y: number };
	facing: number;
	arcMin: number;
	arcMax: number;
}

export interface AttackCommand {
	sourceShipId: string;
	targetShipId: string;
	weaponMountId: string;
	timestamp: number;
}

export interface CombatResult {
	hit: boolean;
	damage: number;
	shieldAbsorbed: number;
	armorReduced: number;
	hullDamage: number;
	hitQuadrant?: ArmorQuadrant;
	softFluxGenerated: number;
	hardFluxGenerated: number;
	sourceShipId: string;
	targetShipId: string;
	timestamp: number;
}

// ====== 地图与 Token 类型 ======

export interface MapConfig {
	id: string;
	width: number;
	height: number;
	name: string;
}

export type TokenType = "ship" | "station" | "asteroid";
export type UnitTurnState = "waiting" | "active" | "moved" | "acted" | "ended";

export interface TokenInfo {
	id: string;
	ownerId: string;
	position: { x: number; y: number };
	heading: number;
	type: TokenType;
	size: number;
	scale: number;
	assetUrl?: string;
	turnState: UnitTurnState;
	maxMovement: number;
	remainingMovement: number;
	actionsPerTurn: number;
	remainingActions: number;
	layer: number;
	collisionRadius: number;
	metadata: Record<string, unknown>;
}

// 导出统一相机类型
export type { CameraState, PlayerCamera, CameraUpdateCommand, CameraConfig } from "./camera";

// ====== 回合系统类型 ======

/** 回合阶段 */
export type TurnPhase = "planning" | "movement" | "action" | "resolution";

/** 回合单位信息 */
export interface TurnUnit {
	id: string;
	name: string;
	ownerId: string;
	ownerName: string;
	unitType: "ship" | "station" | "npc";
	state: UnitTurnState;
	initiative: number;
	avatarColor?: string;
	metadata?: Record<string, unknown>;
}

/** 回合顺序信息 */
export interface TurnOrder {
	currentIndex: number;
	units: TurnUnit[];
	roundNumber: number;
	phase: TurnPhase;
	isComplete: boolean;
}

/** 回合状态总览 */
export interface TurnState {
	order: TurnOrder | null;
	isInitialized: boolean;
	lastUpdated: number;
}
