/**
 * 预设舰船数据
 */

import type { ShipHullSpec } from "./types.js";

;

export const PRESET_SHIPS: Record<string, ShipHullSpec> = {
	frigate: {
		id: "frigate",
		name: "护卫舰",
		size: "FRIGATE",
		class: "ASSAULT",
		width: 40,
		length: 80,
		hitPoints: 800,
		hullPoints: 800,
		armorMax: 150,
		armorValue: 150,
		fluxCapacity: 200,
		fluxDissipation: 20,
		hasShield: true,
		shieldType: "FRONT",
		shieldArc: 120,
		shieldRadius: 60,
		maxSpeed: 100,
		maxTurnRate: 30,
		weaponMounts: [
			{
				id: "m1",
				type: "TURRET",
				size: "SMALL",
				position: { x: 30, y: 0 },
				facing: 0,
				arc: 90,
				defaultWeapon: "autocannon",
			},
		],
	},
	destroyer: {
		id: "destroyer",
		name: "驱逐舰",
		size: "DESTROYER",
		class: "COMBAT",
		width: 60,
		length: 120,
		hitPoints: 1500,
		hullPoints: 1500,
		armorMax: 200,
		armorValue: 200,
		fluxCapacity: 400,
		fluxDissipation: 40,
		hasShield: true,
		shieldType: "FRONT",
		shieldArc: 90,
		shieldRadius: 80,
		maxSpeed: 70,
		maxTurnRate: 20,
		weaponMounts: [
			{
				id: "m1",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: 50, y: 0 },
				facing: 0,
				arc: 90,
				defaultWeapon: "autocannon",
			},
			{
				id: "m2",
				type: "TURRET",
				size: "SMALL",
				position: { x: -30, y: 0 },
				facing: 180,
				arc: 60,
				defaultWeapon: "pulse_laser",
			},
		],
	},
	cruiser: {
		id: "cruiser",
		name: "巡洋舰",
		size: "CRUISER",
		class: "HEAVY",
		width: 80,
		length: 160,
		hitPoints: 3000,
		hullPoints: 3000,
		armorMax: 400,
		armorValue: 400,
		fluxCapacity: 600,
		fluxDissipation: 60,
		hasShield: true,
		shieldType: "FRONT",
		shieldArc: 120,
		shieldRadius: 100,
		maxSpeed: 50,
		maxTurnRate: 15,
		weaponMounts: [
			{
				id: "m1",
				type: "FIXED",
				size: "LARGE",
				position: { x: 70, y: 0 },
				facing: 0,
				arc: 30,
				defaultWeapon: "missile",
			},
			{
				id: "m2",
				type: "TURRET",
				size: "MEDIUM",
				position: { x: 20, y: 0 },
				facing: 0,
				arc: 120,
				defaultWeapon: "pulse_laser",
			},
		],
	},
};

export function getShipHullSpec(id: string): ShipHullSpec | undefined {
	return PRESET_SHIPS[id];
}

export function getAvailableShips(): ShipHullSpec[] {
	return Object.values(PRESET_SHIPS);
}
