/**
 * 护甲计算规则
 */



/** 六象限护甲系统 */
export const ARMOR_QUADRANTS = [
  "FRONT_TOP",
  "FRONT_BOTTOM", 
  "RIGHT_TOP",
  "RIGHT_BOTTOM",
  "LEFT_TOP",
  "LEFT_BOTTOM",
] as const;

export type ArmorQuadrant = typeof ARMOR_QUADRANTS[number];

/** 获取指定象限的索引 */
export function getQuadrantIndex(quadrant: ArmorQuadrant): number {
  return ARMOR_QUADRANTS.indexOf(quadrant);
}

/** 根据攻击角度计算受击象限 */
export function calculateHitQuadrant(
  attackAngle: number, // 攻击方向角度（0-360度）
  targetHeading: number // 目标朝向角度（0-360度）
): number {
  // 计算相对角度
  const relativeAngle = ((attackAngle - targetHeading + 360) % 360);
  
  // 六象限划分：每60度一个象限
  return Math.floor(relativeAngle / 60) % 6;
}

/** 获取象限名称 */
export function getQuadrantName(index: number): ArmorQuadrant {
  return ARMOR_QUADRANTS[Math.max(0, Math.min(5, index))] ?? "FRONT_TOP";
}

/** 计算护甲值（考虑损坏） */
export function calculateEffectiveArmor(
  baseArmor: number,
  currentArmor: number,
  damageReduction: number = 0.5 // 护甲对伤害的减免系数
): number {
  const armorRatio = currentArmor / baseArmor;
  const effectiveness = Math.max(0.1, armorRatio); // 最低10%效果
  return baseArmor * effectiveness * damageReduction;
}

/** 计算护甲穿透 */
export function calculateArmorPenetration(
  attackDamage: number,
  armorHardness: number, // 护甲硬度
  penetrationFactor: number = 0.5 // 穿甲系数
): { armorDamage: number; remainingDamage: number } {
  const penetration = attackDamage * penetrationFactor;
  const armorDamage = Math.min(armorHardness, penetration);
  const remainingDamage = attackDamage - armorDamage;
  
  return { armorDamage, remainingDamage };
}

/** 计算护甲修复 */
export function calculateArmorRepair(
  currentArmor: number[],
  maxArmor: number,
  repairAmount: number,
  repairEfficiency: number = 1.0
): number[] {
  return currentArmor.map(armor => {
    const repairNeeded = maxArmor - armor;
    const actualRepair = Math.min(repairAmount * repairEfficiency, repairNeeded);
    return armor + actualRepair;
  });
}

/** 检查护甲是否被击穿 */
export function isArmorBreached(
  armorValue: number,
  _attackDamage: number,
  penetration: number
): boolean {
  return penetration > armorValue * 0.8; // 穿透超过80%护甲值视为击穿
}

/** 计算护甲扩散（伤害扩散到相邻象限） */
export function calculateArmorSpread(
  damage: number,
  hitQuadrant: number,
  spreadFactor: number = 0.3 // 30%伤害扩散
): Map<number, number> {
  const spread = new Map<number, number>();
  const spreadDamage = damage * spreadFactor;
  const mainDamage = damage - spreadDamage;
  
  // 主伤害
  spread.set(hitQuadrant, mainDamage);
  
  // 扩散到相邻象限
  const leftQuadrant = (hitQuadrant - 1 + 6) % 6;
  const rightQuadrant = (hitQuadrant + 1) % 6;
  
  spread.set(leftQuadrant, (spread.get(leftQuadrant) || 0) + spreadDamage / 2);
  spread.set(rightQuadrant, (spread.get(rightQuadrant) || 0) + spreadDamage / 2);
  
  return spread;
}