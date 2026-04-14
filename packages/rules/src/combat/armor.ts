/**
 * 护甲计算工具
 *
 * 提供护甲象限的计算、伤害减免等工具函数
 * 6象限系统：前上、前下、右上、右下、左上、左下
 */

import { DAMAGE_MODIFIERS } from "@vt/data";
import type { ArmorQuadrantValue, DamageTypeValue } from "@vt/types";
import { ARMOR_QUADRANTS, ArmorQuadrant } from "@vt/types";

export const ARMOR_QUADRANT_NAMES: Record<ArmorQuadrantValue, string> = {
	FRONT_TOP: "前上方",
	FRONT_BOTTOM: "前下方",
	LEFT_TOP: "左上方",
	LEFT_BOTTOM: "左下方",
	RIGHT_TOP: "右上方",
	RIGHT_BOTTOM: "右下方",
};

export const QUADRANT_INDEX_MAP: Record<ArmorQuadrantValue, number> = {
	FRONT_TOP: 0,
	FRONT_BOTTOM: 1,
	LEFT_TOP: 2,
	LEFT_BOTTOM: 3,
	RIGHT_TOP: 4,
	RIGHT_BOTTOM: 5,
};

export const INDEX_TO_QUADRANT: ArmorQuadrantValue[] = [
	ArmorQuadrant.FRONT_TOP,
	ArmorQuadrant.FRONT_BOTTOM,
	ArmorQuadrant.LEFT_TOP,
	ArmorQuadrant.LEFT_BOTTOM,
	ArmorQuadrant.RIGHT_TOP,
	ArmorQuadrant.RIGHT_BOTTOM,
];

export function quadrantToIndex(quadrant: ArmorQuadrantValue): number {
	return QUADRANT_INDEX_MAP[quadrant];
}

export function indexToQuadrant(index: number): ArmorQuadrantValue {
	if (index < 0 || index >= 6) {
		throw new Error(`象限索引必须在 0-5 之间，实际为 ${index}`);
	}
	return INDEX_TO_QUADRANT[index];
}

export function getQuadrantFromAngle(hitAngle: number, targetHeading: number): ArmorQuadrantValue {
	const relativeAngle = (((hitAngle - targetHeading) % 360) + 360) % 360;

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

export function getQuadrantIndexFromAngle(hitAngle: number, targetHeading: number): number {
	return quadrantToIndex(getQuadrantFromAngle(hitAngle, targetHeading));
}

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

	const damageReduction = hitStrength / (hitStrength + effectiveArmor);

	return baseDamage * damageReduction;
}

export function applyArmorDamage(
	currentArmor: number,
	damage: number,
	damageType: DamageTypeValue
): { armorDamage: number; hullDamage: number } {
	const armorMultiplier = DAMAGE_MODIFIERS[damageType].armor;
	const armorDamage = Math.min(currentArmor, damage * armorMultiplier);

	const newArmor = Math.max(0, currentArmor - armorDamage);
	const actualArmorDamage = currentArmor - newArmor;

	const hullDamage = calculateArmorDamageReduction(damage, currentArmor, damageType);

	return { armorDamage: actualArmorDamage, hullDamage };
}

export function isArmorDepleted(armorValues: number[]): boolean {
	return armorValues.every((v) => v <= 0);
}

export function getArmorPercent(current: number, max: number): number {
	return (current / max) * 100;
}

export function getAverageArmorPercent(armorValues: number[], maxPerQuadrant: number): number {
	const total = armorValues.reduce((sum, v) => sum + v, 0);
	return (total / (maxPerQuadrant * 6)) * 100;
}

export function repairArmor(maxValues: number[]): number[] {
	return [...maxValues];
}

export function setArmorQuadrant(
	armorValues: number[],
	quadrantIndex: number,
	value: number
): number[] {
	if (quadrantIndex < 0 || quadrantIndex >= 6) {
		throw new Error(`象限索引必须在 0-5 之间，实际为 ${quadrantIndex}`);
	}

	const newValue = Math.max(0, value);
	const newArray = [...armorValues];
	newArray[quadrantIndex] = newValue;
	return newArray;
}

export function createDefaultArmorState(maxPerQuadrant: number): number[] {
	return Array(6).fill(maxPerQuadrant);
}

export function createArmorStateWithDistribution(
	maxArmor: number,
	distribution: number[]
): number[] {
	if (distribution.length !== 6) {
		throw new Error("分布数组必须有 6 个元素");
	}
	return distribution.map((v) => Math.max(0, Math.min(maxArmor, v)));
}

export function arrayToArmorState(values: number[]): Record<ArmorQuadrantValue, number> {
	if (values.length !== 6) {
		throw new Error("护甲值数组必须有 6 个元素");
	}

	return {
		[ArmorQuadrant.FRONT_TOP]: values[0],
		[ArmorQuadrant.FRONT_BOTTOM]: values[1],
		[ArmorQuadrant.LEFT_TOP]: values[2],
		[ArmorQuadrant.LEFT_BOTTOM]: values[3],
		[ArmorQuadrant.RIGHT_TOP]: values[4],
		[ArmorQuadrant.RIGHT_BOTTOM]: values[5],
	};
}

export function armorStateToArray(state: Record<ArmorQuadrantValue, number>): number[] {
	return ARMOR_QUADRANTS.map((q) => state[q] ?? 0);
}

export function getArmorQuadrantValue(armorValues: number[], quadrant: ArmorQuadrantValue): number {
	return armorValues[quadrantToIndex(quadrant)];
}

export function takeDamageOnQuadrant(
	armorValues: number[],
	quadrantIndex: number,
	damage: number
): { newArmorValues: number[]; actualDamage: number } {
	const currentArmor = armorValues[quadrantIndex];
	const actualDamage = Math.min(currentArmor, damage);

	const newArmorValues = [...armorValues];
	newArmorValues[quadrantIndex] = Math.max(0, currentArmor - actualDamage);

	return { newArmorValues, actualDamage };
}

export function getWeakestQuadrant(armorValues: number[]): { index: number; value: number } {
	let minIndex = 0;
	let minValue = armorValues[0];

	for (let i = 1; i < armorValues.length; i++) {
		if (armorValues[i] < minValue) {
			minIndex = i;
			minValue = armorValues[i];
		}
	}

	return { index: minIndex, value: minValue };
}

export function getStrongestQuadrant(armorValues: number[]): { index: number; value: number } {
	let maxIndex = 0;
	let maxValue = armorValues[0];

	for (let i = 1; i < armorValues.length; i++) {
		if (armorValues[i] > maxValue) {
			maxIndex = i;
			maxValue = armorValues[i];
		}
	}

	return { index: maxIndex, value: maxValue };
}
