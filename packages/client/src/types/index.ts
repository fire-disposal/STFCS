/**
 * 客户端特有类型定义
 *
 * 这些类型仅在客户端使用，不共享到服务端
 */

import type { FactionValue, FluxStateValue, Point, WeaponCategoryValue, WeaponSlotSizeValue, MountTypeValue } from "@vt/types";

// ==================== 舰船状态 ====================

/**
 * 舰船状态（客户端特有）
 * 用于 Redux store 中的舰船状态管理
 */
export interface ShipStatus {
	id: string;
	name: string;
	hullType: string;
	faction: FactionValue;
	ownerId: string;
	x: number;
	y: number;
	heading: number;
	hull: { current: number; max: number };
	shield: {
		active: boolean;
		type: string;
		orientation: number;
		arc: number;
		radius: number;
	};
	flux: {
		hard: number;
		soft: number;
		max: number;
		dissipation: number;
		state: FluxStateValue;
	};
	weapons: Record<string, WeaponSpec>;
	isOverloaded: boolean;
	isDestroyed: boolean;
	hasMoved: boolean;
	hasFired: boolean;
}

// ==================== 武器规格 ====================

/**
 * 武器规格（客户端特有）
 */
export interface WeaponSpec {
	id: string;
	name: string;
	category: WeaponCategoryValue;
	damage: number;
	range: number;
	arc: number;
	cooldown: number;
	fluxCost: number;
	ammo: number;
	maxAmmo: number;
	currentAmmo: number;
	reloadTime: number;
}

// ==================== 武器挂载 ====================

/**
 * 武器挂载（客户端特有）
 */
export interface WeaponMount {
	id: string;
	weaponSpecId: string;
	position: Point;
	facing: number;
	arc: number;
}

// ==================== 舰船移动 ====================

/**
 * 舰船移动（客户端特有）
 * 用于移动队列
 */
export interface ShipMovement {
	shipId: string;
	x: number;
	y: number;
	heading: number;
	movementPlan?: {
		phaseAForward: number;
		phaseAStrafe: number;
		turnAngle: number;
		phaseCForward: number;
		phaseCStrafe: number;
	};
	phase?: "PHASE_A" | "PHASE_B" | "PHASE_C";
	isIncremental?: boolean;
}

// ==================== 辐能过载状态 ====================

/**
 * 辐能过载状态（客户端特有）
 */
export type FluxOverloadState = "normal" | "venting" | "overloaded";

// ==================== 舰船行动状态 ====================

/**
 * 舰船行动状态（客户端特有）
 */
export type ShipActionState = "idle" | "moving" | "attacking" | "cooldown";

// ==================== 地图配置 ====================

/**
 * 地图配置（客户端特有）
 */
export interface MapConfig {
	id: string;
	name: string;
	width: number;
	height: number;
}

/**
 * 地图快照（客户端特有）
 */
export interface MapSnapshot {
	config: MapConfig;
	tokens: Record<string, any>;
	createdAt: number;
}

/**
 * 星球节点（客户端特有）
 */
export interface PlanetNode {
	id: string;
	name: string;
	x: number;
	y: number;
	type: string;
}

/**
 * 恒星节点（客户端特有）
 */
export interface StarNode {
	id: string;
	name: string;
	x: number;
	y: number;
	systems: Record<string, StarSystem>;
}

/**
 * 恒星系统（客户端特有）
 */
export interface StarSystem {
	id: string;
	name: string;
	description?: string;
}

// ==================== 阵营类型别名 ====================

/** @deprecated 直接使用 `FactionValue` */
export type FactionId = FactionValue;
