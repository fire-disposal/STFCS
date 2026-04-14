/**
 * 伤害计算模块
 *
 * 统一处理护盾、护甲、船体的伤害计算
 * 服务端和客户端均可使用
 */

import { DAMAGE_MODIFIERS } from "@vt/data";
import type { DamageTypeValue } from "@vt/types";

export interface DamageResult {
	hitShield: boolean;
	hitArmor: boolean;
	shieldDamage: number;
	armorDamage: number;
	hullDamage: number;
	armorQuadrantIndex: number;
	fluxGenerated: number;
}

export interface ShieldDamageResult {
	damage: number;
	fluxGenerated: number;
	causedOverload: boolean;
}

export interface ArmorDamageResult {
	armorDamage: number;
	hullDamage: number;
	quadrantIndex: number;
}

export interface HullDamageResult {
	damage: number;
	isDestroyed: boolean;
}

export function calculateShieldDamage(
	baseDamage: number,
	damageType: DamageTypeValue,
	fluxPerDamage: number = 1
): ShieldDamageResult {
	const shieldMultiplier = DAMAGE_MODIFIERS[damageType].shield;
	const shieldDamage = baseDamage * shieldMultiplier;
	const fluxGenerated = shieldDamage * fluxPerDamage;

	return {
		damage: shieldDamage,
		fluxGenerated,
		causedOverload: false,
	};
}

export function checkShieldHit(
	shieldActive: boolean,
	shieldOrientation: number,
	shieldArc: number,
	hitAngle: number,
	weaponIgnoresShields: boolean = false
): boolean {
	if (!shieldActive || weaponIgnoresShields) {
		return false;
	}

	const angleDiff = Math.abs(hitAngle - shieldOrientation);
	const normalizedDiff = angleDiff > 180 ? 360 - angleDiff : angleDiff;

	return normalizedDiff <= shieldArc / 2;
}

export function calculateArmorAndHullDamage(
	baseDamage: number,
	damageType: DamageTypeValue,
	currentArmor: number,
	armorQuadrantIndex: number
): ArmorDamageResult {
	const armorMultiplier = DAMAGE_MODIFIERS[damageType].armor;
	const hullMultiplier = DAMAGE_MODIFIERS[damageType].hull;

	if (currentArmor <= 0) {
		return {
			armorDamage: 0,
			hullDamage: baseDamage * hullMultiplier,
			quadrantIndex: armorQuadrantIndex,
		};
	}

	const hitStrength = baseDamage * armorMultiplier;
	const effectiveArmor = Math.max(currentArmor * 0.05, currentArmor);
	const damageReduction = hitStrength / (hitStrength + effectiveArmor);
	const armorDamage = Math.min(currentArmor, baseDamage * armorMultiplier);
	const hullDamage = baseDamage * hullMultiplier * (1 - damageReduction);

	return {
		armorDamage,
		hullDamage,
		quadrantIndex: armorQuadrantIndex,
	};
}

export function calculateFullDamage(
	baseDamage: number,
	damageType: DamageTypeValue,
	targetHeading: number,
	attackerX: number,
	attackerY: number,
	targetX: number,
	targetY: number,
	shieldState: {
		active: boolean;
		orientation: number;
		arc: number;
		currentFlux: number;
		maxFlux: number;
	},
	armorState: {
		values: number[];
		maxPerQuadrant: number;
	},
	hullState: {
		current: number;
		max: number;
	},
	options: {
		ignoresShields?: boolean;
		shieldFluxPerDamage?: number;
	}
): DamageResult {
	const hitAngle = (Math.atan2(targetY - attackerY, targetX - attackerX) * 180) / Math.PI;
	const normalizedHitAngle = ((hitAngle % 360) + 360) % 360;

	const relativeAngle = normalizedHitAngle - targetHeading;
	const normalizedRelative = ((relativeAngle % 360) + 360) % 360;
	const quadrantIndex = Math.floor(normalizedRelative / 60) % 6;

	let hitShield = false;
	let shieldDamage = 0;
	let fluxGenerated = 0;
	let armorDamage = 0;
	let hullDamage = 0;

	if (
		checkShieldHit(
			shieldState.active,
			shieldState.orientation,
			shieldState.arc,
			normalizedHitAngle,
			options.ignoresShields
		)
	) {
		hitShield = true;
		const shieldResult = calculateShieldDamage(
			baseDamage,
			damageType,
			options.shieldFluxPerDamage ?? 1
		);
		shieldDamage = shieldResult.damage;
		fluxGenerated = shieldResult.fluxGenerated;
	} else {
		const currentArmor = armorState.values[quadrantIndex];
		const armorResult = calculateArmorAndHullDamage(
			baseDamage,
			damageType,
			currentArmor,
			quadrantIndex
		);
		armorDamage = armorResult.armorDamage;
		hullDamage = armorResult.hullDamage;
	}

	return {
		hitShield,
		hitArmor: !hitShield,
		shieldDamage,
		armorDamage,
		hullDamage,
		armorQuadrantIndex: quadrantIndex,
		fluxGenerated,
	};
}

export function applyDamageToShield(
	currentHardFlux: number,
	currentSoftFlux: number,
	maxFlux: number,
	damage: number,
	fluxGenerated: number
): {
	newHardFlux: number;
	newSoftFlux: number;
	totalFlux: number;
	isOverloaded: boolean;
} {
	const newHardFlux = currentHardFlux + fluxGenerated;
	const totalFlux = newHardFlux + currentSoftFlux;
	const isOverloaded = totalFlux >= maxFlux;

	return {
		newHardFlux,
		newSoftFlux,
		totalFlux,
		isOverloaded,
	};
}

export function applyDamageToArmor(
	armorValues: number[],
	quadrantIndex: number,
	armorDamage: number
): number[] {
	const newValues = [...armorValues];
	newValues[quadrantIndex] = Math.max(0, newValues[quadrantIndex] - armorDamage);
	return newValues;
}

export function applyDamageToHull(
	currentHull: number,
	hullDamage: number,
	maxHull: number
): HullDamageResult {
	const newHull = Math.max(0, currentHull - hullDamage);
	const isDestroyed = newHull <= 0;

	return {
		damage: hullDamage,
		isDestroyed,
	};
}

export function calculateWeaponHitChance(
	attackerX: number,
	attackerY: number,
	attackerHeading: number,
	weaponMountFacing: number,
	weaponArcMin: number,
	weaponArcMax: number,
	weaponRange: number,
	targetX: number,
	targetY: number
): { inRange: boolean; inArc: boolean; distance: number; angleToTarget: number } {
	const distance = Math.sqrt(Math.pow(targetX - attackerX, 2) + Math.pow(targetY - attackerY, 2));

	const angleToTarget = (Math.atan2(targetY - attackerY, targetX - attackerX) * 180) / Math.PI;
	const normalizedAngleToTarget = ((angleToTarget % 360) + 360) % 360;

	const weaponWorldAngle = attackerHeading + weaponMountFacing;
	const normalizedWeaponAngle = ((weaponWorldAngle % 360) + 360) % 360;

	const arcCenter = (weaponArcMin + weaponArcMax) / 2;
	const arcHalfWidth = (weaponArcMax - weaponArcMin) / 2;

	let angleDiff = normalizedAngleToTarget - arcCenter;
	if (angleDiff > 180) angleDiff -= 360;
	if (angleDiff < -180) angleDiff += 360;

	const inRange = distance <= weaponRange;
	const inArc = Math.abs(angleDiff) <= arcHalfWidth;

	return {
		inRange,
		inArc,
		distance,
		angleToTarget: normalizedAngleToTarget,
	};
}
