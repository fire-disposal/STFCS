/**
 * 武器规则计算
 * 基于 @vt/data 权威设计
 */

import type { WeaponJSON, ShipJSON, DamageTypeValue } from "@vt/data";
import { getGameRules } from "@vt/data";
import type { Point } from "../../types/common.js";
import { distance, angleBetween } from "../geometry/index.js";

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
  weaponRuntime: WeaponJSON["runtime"],
  attackerSpec: ShipJSON["ship"],
  attackerRuntime: ShipJSON["runtime"],
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
  const gameRules = getGameRules();
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
      const efficiency = targetSpec.shield.efficiency || 1;
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
    const actualArmorDamage = Math.min(armorDamage, armorValue);

    // 剩余伤害穿透
    if (armorReduction > 0) {
      result.damage = totalDamage * 0.2; // 20%伤害穿透
    }
  }

  // 9. 检查目标状态
  const newHull = (targetRuntime.hull?.current || 0) - result.damage;
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
  weaponSpec: WeaponJSON["weapon"],
  currentCooldown: number
): number {
  const cooldown = weaponSpec.cooldown || 0;
  return Math.max(0, currentCooldown - 1); // 每回合减少1
}

/**
 * 检查武器是否就绪
 */
export function isWeaponReady(
  weaponRuntime: WeaponJSON["runtime"]
): boolean {
  return weaponRuntime.state === "READY" && weaponRuntime.cooldownRemaining <= 0;
}

/**
 * 计算武器状态
 */
export function updateWeaponState(
  weaponRuntime: WeaponJSON["runtime"],
  fired: boolean
): WeaponJSON["runtime"] {
  const newState = { ...weaponRuntime };

  if (fired) {
    newState.state = "COOLDOWN";
    newState.cooldownRemaining = 1; // 简化：冷却1回合
  } else {
    if (newState.state === "COOLDOWN" && newState.cooldownRemaining > 0) {
      newState.cooldownRemaining = Math.max(0, newState.cooldownRemaining - 1);
      if (newState.cooldownRemaining === 0) {
        newState.state = "READY";
      }
    }
  }

  return newState;
}