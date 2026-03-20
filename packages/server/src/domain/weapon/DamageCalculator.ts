/**
 * 伤害计算器
 *
 * 实现基于 Starsector 的伤害计算公式：
 * 1. 护盾阶段：伤害 * 效率 * 伤害类型修正
 * 2. 护甲阶段：伤害 * 穿甲 / (穿甲 + 护甲值)，最大减伤 85%，最小伤害 15%
 * 3. 船体阶段：剩余伤害直接扣除船体HP
 *
 * 伤害类型修正：
 * - KINETIC: 护盾 x2.0, 护甲 x0.5, 穿甲 x0.5
 * - HIGH_EXPLOSIVE: 护盾 x0.5, 护甲 x2.0, 穿甲 x2.0
 * - FRAGMENTATION: 护盾 x0.25, 护甲 x0.25, 穿甲 x0.25
 * - ENERGY: 护盾 x1.0, 护甲 x1.0, 穿甲 x1.0
 */

import type { Point } from '../../types/geometry';
import type { Ship } from '../ship/Ship';
import type { Shield } from '../ship/Shield';
import type { ArmorQuadrant } from '../ship/ArmorQuadrant';
import type { Weapon } from './Weapon';
import type { ArmorQuadrant as ArmorQuadrantType } from '@vt/shared/types';
import {
  DAMAGE_MODIFIERS,
  MAX_DAMAGE_REDUCTION,
  MIN_DAMAGE_RATIO,
  type DamageDealtEvent,
} from '@vt/shared/protocol';

// ==================== 类型定义 ====================

/** 伤害类型 */
export type DamageType = 'KINETIC' | 'HIGH_EXPLOSIVE' | 'FRAGMENTATION' | 'ENERGY';

/** 伤害计算输入 */
export interface DamageCalculationInput {
  weapon: Weapon;
  weaponDamageType: DamageType;
  sourceShip: Ship;
  targetShip: Ship;
  hitPosition: Point;
  selectedQuadrant?: ArmorQuadrantType;
}

/** 伤害计算结果 */
export interface DamageCalculationResult {
  hit: boolean;
  damage: number;
  shieldAbsorbed: number;
  armorReduced: number;
  hullDamage: number;
  empDamage: number;
  hitQuadrant?: ArmorQuadrantType;
  softFluxGenerated: number;
  hardFluxGenerated: number;
}

/** 攻击预览结果 */
export interface AttackPreviewData {
  canAttack: boolean;
  baseDamage: number;
  estimatedShieldAbsorb: number;
  estimatedArmorReduction: number;
  estimatedHullDamage: number;
  hitQuadrant: ArmorQuadrantType;
  fluxCost: number;
  willGenerateHardFlux: boolean;
  estimatedHardFlux?: number;
  blockReason?: AttackBlockReason;
}

/** 攻击阻止原因 */
export type AttackBlockReason =
  | 'OUT_OF_RANGE'
  | 'NOT_IN_ARC'
  | 'WEAPON_NOT_READY'
  | 'NOT_ENOUGH_FLUX_CAPACITY'
  | 'TARGET_IS_ALLY'
  | 'SHIP_IS_OVERLOADED'
  | 'SHIP_IS_VENTING'
  | 'ALREADY_FIRED_THIS_TURN';

// ==================== 伤害计算器类 ====================

export class DamageCalculator {
  // 常量
  private static readonly EPSILON = 0.001;

  /**
   * 计算两点间距离
   */
  static calculateDistance(pos1: Point, pos2: Point): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算从一点到另一点的角度
   */
  static calculateAngle(from: Point, to: Point): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    return ((angle + 360) % 360);
  }

  /**
   * 检查目标是否在武器射界内
   */
  static isTargetInWeaponArc(
    weaponFacing: number,
    weaponArc: number,
    sourcePos: Point,
    targetPos: Point
  ): boolean {
    const targetAngle = this.calculateAngle(sourcePos, targetPos);
    return DamageCalculator.isAngleInArc(weaponFacing, weaponArc, targetAngle);
  }

  /**
   * 检查角度是否在射界内
   */
  static isAngleInArc(facing: number, arc: number, targetAngle: number): boolean {
    const normalizedFacing = ((facing % 360) + 360) % 360;
    const normalizedTarget = ((targetAngle % 360) + 360) % 360;

    let angleDiff = Math.abs(normalizedTarget - normalizedFacing);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    return angleDiff <= arc / 2;
  }

  /**
   * 确定命中象限
   */
  static determineHitQuadrant(
    hitPosition: Point,
    shipPosition: Point,
    shipHeading: number
  ): ArmorQuadrantType {
    // 计算命中点相对于舰船中心的局部坐标
    const localX = hitPosition.x - shipPosition.x;
    const localY = hitPosition.y - shipPosition.y;

    // 旋转到舰船坐标系
    const headingRad = (shipHeading * Math.PI) / 180;
    const cosH = Math.cos(-headingRad);
    const sinH = Math.sin(-headingRad);

    const rotatedX = localX * cosH - localY * sinH;
    const rotatedY = localX * sinH + localY * cosH;

    // 根据角度确定象限
    // 前方: -60 到 60 度
    // 左侧: 60 到 180 度
    // 右侧: -180 到 -60 度
    const absRotatedX = Math.abs(rotatedX);
    const absRotatedY = Math.abs(rotatedY);

    // 判断上下（Y轴正方向为前方）
    const isTop = rotatedY > 0;

    // 根据X和Y的关系判断象限
    if (absRotatedY >= absRotatedX) {
      // 前方或后方
      if (isTop) {
        return rotatedX >= 0 ? 'FRONT_TOP' : 'FRONT_BOTTOM';
      } else {
        // 后方映射到侧后方
        return rotatedX >= 0 ? 'RIGHT_BOTTOM' : 'LEFT_BOTTOM';
      }
    } else {
      // 左侧或右侧
      if (rotatedX < 0) {
        return isTop ? 'LEFT_TOP' : 'LEFT_BOTTOM';
      } else {
        return isTop ? 'RIGHT_TOP' : 'RIGHT_BOTTOM';
      }
    }
  }

  /**
   * 获取伤害类型修正系数
   */
  static getDamageModifiers(damageType: DamageType) {
    return DAMAGE_MODIFIERS[damageType] ?? DAMAGE_MODIFIERS.ENERGY;
  }

  /**
   * 计算护甲减伤
   */
  static calculateArmorDamageReduction(
    armorValue: number,
    incomingDamage: number,
    armorPenetration: number
  ): number {
    const effectiveDamage = incomingDamage * armorPenetration;
    const effectiveArmor = Math.max(armorValue, incomingDamage * MIN_DAMAGE_RATIO);

    // Starsector 护甲伤害减免公式
    // 减伤比例 = armor / (armor + damage * penetration)
    const reduction = effectiveArmor / (effectiveArmor + effectiveDamage);

    // 最大减伤限制
    return Math.min(reduction, MAX_DAMAGE_REDUCTION);
  }

  /**
   * 计算完整伤害
   */
  static calculateDamage(input: DamageCalculationInput): DamageCalculationResult {
    const { weapon, weaponDamageType, sourceShip, targetShip, hitPosition, selectedQuadrant } = input;

    // 1. 检查射程
    const distance = this.calculateDistance(sourceShip.position, targetShip.position);
    if (!weapon.isWithinRange(distance)) {
      return this._createMissResult();
    }

    // 2. 检查射界
    if (!this.isTargetInWeaponArc(
      sourceShip.heading,
      weapon.arc,
      sourceShip.position,
      targetShip.position
    )) {
      return this._createMissResult();
    }

    // 3. 获取伤害类型修正
    const modifiers = this.getDamageModifiers(weaponDamageType);
    const baseDamage = weapon.damage;

    // 4. 护盾阶段
    let remainingDamage = baseDamage;
    let shieldAbsorbed = 0;
    let hardFluxGenerated = 0;

    const shield = targetShip.shield;
    if (shield?.isActive && this._isHitOnShield(sourceShip, targetShip, shield)) {
      const shieldDamage = baseDamage * modifiers.shield * shield.efficiency;
      shieldAbsorbed = Math.min(shieldDamage, remainingDamage * modifiers.shield);
      hardFluxGenerated = shieldAbsorbed * shield.efficiency;
      remainingDamage = Math.max(0, remainingDamage - shieldAbsorbed / modifiers.shield);
    }

    // 5. 确定命中象限
    const hitQuadrant = selectedQuadrant ?? this.determineHitQuadrant(
      hitPosition,
      targetShip.position,
      targetShip.heading
    );

    // 6. 护甲阶段
    let armorReduced = 0;
    let hullDamage = 0;

    if (remainingDamage > this.EPSILON) {
      const armorQuadrant = targetShip.getArmorQuadrant(hitQuadrant);

      if (armorQuadrant && armorQuadrant.value > 0) {
        const armorValue = armorQuadrant.value;
        const armorPenetration = modifiers.armorPenetration;

        // 计算护甲减伤
        const reductionRatio = this.calculateArmorDamageReduction(
          armorValue,
          baseDamage,
          armorPenetration
        );

        // 计算实际伤害
        const effectiveDamage = baseDamage * (1 - reductionRatio);

        // 护甲伤害修正
        const armorDamage = effectiveDamage * modifiers.armor;

        // 护甲吸收部分伤害
        armorReduced = Math.min(armorValue, armorDamage * 0.5);
        hullDamage = Math.max(0, effectiveDamage - armorReduced);
        remainingDamage = 0;
      } else {
        // 无护甲，直接造成船体伤害
        hullDamage = remainingDamage * modifiers.hull;
        remainingDamage = 0;
      }
    }

    // 7. 辐能计算
    const softFluxGenerated = weapon.fluxCost;

    return {
      hit: true,
      damage: baseDamage,
      shieldAbsorbed,
      armorReduced,
      hullDamage,
      empDamage: 0, // TODO: 实现EMP伤害
      hitQuadrant,
      softFluxGenerated,
      hardFluxGenerated,
    };
  }

  /**
   * 预览攻击结果
   */
  static previewAttack(input: DamageCalculationInput): AttackPreviewData {
    const { weapon, weaponDamageType, sourceShip, targetShip, selectedQuadrant } = input;

    // 检查射程
    const distance = this.calculateDistance(sourceShip.position, targetShip.position);
    if (!weapon.isWithinRange(distance)) {
      return {
        canAttack: false,
        baseDamage: weapon.damage,
        estimatedShieldAbsorb: 0,
        estimatedArmorReduction: 0,
        estimatedHullDamage: 0,
        hitQuadrant: 'FRONT_TOP',
        fluxCost: weapon.fluxCost,
        willGenerateHardFlux: false,
        blockReason: 'OUT_OF_RANGE',
      };
    }

    // 检查射界
    if (!this.isTargetInWeaponArc(
      sourceShip.heading,
      weapon.arc,
      sourceShip.position,
      targetShip.position
    )) {
      return {
        canAttack: false,
        baseDamage: weapon.damage,
        estimatedShieldAbsorb: 0,
        estimatedArmorReduction: 0,
        estimatedHullDamage: 0,
        hitQuadrant: 'FRONT_TOP',
        fluxCost: weapon.fluxCost,
        willGenerateHardFlux: false,
        blockReason: 'NOT_IN_ARC',
      };
    }

    // 计算预览数据
    const modifiers = this.getDamageModifiers(weaponDamageType);
    const baseDamage = weapon.damage;

    // 确定命中象限
    const hitQuadrant = selectedQuadrant ?? this.determineHitQuadrant(
      targetShip.position,
      targetShip.position,
      targetShip.heading
    );

    // 估算护盾吸收
    let estimatedShieldAbsorb = 0;
    let willGenerateHardFlux = false;
    const shield = targetShip.shield;
    if (shield?.isActive) {
      estimatedShieldAbsorb = baseDamage * modifiers.shield * shield.efficiency;
      willGenerateHardFlux = true;
    }

    // 估算护甲减免
    const armorQuadrant = targetShip.getArmorQuadrant(hitQuadrant);
    let estimatedArmorReduction = 0;
    if (armorQuadrant && armorQuadrant.value > 0) {
      const reductionRatio = this.calculateArmorDamageReduction(
        armorQuadrant.value,
        baseDamage,
        modifiers.armorPenetration
      );
      estimatedArmorReduction = baseDamage * reductionRatio;
    }

    // 估算船体伤害
    const estimatedHullDamage = Math.max(0,
      (baseDamage - estimatedShieldAbsorb / modifiers.shield) * (1 - estimatedArmorReduction / baseDamage)
    );

    return {
      canAttack: true,
      baseDamage,
      estimatedShieldAbsorb,
      estimatedArmorReduction,
      estimatedHullDamage,
      hitQuadrant,
      fluxCost: weapon.fluxCost,
      willGenerateHardFlux,
      estimatedHardFlux: willGenerateHardFlux ? estimatedShieldAbsorb * (shield?.efficiency ?? 1) : undefined,
    };
  }

  /**
   * 检查命中是否在护盾上
   */
  private static _isHitOnShield(
    sourceShip: Ship,
    targetShip: Ship,
    shield: Shield
  ): boolean {
    // 计算攻击方向
    const attackAngle = this.calculateAngle(targetShip.position, sourceShip.position);

    // 计算护盾覆盖范围
    const shieldCenterAngle = shield.type === 'FRONT'
      ? targetShip.heading
      : (shield as any).facing ?? targetShip.heading;

    // 检查攻击方向是否在护盾覆盖范围内
    return this.isAngleInArc(shieldCenterAngle, shield.coverageAngle, attackAngle);
  }

  /**
   * 创建未命中结果
   */
  private static _createMissResult(): DamageCalculationResult {
    return {
      hit: false,
      damage: 0,
      shieldAbsorbed: 0,
      armorReduced: 0,
      hullDamage: 0,
      empDamage: 0,
      hitQuadrant: undefined,
      softFluxGenerated: 0,
      hardFluxGenerated: 0,
    };
  }

  /**
   * 创建伤害事件
   */
  static createDamageEvent(
    sourceId: string,
    targetId: string,
    weaponInstanceId: string,
    weaponId: string,
    damageType: DamageType,
    result: DamageCalculationResult
  ): DamageDealtEvent {
    return {
      sourceId,
      targetId,
      weaponInstanceId,
      weaponId,
      damageType,
      hit: result.hit,
      baseDamage: result.damage,
      shieldAbsorbed: result.shieldAbsorbed,
      armorReduced: result.armorReduced,
      hullDamage: result.hullDamage,
      hitQuadrant: result.hitQuadrant,
      timestamp: Date.now(),
    };
  }
}