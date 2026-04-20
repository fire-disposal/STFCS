/**
 * 武器规则计算
 * 基于 @vt/data 权威设计
 */

import type { WeaponJSON, ShipJSON, DamageTypeValue } from "@vt/data";
import { GAME_RULES } from "@vt/data";

import type { Point } from "../../types/common.js";
import { distance, angleBetween } from "../geometry/index.js";
import { calculateModifiedValue } from "../modules/modifier.js";

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
 * 计算武器攻击
 */
export function calculateWeaponAttack(
  weaponSpec: WeaponJSON["weapon"],
  _weaponRuntime: WeaponJSON["runtime"],
  attackerSpec: ShipJSON["ship"],
  _attackerRuntime: ShipJSON["runtime"],
  targetSpec: ShipJSON["ship"],
  targetRuntime: ShipJSON["runtime"],
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
    return result; // 超出射程，未命中
  }

  // 2. 检查射界（简化：假设全向）
  // TODO: 实现实际射界检查

  // 3. 计算命中率
  const hitChance = calculateHitChance(dist, effectiveRange, weaponSpec);
  result.hit = Math.random() <= hitChance;

  if (!result.hit) {
    return result; // 未命中
  }

  // 4. 计算伤害
  const baseDamage = weaponSpec.damage * (weaponSpec.projectilesPerShot || 1);
  const damageModifier = calculateDamageModifier(dist, effectiveRange);
  const totalDamage = baseDamage * damageModifier;

  // 5. 计算辐能产生
  result.fluxGenerated = weaponSpec.fluxCostPerShot || 0;

  // 6. 计算伤害类型修正
  const damageType = weaponSpec.damageType as DamageTypeValue;
  const gameRules = GAME_RULES;
  const damageModifiers = gameRules.combat.damageModifiers;
  const modifier = damageModifiers[damageType] || {
    shieldMultiplier: 1,
    armorMultiplier: 1,
    hullMultiplier: 1,
  };

  // 7. 应用伤害到目标
  result.damage = totalDamage * modifier.hullMultiplier;
  
  // 检查护盾
  if (targetRuntime.shield?.active && targetSpec.shield) {
    const shieldAngle = targetSpec.shield.direction || 0;
    const shieldArc = targetSpec.shield.arc || 360;
    const hitAngle = angleBetween(targetPosition, attackerPosition);
    const angleDiff = Math.abs(((hitAngle - shieldAngle + 180) % 360) - 180);

    if (angleDiff <= shieldArc / 2) {
		result.shieldHit = true;
		const shieldDamage = totalDamage * modifier.shieldMultiplier;

		// 应用护盾效率 modifier
		const baseEfficiency = targetSpec.shield.efficiency || 1;
		const efficiency = calculateModifiedValue(baseEfficiency, targetRuntime, "shieldEfficiency");
		const shieldFlux = shieldDamage * efficiency;

		result.fluxGenerated += shieldFlux;
		result.damage = 0; // 护盾完全阻挡伤害
	}
  }

  // 8. 计算护甲命中
  if (!result.shieldHit && targetRuntime.armor) {
    result.armorHit = true;
    
    // 计算受击象限
    const hitAngle = angleBetween(targetPosition, attackerPosition);
    const relativeAngle = ((hitAngle - (targetRuntime.heading || 0) + 360) % 360);
    result.armorQuadrant = targetQuadrant !== undefined 
      ? targetQuadrant 
      : Math.floor(relativeAngle / 60) % 6;

    const armorValue = targetRuntime.armor[result.armorQuadrant] || 0;
    const armorDamage = totalDamage * modifier.armorMultiplier;

    // 穿甲计算
    const penetration = armorDamage * 0.5; // 简化穿甲系数
    const armorReduction = Math.max(0, armorValue - penetration);

    // 剩余伤害穿透
    if (armorReduction > 0) {
      result.damage = totalDamage * 0.2; // 20%伤害穿透
    }
  }

  // 9. 检查目标状态
  const newHull = (targetRuntime.hull || 0) - result.damage;
  result.targetDestroyed = newHull <= 0;

  // 10. 检查过载
  const totalFlux = (targetRuntime.fluxSoft || 0) + (targetRuntime.fluxHard || 0) + result.fluxGenerated;
  const fluxCapacity = targetSpec.fluxCapacity || 0;
  result.targetOverloaded = totalFlux > fluxCapacity;

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
  let baseChance = 0.8; // 基础命中率

  // 距离惩罚
  const rangePenalty = rangeRatio * 0.4; // 距离越远命中率越低
  baseChance -= rangePenalty;

  // 武器特性影响（简化）
  if (weaponSpec.tags?.includes("PD")) {
    baseChance += 0.2; // 点防御武器命中率更高
  }

  return Math.max(0.1, Math.min(0.95, baseChance));
}

/**
 * 计算伤害修正系数
 */
export function calculateDamageModifier(
  distance: number,
  maxRange: number
): number {
  if (distance > maxRange) return 0;

  const rangeRatio = distance / maxRange;
  const rangePenalty = 1 - rangeRatio * 0.5; // 距离越远伤害越低
  return Math.max(0.1, rangePenalty);
}

/**
 * 计算武器冷却
 */
export function calculateWeaponCooldown(
  _weaponSpec: WeaponJSON["weapon"],
  currentCooldown: number
): number {
  return Math.max(0, currentCooldown - 1); // 每回合减少1
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
 * 将武器状态设为 "FIRED"（本回合已开火）
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
 * - "FIRED" → "READY" (cooldown=0) 或 "COOLDOWN" (cooldown>0)
 * - "COOLDOWN" → cooldownRemaining--, 若到0则变为 "READY"
 */
export function updateWeaponStateAtTurnEnd(
  weaponRuntime: WeaponJSON["runtime"],
  weaponSpec?: WeaponJSON["weapon"]
): WeaponJSON["runtime"] {
  if (!weaponRuntime) return weaponRuntime;

  // 处理本回合已开火的武器
  if (weaponRuntime.state === "FIRED") {
    const cooldown = weaponSpec?.cooldown || 0;
    if (cooldown <= 0) {
      // 无冷却，直接恢复就绪
      return {
        ...weaponRuntime,
        state: "READY",
      } as WeaponJSON["runtime"];
    } else {
      // 进入冷却
      return {
        ...weaponRuntime,
        state: "COOLDOWN",
        cooldownRemaining: cooldown,
      } as WeaponJSON["runtime"];
    }
  }

  // 处理冷却中的武器
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