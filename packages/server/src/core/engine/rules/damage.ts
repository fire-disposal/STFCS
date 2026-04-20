/**
 * 伤害计算规则 - 基于 @vt/data 权威设计
 */

import type { ShipJSON, DamageTypeValue } from "@vt/data";
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

export interface DamageModifiers {
  shieldMultiplier: number;
  armorMultiplier: number;
  hullMultiplier: number;
}

/**
 * 计算伤害 - 纯函数版本（使用data包配置）
 */
export function calculateDamage(
  targetSpec: ShipJSON["ship"],
  targetRuntime: ShipJSON["runtime"],
  damageAmount: number,
  damageType: DamageTypeValue,
  hitPosition: Point,
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

  // 从data包获取伤害修正系数
  const gameRules = GAME_RULES;
  const damageModifiers = gameRules.combat.damageModifiers;
  const modifier = damageModifiers[damageType] || {
    shieldMultiplier: 1,
    armorMultiplier: 1,
    hullMultiplier: 1,
  };

  let remainingDamage = damageAmount;

  // 1. 护盾阶段
  if (targetRuntime.shield?.active && targetSpec.shield) {
    const shieldAngle = targetSpec.shield.direction || 0;
    const shieldArc = targetSpec.shield.arc || 360;
    const hitAngle = angleBetween(targetPosition, hitPosition);
    const angleDiff = Math.abs(((hitAngle - shieldAngle + 180) % 360) - 180);

    if (angleDiff <= shieldArc / 2) {
		result.shieldHit = true;
		const shieldDamage = remainingDamage * modifier.shieldMultiplier;

		// 应用护盾效率 modifier
		// 远行星号规则：硬辐能 = 吸收伤害 × 护盾效率
		const baseEfficiency = targetSpec.shield.efficiency || 1;
		const efficiency = calculateModifiedValue(baseEfficiency, targetRuntime, "shieldEfficiency");
		const fluxGenerated = shieldDamage * efficiency;

		result.fluxGenerated = fluxGenerated;

      // 检查过载
      const newFluxHard = (targetRuntime.fluxHard || 0) + fluxGenerated;
      if (newFluxHard > (targetSpec.fluxCapacity || 0)) {
        result.targetOverloaded = true;
      }

      remainingDamage = 0; // 护盾完全阻挡伤害
    }
  }

  // 2. 护甲阶段
  if (remainingDamage > 0 && targetRuntime.armor) {
    result.armorHit = true;

    // 计算受击象限（六象限系统）
    const hitAngle = angleBetween(targetPosition, hitPosition);
    const relativeAngle = ((hitAngle - (targetRuntime.heading || 0) + 360) % 360);
    result.armorQuadrant = Math.floor(relativeAngle / 60) % 6;

    const armorValue = targetRuntime.armor[result.armorQuadrant] || 0;
    const armorDamage = remainingDamage * modifier.armorMultiplier;

    // 穿甲计算
    const penetration = armorDamage * 0.5; // 简化穿甲系数
    const armorReduction = Math.max(0, armorValue - penetration);
    const actualArmorDamage = Math.min(armorDamage, armorValue);

    result.armorDamage = actualArmorDamage;
    remainingDamage = armorReduction > 0 ? remainingDamage * 0.2 : remainingDamage; // 剩余伤害穿透
  }

  // 3. 船体阶段
  if (remainingDamage > 0) {
    const hullDamage = remainingDamage * modifier.hullMultiplier;
    result.hullDamage = hullDamage;

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
  targetSpec: ShipJSON["ship"],
  targetRuntime: ShipJSON["runtime"]
): { empApplied: number; fluxGenerated: number; systemsDisabled: string[] } {
  const result = {
    empApplied: 0,
    fluxGenerated: 0,
    systemsDisabled: [] as string[],
  };

  if (!targetRuntime) {
    return result;
  }

  // EMP直接产生硬辐能
  result.fluxGenerated = empAmount;
  result.empApplied = empAmount;

  // 检查系统禁用（简化版）
  const empThreshold = (targetSpec.fluxCapacity || 100) * 0.7;
  if (empAmount > empThreshold) {
    // 高EMP伤害可能禁用系统
    if (Math.random() > 0.5) result.systemsDisabled.push("weapons");
    if (Math.random() > 0.7) result.systemsDisabled.push("engines");
    if (Math.random() > 0.9) result.systemsDisabled.push("shield");
  }

  return result;
}

/**
 * 计算伤害修正系数
 */
export function calculateDamageModifier(
  distance: number,
  maxRange: number,
  accuracy: number = 1.0
): number {
  if (distance > maxRange) return 0;

  const rangeRatio = distance / maxRange;
  const rangePenalty = 1 - rangeRatio * 0.5; // 距离越远伤害越低
  return rangePenalty * accuracy;
}