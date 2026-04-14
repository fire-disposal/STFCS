/**
 * 预设武器数据
 */

import type { DamageTypeValue, MountTypeValue, WeaponCategoryValue } from "@vt/types";

export interface WeaponSpecData {
	id: string;
	name: string;
	description: string;
	category: WeaponCategoryValue;
	damageType: DamageTypeValue;
	mountType: MountTypeValue;
	damage: number;
	range: number;
	arc: number;
	cooldown: number;
	fluxCost: number;
	ammo: number;
	reloadTime: number;
	ignoresShields: boolean;
}

export const PRESET_WEAPONS: Record<string, WeaponSpecData> = {
	// 动能武器
	autocannon: {
		id: "autocannon",
		name: "自动加农炮",
		description: "标准动能自动武器，平衡的性能",
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
	heavy_cannon: {
		id: "heavy_cannon",
		name: "重型加农炮",
		description: "高伤害动能武器，射速较慢",
		category: "BALLISTIC",
		damageType: "KINETIC",
		mountType: "TURRET",
		damage: 50,
		range: 300,
		arc: 180,
		cooldown: 3,
		fluxCost: 15,
		ammo: 0,
		reloadTime: 0,
		ignoresShields: false,
	},
	railgun: {
		id: "railgun",
		name: "电磁轨道炮",
		description: "超远射程动能武器，需要充能时间",
		category: "BALLISTIC",
		damageType: "KINETIC",
		mountType: "FIXED",
		damage: 80,
		range: 500,
		arc: 60,
		cooldown: 5,
		fluxCost: 25,
		ammo: 0,
		reloadTime: 0,
		ignoresShields: false,
	},

	// 能量武器
	pulse_laser: {
		id: "pulse_laser",
		name: "脉冲激光",
		description: "标准能量武器，快速连射",
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
	beam_laser: {
		id: "beam_laser",
		name: "聚焦光束",
		description: "持续能量伤害，需要锁定目标",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "FIXED",
		damage: 40,
		range: 150,
		arc: 90,
		cooldown: 4,
		fluxCost: 20,
		ammo: 0,
		reloadTime: 0,
		ignoresShields: false,
	},
	plasma_cannon: {
		id: "plasma_cannon",
		name: "等离子炮",
		description: "高伤害能量武器",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "TURRET",
		damage: 60,
		range: 250,
		arc: 180,
		cooldown: 4,
		fluxCost: 30,
		ammo: 0,
		reloadTime: 0,
		ignoresShields: false,
	},

	// 导弹武器
	assault_missile: {
		id: "assault_missile",
		name: "突击导弹",
		description: "快速导弹，追踪目标",
		category: "MISSILE",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "FIXED",
		damage: 45,
		range: 400,
		arc: 120,
		cooldown: 4,
		fluxCost: 10,
		ammo: 8,
		reloadTime: 10,
		ignoresShields: false,
	},
	harpoon_missile: {
		id: "harpoon_missile",
		name: "鱼叉导弹",
		description: "重型导弹，高伤害",
		category: "MISSILE",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "FIXED",
		damage: 100,
		range: 500,
		arc: 90,
		cooldown: 8,
		fluxCost: 20,
		ammo: 4,
		reloadTime: 15,
		ignoresShields: false,
	},
	sabot: {
		id: "sabot",
		name: "萨博特",
		description: "动能导弹，穿透护盾",
		category: "MISSILE",
		damageType: "KINETIC",
		mountType: "FIXED",
		damage: 60,
		range: 350,
		arc: 90,
		cooldown: 6,
		fluxCost: 15,
		ammo: 6,
		reloadTime: 12,
		ignoresShields: true,
	},
};

export function getWeaponSpec(id: string): WeaponSpecData | undefined {
	return PRESET_WEAPONS[id];
}

export function getAvailableWeapons(): WeaponSpecData[] {
	return Object.values(PRESET_WEAPONS);
}

export function getWeaponsByCategory(category: WeaponCategoryValue): WeaponSpecData[] {
	return Object.values(PRESET_WEAPONS).filter((w) => w.category === category);
}

export function getWeaponsByDamageType(damageType: DamageTypeValue): WeaponSpecData[] {
	return Object.values(PRESET_WEAPONS).filter((w) => w.damageType === damageType);
}
