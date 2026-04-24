/**
 * 象限计算模块
 * 基于六象限护甲系统设计
 * 
 * 航海坐标系：
 * - 0° = 船头（屏幕上方）
 * - 90° = 右舷（屏幕右侧）
 * - 顺时针增加
 */

import type { Point } from "@vt/data";
import { normalizeAngle } from "@vt/data";

/**
 * 六象限定义（航海坐标系）
 * - 0-60°: FRONT (前上/前下)
 * - 60-120°: RIGHT (右上/右下)
 * - 120-180°: RIGHT_BOTTOM 继续到后右
 * - 180-240°: 后方区域
 * - 240-300°: LEFT (左上/左下)
 * - 300-360°: LEFT 继续到前左
 */
export const QUADRANTS = [
  "FRONT_TOP",     // 0: 前上（相对角度 0-60°）
  "FRONT_BOTTOM",  // 1: 前下（相对角度 60-120°，实际是右前）
  "RIGHT_TOP",     // 2: 右上（相对角度 120-180°）
  "RIGHT_BOTTOM",  // 3: 右下（相对角度 180-240°）
  "LEFT_TOP",      // 4: 左上（相对角度 240-300°）
  "LEFT_BOTTOM",   // 5: 左下（相对角度 300-360°）
] as const;

export type Quadrant = typeof QUADRANTS[number];

/**
 * 获取象限索引
 */
export function getQuadrantIndex(quadrant: Quadrant): number {
	return QUADRANTS.indexOf(quadrant);
}

/**
 * 获取象限名称
 */
export function getQuadrantName(index: number): Quadrant {
	return QUADRANTS[Math.max(0, Math.min(5, index))] ?? "FRONT_TOP";
}

/**
 * 根据攻击角度计算受击象限
 * 
 * @param attackAngle 攻击方向角度（航海角度，0°=船头/上，90°=右舷/右）
 * @param targetHeading 目标朝向角度（航海角度）
 * @returns 象限索引（0-5）
 * 
 * 计算方式：
 * - 相对角度 = attackAngle - targetHeading（归一化到0-360）
 * - 每60度一个象限，顺时针划分
 */
export function calculateHitQuadrant(
	attackAngle: number,
	targetHeading: number
): number {
	const relativeAngle = normalizeAngle(attackAngle - targetHeading);
	const quadrant = Math.floor(relativeAngle / 60) % 6;
	return quadrant;
}

/**
 * 计算攻击是否命中指定象限
 */
export function isAttackInQuadrant(
  attackAngle: number,
  targetHeading: number,
  targetQuadrant: number
): boolean {
  const hitQuadrant = calculateHitQuadrant(attackAngle, targetHeading);
  return hitQuadrant === targetQuadrant;
}

/**
 * 获取象限的边界角度范围
 */
export function getQuadrantAngleRange(quadrant: number): { start: number; end: number } {
  const start = quadrant * 60;
  const end = (quadrant + 1) * 60;
  return { start, end };
}

/**
 * 检查角度是否在象限内
 */
export function isAngleInQuadrant(
  angle: number,
  quadrant: number
): boolean {
  const { start, end } = getQuadrantAngleRange(quadrant);
  const normalizedAngle = normalizeAngle(angle);
  
  if (end > 360) {
    // 处理跨越360度的情况
    return normalizedAngle >= start || normalizedAngle < end % 360;
  }
  
  return normalizedAngle >= start && normalizedAngle < end;
}

/**
 * 获取相邻象限
 */
export function getAdjacentQuadrants(quadrant: number): number[] {
  const left = (quadrant - 1 + 6) % 6;
  const right = (quadrant + 1) % 6;
  return [left, right];
}

/**
 * 计算伤害扩散
 */
export function calculateDamageSpread(
  damage: number,
  hitQuadrant: number,
  spreadFactor: number = 0.3
): Map<number, number> {
  const spread = new Map<number, number>();
  const spreadDamage = damage * spreadFactor;
  const mainDamage = damage - spreadDamage;
  
  // 主伤害
  spread.set(hitQuadrant, mainDamage);
  
  // 扩散到相邻象限
  const adjacentQuadrants = getAdjacentQuadrants(hitQuadrant);
  for (const quadrant of adjacentQuadrants) {
    spread.set(quadrant, (spread.get(quadrant) || 0) + spreadDamage / 2);
  }
  
  return spread;
}

/**
 * 计算象限权重（用于AI目标选择）
 */
export function calculateQuadrantWeights(
  armorValues: number[]
): Map<number, number> {
  const weights = new Map<number, number>();
  const totalArmor = armorValues.reduce((sum, armor) => sum + armor, 0);
  
  for (let i = 0; i < armorValues.length; i++) {
    // 护甲越低，权重越高（更容易击穿）
    const armorValue = armorValues[i] ?? 0;
    const armorRatio = armorValue / (totalArmor || 1);
    const weight = 1.0 - armorRatio;
    weights.set(i, weight);
  }
  
  return weights;
}

/**
 * 获取最佳攻击象限
 */
export function getBestAttackQuadrant(
  armorValues: number[],
  excludeQuadrants: number[] = []
): number {
  let bestQuadrant = 0;
  let lowestArmor = Infinity;
  
  for (let i = 0; i < armorValues.length; i++) {
    if (excludeQuadrants.includes(i)) continue;
    
    const armorValue = armorValues[i] ?? Infinity;
    if (armorValue < lowestArmor) {
      lowestArmor = armorValue;
      bestQuadrant = i;
    }
  }
  
  return bestQuadrant;
}

/**
 * 计算象限可见性（考虑障碍物）
 */
export function calculateQuadrantVisibility(
  _attackerPosition: Point,
  _targetPosition: Point,
  _targetHeading: number,
  _obstacles: any[] = []
): boolean[] {
  const visibility = Array(6).fill(true);
  // const attackAngle = angleBetween(attackerPosition, targetPosition);
  // const hitQuadrant = calculateHitQuadrant(attackAngle, targetHeading);
  
  // 简化：只检查命中象限是否被障碍物阻挡
  // TODO: 实现实际的视线检查
  
  return visibility;
}

/**
 * 获取象限描述
 */
export function getQuadrantDescription(quadrant: number): string {
  const names = [
    "前上象限",
    "前下象限", 
    "右上象限",
    "右下象限",
    "左上象限",
    "左下象限",
  ];
  
  return names[quadrant] || "未知象限";
}