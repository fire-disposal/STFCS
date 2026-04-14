/**
 * 预设舰船数据
 */

import type {
	HullSizeValue,
	MountTypeValue,
	Point,
	ShieldTypeValue,
	ShipClassValue,
} from "@vt/types";

export interface ShipHullSpecData {
	id: string;
	name: string;
	description: string;
	size: HullSizeValue;
	class: ShipClassValue;
	width: number;
	length: number;
	hullPoints: number;
	armorValue: number;
	armorDistribution: number[];
	hasShield: boolean;
	shieldType: ShieldTypeValue;
	shieldRadius: number;
	shieldArc: number;
	shieldEfficiency: number;
	shieldMaintenanceCost: number;
	fluxCapacity: number;
	fluxDissipation: number;
	maxSpeed: number;
	maxTurnRate: number;
	acceleration: number;
	weaponMounts: WeaponMountSpecData[];
	tags: string[];
}

export interface WeaponMountSpecData {
	id: string;
	type: MountTypeValue;
	size: "SMALL" | "MEDIUM" | "LARGE";
	position: Point;
	facing: number;
	arc: number;
	defaultWeapon?: string;
}

export const PRESET_SHIPS: Record<string, ShipHullSpecData> = {
	frigate_assault: {
		id: "frigate_assault",
		name: "突击护卫舰",
		description: "轻型护卫舰，适合侦查和骚扰",
		size: "FRIGATE",
		class: "STRIKE",
		width: 20,
		length: 40,
		hullPoints: 800,
		armorValue: 100,
		armorDistribution: [120, 100, 80, 80, 80, 100],
		hasShield: true,
		shieldType: "FRONT",
		shieldRadius: 35,
		shieldArc: 120,
		shieldEfficiency: 0.6,
		shieldMaintenanceCost: 3,
		fluxCapacity: 150,
		fluxDissipation: 12,
		maxSpeed: 120,
		maxTurnRate: 60,
		acceleration: 60,
		weaponMounts: [
			{
				id: "mount_front_1",
				type: "FIXED",
				size: "SMALL",
				position: { x: 0, y: -15 },
				facing: 0,
				arc: 60,
				defaultWeapon: "autocannon",
			},
			{
				id: "mount_left_1",
				type: "TURRET",
				size: "SMALL",
				position: { x: -12, y: 5 },
				facing: -45,
				arc: 180,
				defaultWeapon: "pulse_laser",
			},
			{
				id: "mount_right_1",
				type: "TURRET",
				size: "SMALL",
				position: { x: 12, y: 5 },
				facing: 45,
				arc: 180,
				defaultWeapon: "pulse_laser",
			},
		],
		tags: ["fast", "scout"],
	},

	frigate_destroyer: {
		id: "frigate_destroyer",
		name: "驱逐护卫舰",
		description: "火力较强的护卫舰，适合前线作战",
		size: "FRIGATE",
		class: "LINE",
		width: 24,
		length: 45,
		hullPoints: 1000,
		armorValue: 120,
		armorDistribution: [150, 120, 90, 90, 90, 120],
		hasShield: true,
		shieldType: "FRONT",
		shieldRadius: 40,
		shieldArc: 140,
		shieldEfficiency: 0.5,
		shieldMaintenanceCost: 5,
		fluxCapacity: 180,
		fluxDissipation: 15,
		maxSpeed: 100,
		maxTurnRate: 45,
		acceleration: 50,
		weaponMounts: [
			{
				id: "mount_front_1",
				type: "FIXED",
				size: "MEDIUM",
				position: { x: 0, y: -18 },
				facing: 0,
				arc: 40,
				defaultWeapon: "railgun",
			},
			{
				id: "mount_front_2",
				type: "TURRET",
				size: "SMALL",
				position: { x: 0, y: -8 },
				facing: 0,
				arc: 360,
				defaultWeapon: "autocannon",
			},
			{
				id: "mount_missile_1",
				type: "FIXED",
				size: "SMALL",
				position: { x: 0, y: 10 },
				facing: 180,
				arc: 180,
				defaultWeapon: "assault_missile",
			},
		],
		tags: ["combat", "frontline"],
	},

	cruiser_heavy: {
		id: "cruiser_heavy",
		name: "重型巡洋舰",
		description: "主力舰级别，强大的火力输出",
		size: "CRUISER",
		class: "BATTLESHIP",
		width: 40,
		length: 80,
		hullPoints: 2000,
		armorValue: 200,
		armorDistribution: [250, 200, 150, 150, 150, 200],
		hasShield: true,
		shieldType: "OMNI",
		shieldRadius: 60,
		shieldArc: 360,
		shieldEfficiency: 0.4,
		shieldMaintenanceCost: 10,
		fluxCapacity: 400,
		fluxDissipation: 25,
		maxSpeed: 60,
		maxTurnRate: 30,
		acceleration: 30,
		weaponMounts: [
			{
				id: "mount_front_1",
				type: "FIXED",
				size: "LARGE",
				position: { x: 0, y: -30 },
				facing: 0,
				arc: 60,
				defaultWeapon: "railgun",
			},
			{
				id: "mount_front_2",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: 0, y: -20 },
				facing: 0,
				arc: 360,
				defaultWeapon: "plasma_cannon",
			},
			{
				id: "mount_left_1",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: -20, y: 0 },
				facing: -90,
				arc: 360,
				defaultWeapon: "heavy_cannon",
			},
			{
				id: "mount_right_1",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: 20, y: 0 },
				facing: 90,
				arc: 360,
				defaultWeapon: "heavy_cannon",
			},
			{
				id: "mount_missile_1",
				type: "FIXED",
				size: "MEDIUM",
				position: { x: 0, y: 20 },
				facing: 180,
				arc: 180,
				defaultWeapon: "harpoon_missile",
			},
		],
		tags: ["capital", "heavy"],
	},

	cruiser_carrier: {
		id: "cruiser_carrier",
		name: "航母巡洋舰",
		description: "搭载舰载机的支援舰",
		size: "CRUISER",
		class: "CARRIER",
		width: 45,
		length: 90,
		hullPoints: 1500,
		armorValue: 150,
		armorDistribution: [200, 150, 120, 120, 120, 150],
		hasShield: true,
		shieldType: "OMNI",
		shieldRadius: 70,
		shieldArc: 360,
		shieldEfficiency: 0.5,
		shieldMaintenanceCost: 8,
		fluxCapacity: 350,
		fluxDissipation: 20,
		maxSpeed: 50,
		maxTurnRate: 25,
		acceleration: 25,
		weaponMounts: [
			{
				id: "mount_front_1",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: 0, y: -25 },
				facing: 0,
				arc: 360,
				defaultWeapon: "plasma_cannon",
			},
			{
				id: "mount_left_1",
				type: "TURRET",
				size: "SMALL",
				position: { x: -25, y: 10 },
				facing: -90,
				arc: 360,
				defaultWeapon: "pulse_laser",
			},
			{
				id: "mount_right_1",
				type: "TURRET",
				size: "SMALL",
				position: { x: 25, y: 10 },
				facing: 90,
				arc: 360,
				defaultWeapon: "pulse_laser",
			},
		],
		tags: ["carrier", "support"],
	},

	capital_battleship: {
		id: "capital_battleship",
		name: "战列舰",
		description: "舰队旗舰，最大火力输出",
		size: "CAPITAL",
		class: "BATTLESHIP",
		width: 60,
		length: 120,
		hullPoints: 4000,
		armorValue: 300,
		armorDistribution: [400, 300, 250, 250, 250, 300],
		hasShield: true,
		shieldType: "OMNI",
		shieldRadius: 100,
		shieldArc: 360,
		shieldEfficiency: 0.3,
		shieldMaintenanceCost: 20,
		fluxCapacity: 800,
		fluxDissipation: 50,
		maxSpeed: 40,
		maxTurnRate: 20,
		acceleration: 20,
		weaponMounts: [
			{
				id: "mount_front_1",
				type: "FIXED",
				size: "LARGE",
				position: { x: 0, y: -50 },
				facing: 0,
				arc: 60,
				defaultWeapon: "railgun",
			},
			{
				id: "mount_front_2",
				type: "FIXED",
				size: "LARGE",
				position: { x: -15, y: -40 },
				facing: 0,
				arc: 90,
				defaultWeapon: "railgun",
			},
			{
				id: "mount_front_3",
				type: "FIXED",
				size: "LARGE",
				position: { x: 15, y: -40 },
				facing: 0,
				arc: 90,
				defaultWeapon: "railgun",
			},
			{
				id: "mount_left_1",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: -30, y: 0 },
				facing: -90,
				arc: 360,
				defaultWeapon: "heavy_cannon",
			},
			{
				id: "mount_right_1",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: 30, y: 0 },
				facing: 90,
				arc: 360,
				defaultWeapon: "heavy_cannon",
			},
			{
				id: "mount_missile_1",
				type: "FIXED",
				size: "LARGE",
				position: { x: 0, y: 40 },
				facing: 180,
				arc: 180,
				defaultWeapon: "harpoon_missile",
			},
		],
		tags: ["capital", "flagship"],
	},

	fighter_interceptor: {
		id: "fighter_interceptor",
		name: "截击机",
		description: "高速轻型战机",
		size: "FIGHTER",
		class: "STRIKE",
		width: 8,
		length: 12,
		hullPoints: 100,
		armorValue: 20,
		armorDistribution: [25, 20, 15, 15, 15, 20],
		hasShield: false,
		shieldType: "NONE",
		shieldRadius: 0,
		shieldArc: 0,
		shieldEfficiency: 0,
		shieldMaintenanceCost: 0,
		fluxCapacity: 30,
		fluxDissipation: 5,
		maxSpeed: 200,
		maxTurnRate: 120,
		acceleration: 100,
		weaponMounts: [
			{
				id: "mount_front_1",
				type: "FIXED",
				size: "SMALL",
				position: { x: 0, y: -5 },
				facing: 0,
				arc: 30,
				defaultWeapon: "pulse_laser",
			},
		],
		tags: ["fighter", "fast"],
	},
};

export function getShipHullSpec(id: string): ShipHullSpecData | undefined {
	return PRESET_SHIPS[id];
}

export function getAvailableShips(): ShipHullSpecData[] {
	return Object.values(PRESET_SHIPS);
}

export function getShipsBySize(size: HullSizeValue): ShipHullSpecData[] {
	return Object.values(PRESET_SHIPS).filter((s) => s.size === size);
}

export function getShipsByClass(shipClass: ShipClassValue): ShipHullSpecData[] {
	return Object.values(PRESET_SHIPS).filter((s) => s.class === shipClass);
}
