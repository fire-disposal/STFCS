/**
 * Ship JSON Types - 舰船JSON统一模型类型定义
 *
 * 基于 schemas/ship.schema.json 生成的类型
 */

import type { Texture, Faction, Metadata, StatusEffect } from "./CommonJsonTypes.js";
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

export interface ShieldSpec {
	arc: number;
	direction?: number;
	radius: number;
	efficiency?: number;
	upkeep?: number;
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

export interface MovementState {
	hasMoved?: boolean;
	phaseAUsed?: number;
	turnAngleUsed?: number;
	phaseCUsed?: number;
}

export interface ShipRuntime {
	position: Point;
	heading: number;
	hull: number;
	armor: number[];
	fluxSoft?: number;
	fluxHard?: number;
	shield?: { active: boolean; value: number };
	overloaded?: boolean;
	overloadTime?: number;
	destroyed?: boolean;
	movement?: MovementState;
	hasFired?: boolean;
	weapons?: WeaponRuntime[];
	faction?: Faction;
	ownerId?: string;
	statusEffects?: StatusEffect[];
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
