import { Point } from '../../types/geometry';
import { Weapon } from './Weapon';
import { Ship } from '../ship/Ship';
import { Shield } from '../ship/Shield';
import { ArmorQuadrantType } from '../ship/ArmorQuadrant';

export interface DamageCalculationInput {
  weapon: Weapon;
  sourceShip: Ship;
  targetShip: Ship;
  hitPosition: Point;
}

export interface DamageCalculationResult {
  hit: boolean;
  damage: number;
  shieldAbsorbed: number;
  armorReduced: number;
  hullDamage: number;
  hitQuadrant?: ArmorQuadrantType;
  softFluxGenerated: number;
  hardFluxGenerated: number;
}

export class DamageCalculator {
  private static readonly ARMOR_REDUCTION_FACTOR = 0.5;

  static calculateDistance(pos1: Point, pos2: Point): number {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static calculateAngle(from: Point, to: Point): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
    return ((angle + 360) % 360);
  }

  static isTargetInWeaponArc(
    weaponFacing: number,
    weaponArc: number,
    sourcePos: Point,
    targetPos: Point
  ): boolean {
    const targetAngle = this.calculateAngle(sourcePos, targetPos);
    return DamageCalculator.isAngleInArc(weaponFacing, weaponArc, targetAngle);
  }

  static isAngleInArc(facing: number, arc: number, targetAngle: number): boolean {
    const normalizedFacing = ((facing % 360) + 360) % 360;
    const normalizedTarget = ((targetAngle % 360) + 360) % 360;
    
    let angleDiff = Math.abs(normalizedTarget - normalizedFacing);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    return angleDiff <= arc / 2;
  }

  static determineHitQuadrant(hitPosition: Point, shipPosition: Point, shipHeading: number): ArmorQuadrantType {
    const localX = hitPosition.x - shipPosition.x;
    const localY = hitPosition.y - shipPosition.y;
    
    const headingRad = (shipHeading * Math.PI) / 180;
    const cosH = Math.cos(-headingRad);
    const sinH = Math.sin(-headingRad);
    
    const rotatedX = localX * cosH - localY * sinH;
    const rotatedY = localX * sinH + localY * cosH;
    
    const absRotatedX = Math.abs(rotatedX);
    const absRotatedY = Math.abs(rotatedY);
    
    const isFront = rotatedY > 0;
    const isLeft = rotatedX < 0;
    const isTop = rotatedY > absRotatedX;
    const isBottom = rotatedY < -absRotatedX;
    const isLeftSide = rotatedX < -absRotatedY;
    const isRightSide = rotatedX > absRotatedY;

    if (isFront) {
      return isLeft ? 'FRONT_TOP' : 'FRONT_BOTTOM';
    } else if (isLeft) {
      return isLeftSide ? 'LEFT_BOTTOM' : 'LEFT_TOP';
    } else {
      return isRightSide ? 'RIGHT_BOTTOM' : 'RIGHT_TOP';
    }
  }

  static calculateDamage(input: DamageCalculationInput): DamageCalculationResult {
    const { weapon, sourceShip, targetShip, hitPosition } = input;

    const distance = DamageCalculator.calculateDistance(
      sourceShip.position,
      targetShip.position
    );

    if (!weapon.isWithinRange(distance)) {
      return {
        hit: false,
        damage: 0,
        shieldAbsorbed: 0,
        armorReduced: 0,
        hullDamage: 0,
        softFluxGenerated: 0,
        hardFluxGenerated: 0,
      };
    }

    if (!DamageCalculator.isTargetInWeaponArc(
      sourceShip.heading,
      weapon.arc,
      sourceShip.position,
      targetShip.position
    )) {
      return {
        hit: false,
        damage: 0,
        shieldAbsorbed: 0,
        armorReduced: 0,
        hullDamage: 0,
        softFluxGenerated: 0,
        hardFluxGenerated: 0,
      };
    }

    const hitQuadrant = DamageCalculator.determineHitQuadrant(
      hitPosition,
      targetShip.position,
      targetShip.heading
    );

    let remainingDamage = weapon.damage;
    let shieldAbsorbed = 0;
    let hardFluxGenerated = 0;

    const shield = targetShip.shield;
    if (shield?.isActive) {
      const shieldAngle = shield.coverageAngle;
      const targetAngle = DamageCalculator.calculateAngle(
        targetShip.position,
        sourceShip.position
      );
      
      const shieldCenterAngle = shield.type === 'front' 
        ? targetShip.heading 
        : shield.centerOffset.x;

      if (DamageCalculator.isAngleInArc(shieldCenterAngle, shieldAngle, targetAngle)) {
        shieldAbsorbed = remainingDamage * shield.efficiency;
        remainingDamage = remainingDamage * (1 - shield.efficiency);
        hardFluxGenerated = shieldAbsorbed * shield.efficiency;
      }
    }

    const armorQuadrant = targetShip.getArmorQuadrant(hitQuadrant);
    let armorReduced = 0;
    let hullDamage = 0;

    if (armorQuadrant) {
      const armorValue = armorQuadrant.value;
      const armorReduction = Math.min(
        armorValue,
        remainingDamage * DamageCalculator.ARMOR_REDUCTION_FACTOR
      );
      
      armorReduced = armorReduction;
      hullDamage = remainingDamage - armorReduction;
    } else {
      hullDamage = remainingDamage;
    }

    const softFluxGenerated = weapon.fluxCost;

    return {
      hit: true,
      damage: weapon.damage,
      shieldAbsorbed,
      armorReduced,
      hullDamage,
      hitQuadrant,
      softFluxGenerated,
      hardFluxGenerated,
    };
  }
}
