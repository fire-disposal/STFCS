/**
 * 预设舰船数据（精简版）
 *
 * 覆盖所有尺寸和挂载点类别组合：
 * - FRIGATE: 护卫舰，高机动、低生存
 * - DESTROYER: 驾逐舰，平衡型
 * - CRUISER: 巡洋舰，重火力
 * - CAPITAL: 主力舰，极高火力
 */

import type { ShipHullSpec, WeaponMountSpec } from "./types.js";
import { getWeaponSpec } from "./weapons.js";

// ==================== 护卫舰 ====================

const FRIGATE_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "Main Gun",
		slotCategory: "UNIVERSAL_SLOT",
		size: "SMALL",
		acceptsTurret: true,
		acceptsHardpoint: true,
		position: { x: 30, y: 0 },
		facing: 0,
		defaultWeapon: "light_autocannon_turret",
		groupHint: "Main",
	},
	{
		id: "m2",
		displayName: "Secondary",
		slotCategory: "ENERGY_SLOT",
		size: "SMALL",
		acceptsTurret: true,
		acceptsHardpoint: false,  // 能量挂载点只接受炮塔型
		position: { x: -20, y: 15 },
		facing: 90,
		defaultWeapon: "pulse_laser_small",
		groupHint: "Secondary",
	},
];

// ==================== 驾逐舰 ====================

const DESTROYER_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "Main Gun",
		slotCategory: "BALLISTIC_SLOT",
		size: "MEDIUM",
		acceptsTurret: true,
		acceptsHardpoint: true,
		position: { x: 50, y: 0 },
		facing: 0,
		defaultWeapon: "autocannon",
		groupHint: "Main",
	},
	{
		id: "m2",
		displayName: "Secondary",
		slotCategory: "UNIVERSAL_SLOT",
		size: "SMALL",
		acceptsTurret: true,
		acceptsHardpoint: true,
		position: { x: 30, y: 20 },
		facing: 60,
		defaultWeapon: "light_autocannon_turret",
		groupHint: "Secondary",
	},
	{
		id: "ms1",
		displayName: "Missile",
		slotCategory: "MISSILE_SLOT",
		size: "MEDIUM",
		acceptsTurret: false,   // 导弹挂载点只接受硬点型
		acceptsHardpoint: true,
		position: { x: 20, y: -25 },
		facing: 0,
		defaultWeapon: "harpoon",
		groupHint: "Missile",
	},
];

// ==================== 巡洋舰 ====================

const CRUISER_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "Main Gun",
		slotCategory: "BALLISTIC_SLOT",
		size: "LARGE",
		acceptsTurret: true,
		acceptsHardpoint: true,
		position: { x: 70, y: 0 },
		facing: 0,
		defaultWeapon: "heavy_autocannon",
		groupHint: "Main",
	},
	{
		id: "m2",
		displayName: "Secondary",
		slotCategory: "ENERGY_SLOT",
		size: "MEDIUM",
		acceptsTurret: true,
		acceptsHardpoint: false,
		position: { x: 30, y: 30 },
		facing: 30,
		defaultWeapon: "pulse_laser",
		groupHint: "Secondary",
	},
	{
		id: "m3",
		displayName: "Secondary",
		slotCategory: "ENERGY_SLOT",
		size: "MEDIUM",
		acceptsTurret: true,
		acceptsHardpoint: false,
		position: { x: 30, y: -30 },
		facing: -30,
		defaultWeapon: "pulse_laser",
		groupHint: "Secondary",
	},
	{
		id: "ms1",
		displayName: "Missile",
		slotCategory: "MISSILE_SLOT",
		size: "MEDIUM",
		acceptsTurret: false,
		acceptsHardpoint: true,
		position: { x: -50, y: 0 },
		facing: 0,
		defaultWeapon: "harpoon",
		groupHint: "Missile",
	},
];

// ==================== 主力舰 ====================

const CAPITAL_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "Main Gun",
		slotCategory: "BALLISTIC_SLOT",
		size: "LARGE",
		acceptsTurret: false,   // 主炮硬点
		acceptsHardpoint: true,
		position: { x: 100, y: 0 },
		facing: 0,
		defaultWeapon: "hellbore",
		groupHint: "Main",
	},
	{
		id: "m2",
		displayName: "Main Gun",
		slotCategory: "ENERGY_SLOT",
		size: "LARGE",
		acceptsTurret: false,
		acceptsHardpoint: true,
		position: { x: 90, y: 20 },
		facing: 10,
		defaultWeapon: "tachyon_lance",
		groupHint: "Main",
	},
	{
		id: "m3",
		displayName: "Main Gun",
		slotCategory: "ENERGY_SLOT",
		size: "LARGE",
		acceptsTurret: false,
		acceptsHardpoint: true,
		position: { x: 90, y: -20 },
		facing: -10,
		defaultWeapon: "tachyon_lance",
		groupHint: "Main",
	},
	{
		id: "m4",
		displayName: "Secondary",
		slotCategory: "UNIVERSAL_SLOT",
		size: "MEDIUM",
		acceptsTurret: true,
		acceptsHardpoint: true,
		position: { x: 50, y: 40 },
		facing: 45,
		defaultWeapon: "pulse_laser",
		groupHint: "Secondary",
	},
	{
		id: "pd1",
		displayName: "PD",
		slotCategory: "ENERGY_SLOT",
		size: "SMALL",
		acceptsTurret: true,
		acceptsHardpoint: false,
		position: { x: 20, y: 50 },
		facing: 90,
		defaultWeapon: "pd_laser",
		groupHint: "PD",
	},
];

// ==================== 预设舰船 ====================

export const PRESET_SHIPS: Record<string, ShipHullSpec> = {
	// 护卫舰
	frigate: {
		id: "frigate",
		name: "Frigate",
		description: "Light assault frigate, high mobility, flank harassment.",
		size: "FRIGATE",
		class: "ASSAULT",
		width: 50,
		length: 100,
		hitPoints: 800,
		hullPoints: 800,
		armorMax: 150,
		armorValue: 150,
		fluxCapacity: 200,
		fluxDissipation: 20,
		hasShield: true,
		shieldType: "FRONT",
		shieldArc: 120,
		shieldRadius: 75,
		shieldEfficiency: 1.0,
		shieldUpCost: 5,
		maxArmorReductionRatio: 0.85,
		minArmorReductionRatio: 0.1,
		rangeRatio: 1.0,
		maxSpeed: 750,
		maxTurnRate: 60,
		weaponMounts: FRIGATE_MOUNTS,
		opCapacity: 8,
	},

	// 驾逐舰
	destroyer: {
		id: "destroyer",
		name: "Destroyer",
		description: "Standard destroyer, balanced combat capability.",
		size: "DESTROYER",
		class: "COMBAT",
		width: 75,
		length: 150,
		hitPoints: 1500,
		hullPoints: 1500,
		armorMax: 200,
		armorValue: 200,
		fluxCapacity: 400,
		fluxDissipation: 40,
		hasShield: true,
		shieldType: "FRONT",
		shieldArc: 90,
		shieldRadius: 100,
		shieldEfficiency: 1.0,
		shieldUpCost: 8,
		maxArmorReductionRatio: 0.85,
		minArmorReductionRatio: 0.1,
		rangeRatio: 1.0,
		maxSpeed: 500,
		maxTurnRate: 45,
		weaponMounts: DESTROYER_MOUNTS,
		opCapacity: 15,
	},

	// 巡洋舰
	cruiser: {
		id: "cruiser",
		name: "Cruiser",
		description: "Heavy cruiser, powerful firepower and armor.",
		size: "CRUISER",
		class: "HEAVY",
		width: 125,
		length: 250,
		hitPoints: 3000,
		hullPoints: 3000,
		armorMax: 400,
		armorValue: 400,
		fluxCapacity: 600,
		fluxDissipation: 60,
		hasShield: true,
		shieldType: "FRONT",
		shieldArc: 120,
		shieldRadius: 150,
		shieldEfficiency: 1.0,
		shieldUpCost: 12,
		maxArmorReductionRatio: 0.85,
		minArmorReductionRatio: 0.1,
		rangeRatio: 1.0,
		maxSpeed: 400,
		maxTurnRate: 30,
		weaponMounts: CRUISER_MOUNTS,
		opCapacity: 30,
	},

	// 主力舰
	battleship: {
		id: "battleship",
		name: "Battleship",
		description: "Capital battleship, ultimate firepower platform.",
		size: "CAPITAL",
		class: "BATTLESHIP",
		width: 200,
		length: 500,
		hitPoints: 6000,
		hullPoints: 6000,
		armorMax: 600,
		armorValue: 600,
		fluxCapacity: 1000,
		fluxDissipation: 100,
		hasShield: true,
		shieldType: "OMNI",
		shieldArc: 240,
		shieldRadius: 300,
		shieldEfficiency: 0.6,
		shieldUpCost: 20,
		maxArmorReductionRatio: 0.9,
		minArmorReductionRatio: 0.15,
		rangeRatio: 1.0,
		maxSpeed: 250,
		maxTurnRate: 15,
		weaponMounts: CAPITAL_MOUNTS,
		opCapacity: 50,
	},
};

// ==================== 特殊对象 ====================

export const STATION_SPEC: ShipHullSpec = {
	id: "station",
	name: "Station",
	description: "Neutral station, battlefield center point.",
	size: "CAPITAL",
	class: "BATTLESHIP",
	width: 100,
	length: 100,
	hitPoints: 5000,
	hullPoints: 5000,
	armorMax: 300,
	armorValue: 300,
	fluxCapacity: 0,
	fluxDissipation: 0,
	hasShield: false,
	shieldType: "NONE",
	shieldArc: 0,
	shieldRadius: 0,
	shieldEfficiency: 0,
	shieldUpCost: 0,
	maxArmorReductionRatio: 0.85,
	minArmorReductionRatio: 0.1,
	rangeRatio: 1.0,
	maxSpeed: 0,
	maxTurnRate: 0,
	weaponMounts: [],
	opCapacity: 0,
};

export const ASTEROID_SPEC: ShipHullSpec = {
	id: "asteroid",
	name: "Asteroid",
	description: "Large asteroid, obstacle.",
	size: "CRUISER",
	class: "HEAVY",
	width: 60,
	length: 60,
	hitPoints: 2000,
	hullPoints: 2000,
	armorMax: 200,
	armorValue: 200,
	fluxCapacity: 0,
	fluxDissipation: 0,
	hasShield: false,
	shieldType: "NONE",
	shieldArc: 0,
	shieldRadius: 0,
	shieldEfficiency: 0,
	shieldUpCost: 0,
	maxArmorReductionRatio: 0.85,
	minArmorReductionRatio: 0.1,
	rangeRatio: 1.0,
	maxSpeed: 0,
	maxTurnRate: 0,
	weaponMounts: [],
	opCapacity: 0,
};

// ==================== 辅助函数 ====================

export function getShipHullSpec(id: string): ShipHullSpec | undefined {
	if (id === "station") return STATION_SPEC;
	if (id === "asteroid") return ASTEROID_SPEC;
	return PRESET_SHIPS[id];
}

export function getAvailableShips(): ShipHullSpec[] {
	return Object.values(PRESET_SHIPS);
}

/** 按尺寸获取舰船列表 */
export function getShipsBySize(size: string): ShipHullSpec[] {
	return Object.values(PRESET_SHIPS).filter((s) => s.size === size);
}

/** 获取舰船 OP 容量 */
export function getShipOpCapacity(hullId: string): number {
	const spec = getShipHullSpec(hullId);
	return spec?.opCapacity ?? 0;
}

/** 计算舰船已用 OP 点数（包含内置武器，供 DM 参考） */
export function calculateShipOpUsed(
	hullId: string,
	weaponLoadout: { mountId: string; weaponId: string }[]
): number {
	return weaponLoadout.reduce((sum, entry) => {
		const weapon = getWeaponSpec(entry.weaponId);
		return sum + (weapon?.opCost ?? 0);
	}, 0);
}

/** 舰船尺寸枚举值 */
export const ShipSizeList = ["FRIGATE", "DESTROYER", "CRUISER", "CAPITAL"] as const;