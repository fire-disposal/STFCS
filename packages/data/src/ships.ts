/**
 * 预设舰船数据
 *
 * 舰船按尺寸分类：
 * - FRIGATE: 护卫舰，高机动、低生存，OP 容量 5-10
 * - DESTROYER: 驾逐舰，平衡型，OP 容量 10-20
 * - CRUISER: 巡洋舰，重火力、中机动，OP 容量 20-40
 * - CAPITAL: 主力舰，极高火力、低机动，OP 容量 40-80
 */

import type { ShipHullSpec, WeaponMountSpec } from "./types.js";
import { getWeaponSpec } from "./weapons.js";

// ==================== 护卫舰 ====================

const FRIGATE_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "主炮",
		type: "TURRET",
		size: "SMALL",
		position: { x: 30, y: 0 },
		facing: 0,
		arc: 180,
		defaultWeapon: "light_autocannon",
		groupHint: "主炮组",
	},
	{
		id: "m2",
		displayName: "副炮",
		type: "TURRET",
		size: "SMALL",
		position: { x: -20, y: 15 },
		facing: 90,
		arc: 120,
		defaultWeapon: "pulse_laser_small",
		groupHint: "副炮组",
	},
];

const FRIGATE_MOUNTS_PD: WeaponMountSpec[] = [
	{
		id: "pd1",
		displayName: "点防御",
		type: "TURRET",
		size: "SMALL",
		position: { x: -10, y: 0 },
		facing: 180,
		arc: 360,
		defaultWeapon: "pd_laser",
		groupHint: "点防御组",
	},
];

// ==================== 驱逐舰 ====================

const DESTROYER_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "主炮",
		type: "TURRET",
		size: "MEDIUM",
		position: { x: 50, y: 0 },
		facing: 0,
		arc: 180,
		defaultWeapon: "autocannon",
		groupHint: "主炮组",
	},
	{
		id: "m2",
		displayName: "副炮",
		type: "TURRET",
		size: "SMALL",
		position: { x: 30, y: 20 },
		facing: 60,
		arc: 120,
		defaultWeapon: "light_autocannon",
		groupHint: "副炮组",
	},
	{
		id: "m3",
		displayName: "后炮",
		type: "TURRET",
		size: "SMALL",
		position: { x: -40, y: 0 },
		facing: 180,
		arc: 120,
		defaultWeapon: "pulse_laser_small",
		groupHint: "副炮组",
	},
];

const DESTROYER_MOUNTS_MISSILE: WeaponMountSpec[] = [
	{
		id: "ms1",
		displayName: "导弹",
		type: "FIXED",
		size: "MEDIUM",
		position: { x: 20, y: -25 },
		facing: 0,
		arc: 60,
		defaultWeapon: "missile",
		groupHint: "导弹组",
		restrictedTypes: ["MISSILE"],
	},
	{
		id: "ms2",
		displayName: "导弹",
		type: "FIXED",
		size: "MEDIUM",
		position: { x: 20, y: 25 },
		facing: 0,
		arc: 60,
		defaultWeapon: "missile",
		groupHint: "导弹组",
		restrictedTypes: ["MISSILE"],
	},
];

// ==================== 巡洋舰 ====================

const CRUISER_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "主炮",
		type: "TURRET",
		size: "LARGE",
		position: { x: 70, y: 0 },
		facing: 0,
		arc: 120,
		defaultWeapon: "heavy_autocannon",
		groupHint: "主炮组",
	},
	{
		id: "m2",
		displayName: "副炮",
		type: "TURRET",
		size: "MEDIUM",
		position: { x: 30, y: 30 },
		facing: 30,
		arc: 180,
		defaultWeapon: "pulse_laser",
		groupHint: "副炮组",
	},
	{
		id: "m3",
		displayName: "副炮",
		type: "TURRET",
		size: "MEDIUM",
		position: { x: 30, y: -30 },
		facing: -30,
		arc: 180,
		defaultWeapon: "pulse_laser",
		groupHint: "副炮组",
	},
];

const CRUISER_MOUNTS_MISSILE: WeaponMountSpec[] = [
	{
		id: "ms1",
		displayName: "导弹",
		type: "FIXED",
		size: "MEDIUM",
		position: { x: -50, y: 0 },
		facing: 0,
		arc: 90,
		defaultWeapon: "harpoon",
		groupHint: "导弹组",
		restrictedTypes: ["MISSILE"],
	},
];

// ==================== 主力舰 ====================

const CAPITAL_MOUNTS: WeaponMountSpec[] = [
	{
		id: "m1",
		displayName: "主炮",
		type: "FIXED",
		size: "LARGE",
		position: { x: 100, y: 0 },
		facing: 0,
		arc: 30,
		defaultWeapon: "hellbore",
		groupHint: "主炮组",
	},
	{
		id: "m2",
		displayName: "主炮",
		type: "FIXED",
		size: "LARGE",
		position: { x: 90, y: 20 },
		facing: 10,
		arc: 45,
		defaultWeapon: "gauss_cannon",
		groupHint: "主炮组",
	},
	{
		id: "m3",
		displayName: "主炮",
		type: "FIXED",
		size: "LARGE",
		position: { x: 90, y: -20 },
		facing: -10,
		arc: 45,
		defaultWeapon: "gauss_cannon",
		groupHint: "主炮组",
	},
	{
		id: "m4",
		displayName: "副炮",
		type: "TURRET",
		size: "MEDIUM",
		position: { x: 50, y: 40 },
		facing: 45,
		arc: 240,
		defaultWeapon: "heavy_burst_laser",
		groupHint: "副炮组",
	},
	{
		id: "m5",
		displayName: "副炮",
		type: "TURRET",
		size: "MEDIUM",
		position: { x: 50, y: -40 },
		facing: -45,
		arc: 240,
		defaultWeapon: "heavy_burst_laser",
		groupHint: "副炮组",
	},
];

const CAPITAL_MOUNTS_PD: WeaponMountSpec[] = [
	{
		id: "pd1",
		displayName: "点防御",
		type: "TURRET",
		size: "SMALL",
		position: { x: 20, y: 50 },
		facing: 90,
		arc: 360,
		defaultWeapon: "pd_laser",
		groupHint: "点防御组",
	},
	{
		id: "pd2",
		displayName: "点防御",
		type: "TURRET",
		size: "SMALL",
		position: { x: 20, y: -50 },
		facing: -90,
		arc: 360,
		defaultWeapon: "pd_laser",
		groupHint: "点防御组",
	},
];

// ==================== 预设舰船 ====================

export const PRESET_SHIPS: Record<string, ShipHullSpec> = {
	// 护卫舰 (length ≈ 100, 每回合航行 ≈ 3000)
	frigate: {
		id: "frigate",
		name: "护卫舰",
		description: "轻型突击护卫舰，高机动性，适合侧翼骚扰。",
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
		shieldUpCost: 5,
		maxSpeed: 750,  // 每回合前进 3000 (Phase A+C 各 1500)
		maxTurnRate: 60,  // 每阶段转向 60°
		weaponMounts: FRIGATE_MOUNTS,
		opCapacity: 8,
	},

	frigate_pd: {
		id: "frigate_pd",
		name: "护卫舰（点防御型）",
		description: "护卫舰变种，额外装备点防御系统。",
		size: "FRIGATE",
		class: "SUPPORT",
		width: 50,
		length: 100,
		hitPoints: 800,
		hullPoints: 800,
		armorMax: 150,
		armorValue: 150,
		fluxCapacity: 200,
		fluxDissipation: 25,
		hasShield: true,
		shieldType: "FRONT",
		shieldArc: 120,
		shieldRadius: 75,
		shieldUpCost: 5,
		maxSpeed: 700,
		maxTurnRate: 50,
		weaponMounts: [...FRIGATE_MOUNTS, ...FRIGATE_MOUNTS_PD],
		opCapacity: 10,
	},

	// 驱逐舰 (length ≈ 150, 每回合航行 ≈ 2000)
	destroyer: {
		id: "destroyer",
		name: "驱逐舰",
		description: "标准驱逐舰，均衡的战斗能力。",
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
		shieldUpCost: 8,
		maxSpeed: 500,  // 每回合前进 2000
		maxTurnRate: 45,
		weaponMounts: DESTROYER_MOUNTS,
		opCapacity: 15,
	},

	destroyer_missile: {
		id: "destroyer_missile",
		name: "驱逐舰（导弹型）",
		description: "驱逐舰导弹变种，远程打击能力。",
		size: "DESTROYER",
		class: "STRIKE",
		width: 75,
		length: 150,
		hitPoints: 1400,
		hullPoints: 1400,
		armorMax: 180,
		armorValue: 180,
		fluxCapacity: 350,
		fluxDissipation: 35,
		hasShield: true,
		shieldType: "OMNI",
		shieldArc: 180,
		shieldRadius: 110,
		shieldUpCost: 10,
		maxSpeed: 450,
		maxTurnRate: 40,
		weaponMounts: [...DESTROYER_MOUNTS.slice(0, 2), ...DESTROYER_MOUNTS_MISSILE],
		opCapacity: 18,
	},

	// 巡洋舰 (length ≈ 250, 每回合航行 ≈ 1600)
	cruiser: {
		id: "cruiser",
		name: "巡洋舰",
		description: "重型巡洋舰，强大火力与护甲。",
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
		shieldUpCost: 12,
		maxSpeed: 400,  // 每回合前进 1600
		maxTurnRate: 30,
		weaponMounts: CRUISER_MOUNTS,
		opCapacity: 30,
	},

	cruiser_missile: {
		id: "cruiser_missile",
		name: "巡洋舰（导弹型）",
		description: "巡洋舰导弹变种，远程导弹支援。",
		size: "CRUISER",
		class: "STRIKE",
		width: 125,
		length: 250,
		hitPoints: 2800,
		hullPoints: 2800,
		armorMax: 350,
		armorValue: 350,
		fluxCapacity: 550,
		fluxDissipation: 55,
		hasShield: true,
		shieldType: "OMNI",
		shieldArc: 200,
		shieldRadius: 160,
		shieldUpCost: 15,
		maxSpeed: 350,
		maxTurnRate: 25,
		weaponMounts: [...CRUISER_MOUNTS.slice(0, 2), ...CRUISER_MOUNTS_MISSILE],
		opCapacity: 25,
	},

	// 主力舰 (战列舰 length ≈ 500, 每回合航行 ≈ 1000)
	battleship: {
		id: "battleship",
		name: "战列舰",
		description: "主力战列舰，终极火力平台。",
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
		shieldUpCost: 20,
		maxSpeed: 250,  // 每回合前进 1000
		maxTurnRate: 15,  // 每阶段转向 15°
		weaponMounts: [...CAPITAL_MOUNTS, ...CAPITAL_MOUNTS_PD],
		opCapacity: 50,
	},

	carrier: {
		id: "carrier",
		name: "航母",
		description: "航空母舰，支援与指挥平台。（战机系统待实现）",
		size: "CAPITAL",
		class: "CARRIER",
		width: 200,
		length: 500,
		hitPoints: 5000,
		hullPoints: 5000,
		armorMax: 500,
		armorValue: 500,
		fluxCapacity: 800,
		fluxDissipation: 80,
		hasShield: true,
		shieldType: "OMNI",
		shieldArc: 300,
		shieldRadius: 320,
		shieldUpCost: 25,
		maxSpeed: 200,  // 每回合前进 800（比战列舰慢）
		maxTurnRate: 10,
		weaponMounts: [
			...CAPITAL_MOUNTS.slice(0, 3),
			...CAPITAL_MOUNTS_PD,
		],
		opCapacity: 45,
	},
};

// ==================== 特殊对象 ====================

/** 空间站规格 */
export const STATION_SPEC: ShipHullSpec = {
	id: "station",
	name: "空间站",
	description: "中立空间站，可作为战场中心点。",
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
	maxSpeed: 0,
	maxTurnRate: 0,
	weaponMounts: [],
	opCapacity: 0,
};

/** 小行星规格 */
export const ASTEROID_SPEC: ShipHullSpec = {
	id: "asteroid",
	name: "小行星",
	description: "大型小行星，可作为障碍物。",
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

/** 计算舰船已用 OP 点数 */
export function calculateShipOpUsed(
	hullId: string,
	weaponLoadout: { mountId: string; weaponId: string }[]
): number {
	const spec = getShipHullSpec(hullId);
	return weaponLoadout.reduce((sum, entry) => {
		// 内置武器不计入 OP
		if (spec?.builtInWeapons?.some((b) => b.mountId === entry.mountId)) {
			return sum;
		}
		const weapon = getWeaponSpec(entry.weaponId);
		return sum + (weapon?.opCost ?? 0);
	}, 0);
}

/** 舰船尺寸枚举值 */
export const ShipSizeList = ["FRIGATE", "DESTROYER", "CRUISER", "CAPITAL"] as const;