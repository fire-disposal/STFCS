/**
 * 护甲相关定义和辅助函数
 * 
 * 提供护甲象限的常量、初始化、计算等工具
 */

import type { ArmorQuadrantValue, DamageTypeValue } from './enums.js';
import { ArmorQuadrant, ARMOR_QUADRANTS, DAMAGE_MODIFIERS } from './enums.js';
import type { ArmorInstanceState } from './interfaces.js';

// ==================== 象限映射 ====================

/** 象限中文名称 */
export const ARMOR_QUADRANT_NAMES: Record<ArmorQuadrantValue, string> = {
  FRONT_TOP: '前上方',
  FRONT_BOTTOM: '前下方',
  LEFT_TOP: '左上方',
  LEFT_BOTTOM: '左下方',
  RIGHT_TOP: '右上方',
  RIGHT_BOTTOM: '右下方',
};

/** 根据角度获取命中象限 */
export function getQuadrantFromAngle(hitAngle: number, targetHeading: number): ArmorQuadrantValue {
  const relativeAngle = ((hitAngle - targetHeading) % 360 + 360) % 360;
  
  // 简化映射：将360度分为6个象限
  // FRONT: 0-60, LEFT: 60-180, RIGHT: 300-360/0-60反向
  // 上半部分：相对角度 < 180
  // 下半部分：相对角度 >= 180
  
  if (relativeAngle >= 330 || relativeAngle < 30) {
    return ArmorQuadrant.FRONT_TOP;
  } else if (relativeAngle >= 30 && relativeAngle < 90) {
    return ArmorQuadrant.RIGHT_TOP;
  } else if (relativeAngle >= 90 && relativeAngle < 150) {
    return ArmorQuadrant.RIGHT_BOTTOM;
  } else if (relativeAngle >= 150 && relativeAngle < 210) {
    return ArmorQuadrant.LEFT_BOTTOM;
  } else if (relativeAngle >= 210 && relativeAngle < 270) {
    return ArmorQuadrant.LEFT_TOP;
  } else {
    return ArmorQuadrant.FRONT_BOTTOM;
  }
}

// ==================== 护甲初始化 ====================

/** 创建默认护甲状态 */
export function createDefaultArmorState(maxValue: number): ArmorInstanceState {
  const quadrants: Record<ArmorQuadrantValue, number> = {} as Record<ArmorQuadrantValue, number>;
  for (const q of ARMOR_QUADRANTS) {
    quadrants[q] = maxValue;
  }
  return { maxPerQuadrant: maxValue, quadrants };
}

/** 创建自定义分布的护甲状态 */
export function createArmorStateWithDistribution(
  maxValue: number,
  distribution: Partial<Record<ArmorQuadrantValue, number>>
): ArmorInstanceState {
  const quadrants: Record<ArmorQuadrantValue, number> = {} as Record<ArmorQuadrantValue, number>;
  for (const q of ARMOR_QUADRANTS) {
    quadrants[q] = distribution[q] ?? maxValue;
  }
  return { maxPerQuadrant: maxValue, quadrants };
}

/** 数组转换为护甲状态（兼容旧数据） */
export function arrayToArmorState(maxValue: number, array: number[]): ArmorInstanceState {
  if (array.length !== 6) {
    throw new Error(`护甲数组长度必须为6，实际为${array.length}`);
  }
  
  return {
    maxPerQuadrant: maxValue,
    quadrants: {
      [ArmorQuadrant.FRONT_TOP]: array[0] ?? maxValue,
      [ArmorQuadrant.FRONT_BOTTOM]: array[1] ?? maxValue,
      [ArmorQuadrant.LEFT_TOP]: array[2] ?? maxValue,
      [ArmorQuadrant.LEFT_BOTTOM]: array[3] ?? maxValue,
      [ArmorQuadrant.RIGHT_TOP]: array[4] ?? maxValue,
      [ArmorQuadrant.RIGHT_BOTTOM]: array[5] ?? maxValue,
    },
  };
}

/** 护甲状态转换为数组（兼容旧数据） */
export function armorStateToArray(state: ArmorInstanceState): number[] {
  return ARMOR_QUADRANTS.map(q => state.quadrants[q] ?? 0);
}

// ==================== 护甲伤害计算 ====================

/** 计算护甲伤害减免 */
export function calculateArmorDamageReduction(
  baseDamage: number,
  armorValue: number,
  damageType: DamageTypeValue
): number {
  if (armorValue <= 0) {
    return baseDamage;
  }
  
  const armorMultiplier = DAMAGE_MODIFIERS[damageType].armor;
  const hitStrength = baseDamage * armorMultiplier;
  const effectiveArmor = Math.max(armorValue * 0.05, armorValue);
  
  // 远行星号公式：实际伤害 = 基础伤害 * (穿透力 / (穿透力 + 护甲))
  const damageReduction = hitStrength / (hitStrength + effectiveArmor);
  
  return baseDamage * damageReduction;
}

/** 应用护甲伤害 */
export function applyArmorDamage(
  state: ArmorInstanceState,
  quadrant: ArmorQuadrantValue,
  damage: number,
  damageType: DamageTypeValue
): { armorDamage: number; hullDamage: number } {
  const currentArmor = state.quadrants[quadrant] ?? 0;
  const armorMultiplier = DAMAGE_MODIFIERS[damageType].armor;
  const armorDamage = Math.min(currentArmor, damage * armorMultiplier);
  
  state.quadrants[quadrant] = Math.max(0, currentArmor - armorDamage);
  
  // 剩余伤害传递到船体
  const hullDamage = calculateArmorDamageReduction(damage, currentArmor, damageType);
  
  return { armorDamage, hullDamage };
}

/** 检查护甲是否耗尽 */
export function isArmorDepleted(state: ArmorInstanceState): boolean {
  return ARMOR_QUADRANTS.every(q => state.quadrants[q] <= 0);
}

/** 获取护甲百分比 */
export function getArmorPercent(state: ArmorInstanceState, quadrant: ArmorQuadrantValue): number {
  return (state.quadrants[quadrant] ?? 0) / state.maxPerQuadrant * 100;
}

/** 获取平均护甲百分比 */
export function getAverageArmorPercent(state: ArmorInstanceState): number {
  const total = ARMOR_QUADRANTS.reduce((sum, q) => sum + (state.quadrants[q] ?? 0), 0);
  return (total / (state.maxPerQuadrant * 6)) * 100;
}

/** 修复护甲（恢复所有象限到最大值） */
export function repairArmor(state: ArmorInstanceState): void {
  for (const q of ARMOR_QUADRANTS) {
    state.quadrants[q] = state.maxPerQuadrant;
  }
}

/** 设置单个象限值 */
export function setArmorQuadrant(
  state: ArmorInstanceState,
  quadrant: ArmorQuadrantValue,
  value: number
): void {
  state.quadrants[quadrant] = Math.max(0, Math.min(state.maxPerQuadrant, value));
}