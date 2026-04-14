/**
 * 预设武器数据
 */

import type { WeaponSpec } from "@vt/types";

export type { WeaponSpec };

export const PRESET_WEAPONS: Record<string, WeaponSpec> = {
	autocannon: {
		id: "autocannon",
		name: "自动加农炮",
		category: "BALLISTIC",
		damageType: "KINETIC",
		mountType: "TURRET",
		damage: 25,
		range: 250,
		arc: 360,
		cooldown: 1.5,
		fluxCost: 8,
		ammo: 0,
		reloadTime: 0,
		ignoresShields: false,
	},
	pulse_laser: {
		id: "pulse_laser",
		name: "脉冲激光",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "TURRET",
		damage: 15,
		range: 200,
		arc: 360,
		cooldown: 1,
		fluxCost: 6,
		ammo: 0,
		reloadTime: 0,
		ignoresShields: false,
	},
	missile: {
		id: "missile",
		name: "导弹",
		category: "MISSILE",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "FIXED",
		damage: 50,
		range: 400,
		arc: 90,
		cooldown: 4,
		fluxCost: 10,
		ammo: 6,
		reloadTime: 10,
		ignoresShields: false,
	},
};

export function getWeaponSpec(id: string): WeaponSpec | undefined {
	return PRESET_WEAPONS[id];
}

export function getAvailableWeapons(): WeaponSpec[] {
	return Object.values(PRESET_WEAPONS);
}
