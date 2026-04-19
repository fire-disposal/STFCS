/**
 * Ship JSON Types - 舰船JSON统一模型类型定义
 *
 * 基于 schemas/ship.schema.json 生成的类型
 */

import type { Texture, FactionType, Metadata} from "./CommonJsonTypes.js";
import type { WeaponJSON, WeaponRuntime } from "./WeaponJsonTypes.js";

// ==================== 基础几何类型 ====================

export interface Point {
	x: number;
	y: number;
}

// ==================== 插件类型 ====================

export interface PluginSlot {
	id: string;
	name: string;
	description?: string;
}

// ==================== 舰船规格类型（扁平化） ====================

export type ShieldType = "OMNI" | "FRONT" | "NONE";

export interface ShieldSpec {
	/** 护盾类型：全向盾/前盾/无 */
	type: ShieldType;
	/** 护盾覆盖角度（度） */
	arc: number;
	/** 护盾展开中心点角度（相对于舰船朝向，0=正前方） */
	direction?: number;
	/** 护盾半径 */
	radius: number;
	/** 护盾效率：吸收伤害时产生的硬辐能倍率 */
	efficiency: number;
	/** 护盾维持消耗（每回合软辐能） */
	upkeep: number;
}

export interface MountSpec {
	id: string;
	displayName?: string;
	position: Point;
	facing?: number;
	mountType: "TURRET" | "HARDPOINT";
	size: "SMALL" | "MEDIUM" | "LARGE";
	weapon?: WeaponJSON | string;
	group?: string;
}

export interface ShipSpec {
	size: "FRIGATE" | "DESTROYER" | "CRUISER" | "CAPITAL";
	class: "STRIKE" | "ASSAULT" | "COMBAT" | "SUPPORT" | "HEAVY" | "CARRIER" | "BATTLESHIP";
	width?: number;
	length?: number;
	maxHitPoints: number;
	armorMaxPerQuadrant: number;
	armorMinReduction?: number;
	armorMaxReduction?: number;
	fluxCapacity?: number;
	fluxDissipation?: number;
	shield?: ShieldSpec;
	maxSpeed: number;
	maxTurnRate: number;
	mounts?: MountSpec[];
	plugins?: PluginSlot[];
	rangeModifier?: number;
	texture?: Texture;
}

// ==================== 运行时状态类型 ====================

/**
 * 移动阶段
 * A: 平移阶段（前后或左右，选定后锁定）
 * B: 旋转阶段
 * C: 平移阶段（前后或左右，选定后锁定）
 */
export type MovementPhase = "A" | "B" | "C" | "DONE";

/**
 * 平移方向锁定
 * FORWARD_BACKWARD: 只能前后移动
 * LEFT_RIGHT: 只能左右横移
 */
export type TranslationLock = "FORWARD_BACKWARD" | "LEFT_RIGHT" | null;

export interface MovementState {
	/** 当前移动阶段 */
	currentPhase?: MovementPhase;
	/** A阶段已用移动力 */
	phaseAUsed?: number;
	/** B阶段已用旋转角度 */
	turnAngleUsed?: number;
	/** C阶段已用移动力 */
	phaseCUsed?: number;
	/** A阶段方向锁定 */
	phaseALock?: TranslationLock;
	/** C阶段方向锁定 */
	phaseCLock?: TranslationLock;
	/** 是否已完成本回合移动 */
	hasMoved?: boolean;
}

export interface ShipRuntime {
	position: Point;
	heading: number;
	hull: number;
	armor: number[];
	fluxSoft?: number;
	fluxHard?: number;
	shield?: {
		active: boolean;
		/** 当前护盾值（0-maxShield） */
		value: number;
		/** 最大护盾值 */
		maxShield?: number;
		/** 护盾覆盖中心角度（相对于舰船朝向） */
		direction?: number;
		/** 护盾覆盖角度 */
		arc?: number;
		/** 护盾半径 */
		radius?: number;
		/** 护盾效率 */
		efficiency?: number;
		/** 护盾维持消耗 */
		upkeep?: number;
	};
	overloaded?: boolean;
	overloadTime?: number;
	destroyed?: boolean;
	movement?: MovementState;
	hasFired?: boolean;
	weapons?: WeaponRuntime[];
	faction?: FactionType;
	ownerId?: string;
	/** 主动排散状态：本回合是否已主动排散 */
	venting?: boolean;
}

// ==================== 完整舰船JSON类型 ====================

export interface ShipJSON {
	"$schema": "ship-v2";
	"$id": string;
	"$source"?: "preset" | "custom" | "save"; // 已弃用，保留兼容
	"$presetRef"?: string;

	ship: ShipSpec;
	runtime?: ShipRuntime;
	metadata: Metadata;
}

/** 舰船ID格式 */
export type ShipIdFormat = `preset:${string}` | `ship:${string}` | `save:${string}`;
