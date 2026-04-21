/**
 * 武器规则计算
 * 基于 @vt/data 权威设计
 *
 * 此模块仅计算命中率和辐能，详细伤害计算由 damage.ts 处理
 */

import type { WeaponJSON, TokenJSON } from "@vt/data";

import type { Point } from "../../types/common.js";
import { distance } from "../geometry/index.js";

/**
 * 武器攻击结果
 */
export interface WeaponAttackResult {
	hit: boolean;
	damage: number;
	empDamage: number;
	fluxGenerated: number;
	shieldHit: boolean;
	armorHit: boolean;
	armorQuadrant: number;
	targetDestroyed: boolean;
	targetOverloaded: boolean;
}

/**
 * 计算武器攻击（基础结果，详细伤害由 damage.ts 计算）
 */
export function calculateWeaponAttack(
	weaponSpec: WeaponJSON["weapon"],
	_weaponRuntime: WeaponJSON["runtime"],
	attackerSpec: TokenJSON["token"],
	_attackerRuntime: TokenJSON["runtime"],
	_targetSpec: TokenJSON["token"],
	targetRuntime: TokenJSON["runtime"],
	attackerPosition: Point,
	targetPosition: Point,
	targetQuadrant?: number
): WeaponAttackResult {
	const result: WeaponAttackResult = {
		hit: false,
		damage: 0,
		empDamage: 0,
		fluxGenerated: 0,
		shieldHit: false,
		armorHit: false,
		armorQuadrant: -1,
		targetDestroyed: false,
		targetOverloaded: false,
	};

	if (!targetRuntime) {
		return result;
	}

	// 1. 检查射程
	const dist = distance(attackerPosition, targetPosition);
	const effectiveRange = weaponSpec.range * (attackerSpec.rangeModifier || 1.0);

	if (dist > effectiveRange) {
		return result;
	}

	// 2. 检查最小射程
	const minRange = weaponSpec.minRange || 0;
	if (dist < minRange) {
		return result;
	}

	// 3. 计算命中率
	const hitChance = calculateHitChance(dist, effectiveRange, weaponSpec);
	result.hit = Math.random() <= hitChance;

	if (!result.hit) {
		return result;
	}

	// 4. 计算基础伤害（射程惩罚）
	const baseDamage = weaponSpec.damage * (weaponSpec.projectilesPerShot || 1);
	const rangeModifier = calculateDamageModifier(dist, effectiveRange);
	result.damage = baseDamage * rangeModifier;

	// 5. 辐能产生（攻击者软辐能）
	result.fluxGenerated = weaponSpec.fluxCostPerShot || 0;

	// 6. 护甲象限（由外部指定或默认计算）
	result.armorQuadrant = targetQuadrant ?? -1;

	return result;
}

/**
 * 计算命中率
 */
export function calculateHitChance(
	distance: number,
	maxRange: number,
	weaponSpec: WeaponJSON["weapon"]
): number {
	if (distance > maxRange) return 0;

	const rangeRatio = distance / maxRange;
	let baseChance = 0.8;

	const rangePenalty = rangeRatio * 0.4;
	baseChance -= rangePenalty;

	if (weaponSpec.tags?.includes("PD")) {
		baseChance += 0.2;
	}

	return Math.max(0.1, Math.min(0.95, baseChance));
}

/**
 * 计算射程伤害修正系数
 */
export function calculateDamageModifier(
	distance: number,
	maxRange: number
): number {
	if (distance > maxRange) return 0;

	const rangeRatio = distance / maxRange;
	const rangePenalty = 1 - rangeRatio * 0.5;
	return Math.max(0.1, rangePenalty);
}

/**
 * 计算武器冷却
 */
export function calculateWeaponCooldown(
	_weaponSpec: WeaponJSON["weapon"],
	currentCooldown: number
): number {
	return Math.max(0, currentCooldown - 1);
}

/**
 * 检查武器是否就绪
 */
export function isWeaponReady(
	weaponRuntime: WeaponJSON["runtime"]
): boolean {
	if (!weaponRuntime) return false;
	return weaponRuntime.state === "READY";
}

/**
 * 武器开火后状态更新
 */
export function setWeaponFired(
	weaponRuntime: WeaponJSON["runtime"]
): WeaponJSON["runtime"] {
	if (!weaponRuntime) return weaponRuntime;

	return {
		...weaponRuntime,
		state: "FIRED",
	} as WeaponJSON["runtime"];
}

/**
 * 回合结束时处理武器状态转换
 */
export function updateWeaponStateAtTurnEnd(
	weaponRuntime: WeaponJSON["runtime"],
	weaponSpec?: WeaponJSON["weapon"]
): WeaponJSON["runtime"] {
	if (!weaponRuntime) return weaponRuntime;

	if (weaponRuntime.state === "FIRED") {
		const cooldown = weaponSpec?.cooldown || 0;
		if (cooldown <= 0) {
			return {
				...weaponRuntime,
				state: "READY",
			} as WeaponJSON["runtime"];
		} else {
			return {
				...weaponRuntime,
				state: "COOLDOWN",
				cooldownRemaining: cooldown,
			} as WeaponJSON["runtime"];
		}
	}

	if (weaponRuntime.state === "COOLDOWN" && (weaponRuntime.cooldownRemaining || 0) > 0) {
		const newCooldown = Math.max(0, (weaponRuntime.cooldownRemaining || 0) - 1);
		return {
			...weaponRuntime,
			state: newCooldown === 0 ? "READY" : "COOLDOWN",
			cooldownRemaining: newCooldown,
		} as WeaponJSON["runtime"];
	}

	return weaponRuntime;
}