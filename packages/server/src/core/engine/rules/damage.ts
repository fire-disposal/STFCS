/**
 * 伤害计算规则 - 基于 @vt/data 权威设计
 *
 * 权威公式来源：docs/design/issues.md
 *
 * 伤害类型修正：
 * - 高爆(HE):    穿甲强度 Z = X * 2.0，对护盾伤害 Y = X * 0.5
 * - 动能(KIN):   穿甲强度 Z = X * 0.5，对护盾伤害 Y = X * 2.0
 * - 破片(FRAG):  穿甲强度 Z = X * 0.25，对护盾伤害 Y = X * 0.25
 * - 能量(ENER):  穿甲强度 Z = X * 1.0，对护盾伤害 Y = X * 1.0
 *
 * 护盾阶段：
 * - 若攻击命中舰船护盾，产生硬辐能 = Y * 护盾效率
 *
 * 护甲减伤公式：
 * - 计算护甲值 C = max(当前护甲B, 最大护甲A * 最小减伤比)
 * - 最终伤害 D = X * Z / (Z + C)
 * - 若 (X - D) / X > 最大护甲减伤比，则 D = X * (1 - 最大护甲减伤比)
 */

import type { TokenJSON, DamageTypeValue } from "@vt/data";
import { GAME_RULES } from "@vt/data";

import type { Point } from "../../types/common.js";
import { angleBetween } from "../geometry/angle.js";
import { calculateModifiedValue } from "../modules/modifier.js";

export interface DamageResult {
	damageApplied: number;
	empApplied: number;
	fluxGenerated: number;
	shieldHit: boolean;
	armorHit: boolean;
	armorQuadrant: number;
	armorDamage: number;
	hullDamage: number;
	targetOverloaded: boolean;
	targetDestroyed: boolean;
}

/**
 * 计算伤害 - 符合 docs/design/issues.md 公式
 */
export function calculateDamage(
	targetSpec: TokenJSON["token"],
	targetRuntime: TokenJSON["runtime"],
	damageAmount: number,
	damageType: DamageTypeValue,
	attackerPosition: Point,
	targetPosition: Point
): DamageResult {
	if (!targetRuntime) {
		throw new Error("目标运行时状态缺失");
	}

	const result: DamageResult = {
		damageApplied: 0,
		empApplied: 0,
		fluxGenerated: 0,
		shieldHit: false,
		armorHit: false,
		armorQuadrant: -1,
		armorDamage: 0,
		hullDamage: 0,
		targetOverloaded: false,
		targetDestroyed: false,
	};

	const gameRules = GAME_RULES;
	const modifier = gameRules.combat.damageModifiers[damageType] || {
		shieldMultiplier: 1,
		penetrationMultiplier: 1,
		hullMultiplier: 1,
	};

	let remainingDamage = damageAmount;

	// 1. 护盾阶段
	if (targetRuntime.shield?.active && targetSpec.shield) {
		const shieldAngle = targetSpec.shield.direction || 0;
		const shieldArc = targetSpec.shield.arc || 360;
		const hitAngle = angleBetween(targetPosition, attackerPosition);
		const angleDiff = Math.abs(((hitAngle - shieldAngle + 180) % 360) - 180);

		if (angleDiff <= shieldArc / 2) {
			result.shieldHit = true;

			// 对护盾伤害 Y = X * shieldMultiplier
			const shieldDamage = remainingDamage * modifier.shieldMultiplier;

			// 护盾效率 modifier
			const baseEfficiency = targetSpec.shield.efficiency || 1;
			const efficiency = calculateModifiedValue(baseEfficiency, targetRuntime, "shieldEfficiency");

			// 硬辐能 = Y * 护盾效率
			const fluxGenerated = shieldDamage * efficiency;
			result.fluxGenerated = fluxGenerated;

			// 检查过载
			const newFluxHard = (targetRuntime.fluxHard || 0) + fluxGenerated;
			if (newFluxHard > (targetSpec.fluxCapacity || 0)) {
				result.targetOverloaded = true;
			}

			remainingDamage = 0;
		}
	}

	// 2. 护甲阶段
	if (remainingDamage > 0 && targetRuntime.armor) {
		result.armorHit = true;

		// 计算受击象限（六象限系统）
		const hitAngle = angleBetween(targetPosition, attackerPosition);
		const relativeAngle = ((hitAngle - (targetRuntime.heading || 0) + 360) % 360);
		result.armorQuadrant = Math.floor(relativeAngle / 60) % 6;

		const quadrantIndex = result.armorQuadrant;
		const currentArmor = targetRuntime.armor[quadrantIndex] || 0;
		const maxArmor = targetSpec.armorMaxPerQuadrant || 0;
		const minReduction = targetSpec.armorMinReduction || 0.1;
		const maxReduction = targetSpec.armorMaxReduction || 0.85;

		// 穿甲强度 Z = X * penetrationMultiplier
		const penetration = remainingDamage * modifier.penetrationMultiplier;

		// 计算护甲值 C = max(当前护甲B, 最大护甲A * 最小减伤比)
		const effectiveArmor = Math.max(currentArmor, maxArmor * minReduction);

		// 最终伤害 D = X * Z / (Z + C)
		let hullDamage = (remainingDamage * penetration) / (penetration + effectiveArmor);

		// 最大护甲减伤比限制：若 (X-D)/X > 最大护甲减伤比，则 D = X * (1 - 最大护甲减伤比)
		const damageReductionRatio = (remainingDamage - hullDamage) / remainingDamage;
		if (damageReductionRatio > maxReduction) {
			hullDamage = remainingDamage * (1 - maxReduction);
		}

		// 护甲剥落：使用配置的剥落比例
		const armorDamageRatio = gameRules.combat.armor.armorDamageRatio;
		const armorDamage = Math.min(remainingDamage * armorDamageRatio, currentArmor);

		result.armorDamage = armorDamage;
		result.hullDamage = hullDamage;
		remainingDamage = 0;

		// 检查是否被摧毁
		const newHull = (targetRuntime.hull || 0) - hullDamage;
		if (newHull <= 0) {
			result.targetDestroyed = true;
		}
	}

	result.damageApplied = damageAmount - remainingDamage;
	return result;
}

/**
 * 计算EMP伤害
 */
export function calculateEmpDamage(
	empAmount: number,
	targetSpec: TokenJSON["token"],
	targetRuntime: TokenJSON["runtime"]
): { empApplied: number; fluxGenerated: number; systemsDisabled: string[] } {
	const result = {
		empApplied: 0,
		fluxGenerated: 0,
		systemsDisabled: [] as string[],
	};

	if (!targetRuntime) {
		return result;
	}

	result.fluxGenerated = empAmount;
	result.empApplied = empAmount;

	const empThreshold = (targetSpec.fluxCapacity || 100) * 0.7;
	if (empAmount > empThreshold) {
		if (Math.random() > 0.5) result.systemsDisabled.push("weapons");
		if (Math.random() > 0.7) result.systemsDisabled.push("engines");
		if (Math.random() > 0.9) result.systemsDisabled.push("shield");
	}

	return result;
}

/**
 * 计算伤害修正系数（射程惩罚）
 */
export function calculateDamageModifier(
	distance: number,
	maxRange: number,
	accuracy: number = 1.0
): number {
	if (distance > maxRange) return 0;

	const rangeRatio = distance / maxRange;
	const rangePenalty = 1 - rangeRatio * 0.5;
	return rangePenalty * accuracy;
}