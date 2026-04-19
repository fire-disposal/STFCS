/**
 * Weapon JSON Types - 武器JSON统一模型类型定义
 *
 * 基于 schemas/weapon.schema.json 生成的类型
 */

import type { Texture, Metadata } from "./CommonJsonTypes.js";

// ==================== 武器枚举类型 ====================

export type WeaponCategoryType = "BALLISTIC" | "ENERGY" | "MISSILE" | "SYNERGY";
export type DamageTypeType = "KINETIC" | "HIGH_EXPLOSIVE" | "ENERGY" | "FRAGMENTATION";
export type WeaponStateType = "READY" | "COOLDOWN" | "DISABLED" | "FIRED";
export type WeaponTagType = "ANTI_SHIP" | "PD" | "GUIDED" | "BALLISTIC" | "ENERGY" | "HE" | "BEAM" | "SUPPRESSION";

// ==================== 状态效果类型 ====================

export interface StatusEffect {
	id: string;
	type: string;
	source?: string;
	duration?: number;
	stackCount?: number;
	data?: Record<string, any>;
}

// ==================== 武器规格类型（扁平化） ====================

export interface WeaponSpec {
	category: WeaponCategoryType;
	damageType: DamageTypeType;
	size: "SMALL" | "MEDIUM" | "LARGE";
	damage: number;
	projectilesPerShot?: number;
	range: number;
	minRange?: number;
	cooldown?: number;
	fluxCostPerShot: number;
	allowsMultipleTargets?: boolean;
	burstCount?: number;
	opCost?: number;
	tags?: WeaponTagType[];
	texture?: Texture;
}

// ==================== 武器运行时状态 ====================

export interface WeaponRuntime {
	mountId: string;
	state: WeaponStateType;
	cooldownRemaining?: number;
	statusEffects?: StatusEffect[];
	weapon?: WeaponSpec; // 引用武器规格
}

// ==================== 完整武器JSON类型 ====================

export interface WeaponJSON {
	"$schema": "weapon-v2";
	"$id": string;

	weapon: WeaponSpec;
	runtime?: WeaponRuntime;
	metadata?: Metadata;
}

/** 武器ID格式 */
export type WeaponIdFormat = `preset:${string}` | `weapon:${string}`;
