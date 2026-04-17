/**
 * ??•Ší”˜i¸?”Åj
 *
 * •ŠíˆÂÚ¡•ª?F
 * - SMALL: ¬Œ^•ŠíC?‡???
 * - MEDIUM: ’†Œ^•ŠíC?‡?’€?‹yˆÈã
 * - LARGE: ‘åŒ^•ŠíC?‡„—m?‹yˆÈã
 *
 * •ŠíŒ`?F
 * - TURRET: à{“ƒŒ^C‰Âù?CËŠE—R arc š’i™r’è
 * - HARDPOINT: d“_Œ^CŒÅ’èËŠE }10‹i‹¤ 20‹j
 */

import type { WeaponSpec, WeaponTagValue } from "./types.js";

// ==================== ¬Œ^•Ší ====================

const SMALL_WEAPONS: WeaponSpec[] = [
	// ?“¹•Ší - à{“ƒŒ^
	{
		id: "light_autocannon_turret",
		name: "Light Autocannon (Turret)",
		description: "Small kinetic autocannon, fast-firing anti-shield weapon.",
		category: "BALLISTIC",
		damageType: "KINETIC",
		mountType: "TURRET",
		size: "SMALL",
		damage: 15,
		range: 200,
		arc: 180,
		cooldown: 1.0,
		fluxCost: 5,
		ignoresShields: false,
		burstSize: 3,
		burstDelay: 0.1,
		opCost: 3,
		tags: ["ANTI_SHIP", "BALLISTIC"],
	},
	// ?“¹•Ší - d“_Œ^
	{
		id: "light_autocannon_hardpoint",
		name: "Light Autocannon (Hardpoint)",
		description: "Small kinetic autocannon, fixed mount with extended range.",
		category: "BALLISTIC",
		damageType: "KINETIC",
		mountType: "HARDPOINT",
		size: "SMALL",
		damage: 18,
		range: 250,
		arc: 20,  // d“_Œ^i??g—p hardpointArcj
		hardpointArc: 20,
		cooldown: 1.0,
		fluxCost: 5,
		ignoresShields: false,
		burstSize: 3,
		burstDelay: 0.1,
		opCost: 3,
		tags: ["ANTI_SHIP", "BALLISTIC"],
	},
	// ”\—Ê•Ší - à{“ƒŒ^
	{
		id: "pulse_laser_small",
		name: "Pulse Laser (Small)",
		description: "Small energy laser, balanced universal weapon.",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "TURRET",
		size: "SMALL",
		damage: 12,
		range: 180,
		arc: 360,
		cooldown: 0.8,
		fluxCost: 4,
		ignoresShields: false,
		opCost: 3,
		tags: ["ANTI_SHIP", "BEAM"],
	},
	// “_–hŒä•Ší - à{“ƒŒ^
	{
		id: "pd_laser",
		name: "PD Laser",
		description: "Small laser point defense, fast missile interception.",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "TURRET",
		size: "SMALL",
		damage: 4,
		range: 120,
		arc: 360,
		cooldown: 0.3,
		fluxCost: 1,
		ignoresShields: false,
		opCost: 1,
		tags: ["PD", "BEAM"],
	},
	// ??•Ší - d“_Œ^i??’Êí?d“_j
	{
		id: "swarmer",
		name: "Swarmer SRM",
		description: "Small tracking missiles, multi-shot barrage.",
		category: "MISSILE",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "HARDPOINT",
		size: "SMALL",
		damage: 10,
		range: 300,
		arc: 90,
		hardpointArc: 90,  // ??d“_‰ÂˆÈ—LX?ËŠE
		cooldown: 2.0,
		fluxCost: 3,
		ignoresShields: false,
		burstSize: 4,
		burstDelay: 0.2,
		ammo: 12,
		reloadTime: 5,
		tracking: 0.7,
		opCost: 3,
		tags: ["ANTI_SHIP", "GUIDED", "HE"],
	},
];

// ==================== ’†Œ^•Ší ====================

const MEDIUM_WEAPONS: WeaponSpec[] = [
	// ?“¹•Ší - à{“ƒŒ^
	{
		id: "autocannon",
		name: "Autocannon",
		description: "Medium kinetic autocannon, balanced anti-shield weapon.",
		category: "BALLISTIC",
		damageType: "KINETIC",
		mountType: "TURRET",
		size: "MEDIUM",
		damage: 25,
		range: 250,
		arc: 360,
		cooldown: 1.5,
		fluxCost: 8,
		ignoresShields: false,
		opCost: 5,
		tags: ["ANTI_SHIP", "BALLISTIC", "KINETIC"],
	},
	// ?“¹•Ší - d“_Œ^
	{
		id: "heavy_mortar_hardpoint",
		name: "Heavy Mortar (Hardpoint)",
		description: "Medium HE mortar, high per-shot anti-armor damage.",
		category: "BALLISTIC",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "HARDPOINT",
		size: "MEDIUM",
		damage: 60,
		range: 350,
		arc: 20,
		hardpointArc: 20,
		cooldown: 3.0,
		fluxCost: 6,
		ignoresShields: false,
		opCost: 6,
		tags: ["ANTI_SHIP", "HE"],
	},
	// ”\—Ê•Ší - à{“ƒŒ^
	{
		id: "pulse_laser",
		name: "Pulse Laser",
		description: "Medium energy laser, stable universal weapon.",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "TURRET",
		size: "MEDIUM",
		damage: 15,
		range: 200,
		arc: 360,
		cooldown: 1.0,
		fluxCost: 6,
		ignoresShields: false,
		opCost: 5,
		tags: ["ANTI_SHIP", "BEAM"],
	},
	// ??•Ší - d“_Œ^
	{
		id: "harpoon",
		name: "Harpoon MRM",
		description: "Medium tracking missile, high-speed long-range strike.",
		category: "MISSILE",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "HARDPOINT",
		size: "MEDIUM",
		damage: 60,
		range: 500,
		arc: 60,
		hardpointArc: 60,
		cooldown: 3.0,
		fluxCost: 12,
		ignoresShields: false,
		ammo: 3,
		reloadTime: 8,
		tracking: 0.9,
		opCost: 9,
		tags: ["ANTI_SHIP", "GUIDED", "HE"],
	},
];

// ==================== ‘åŒ^•Ší ====================

const LARGE_WEAPONS: WeaponSpec[] = [
	// ?“¹•Ší - à{“ƒŒ^
	{
		id: "heavy_autocannon",
		name: "Heavy Autocannon",
		description: "Large kinetic autocannon, high damage anti-shield main gun.",
		category: "BALLISTIC",
		damageType: "KINETIC",
		mountType: "TURRET",
		size: "LARGE",
		damage: 40,
		range: 300,
		arc: 240,
		cooldown: 2.0,
		fluxCost: 15,
		ignoresShields: false,
		opCost: 12,
		tags: ["ANTI_SHIP", "BALLISTIC", "KINETIC", "SUPPRESSION"],
	},
	// ?“¹•Ší - d“_Œ^
	{
		id: "hellbore",
		name: "Hellbore Cannon",
		description: "Large HE cannon, extreme per-shot anti-armor damage.",
		category: "BALLISTIC",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "HARDPOINT",
		size: "LARGE",
		damage: 150,
		range: 400,
		arc: 20,
		hardpointArc: 20,
		cooldown: 5.0,
		fluxCost: 12,
		ignoresShields: false,
		opCost: 15,
		tags: ["ANTI_SHIP", "HE"],
	},
	// ”\—Ê•Ší - à{“ƒŒ^
	{
		id: "plasma_cannon",
		name: "Plasma Cannon",
		description: "Large plasma weapon, high damage turret.",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "TURRET",
		size: "LARGE",
		damage: 60,
		range: 350,
		arc: 180,
		cooldown: 2.5,
		fluxCost: 25,
		ignoresShields: false,
		opCost: 14,
		tags: ["ANTI_SHIP", "BEAM"],
	},
	// ”\—Ê•Ší - d“_Œ^
	{
		id: "tachyon_lance",
		name: "Tachyon Lance",
		description: "Large energy beam, extreme long-range damage.",
		category: "ENERGY",
		damageType: "ENERGY",
		mountType: "HARDPOINT",
		size: "LARGE",
		damage: 80,
		range: 500,
		arc: 20,
		hardpointArc: 15,
		cooldown: 3.5,
		fluxCost: 30,
		ignoresShields: false,
		opCost: 16,
		tags: ["ANTI_SHIP", "BEAM", "SUPPRESSION"],
	},
	// ??•Ší - d“_Œ^
	{
		id: "cyclone_reaper",
		name: "Cyclone Reaper",
		description: "Large HE missile barrage, dense strike.",
		category: "MISSILE",
		damageType: "HIGH_EXPLOSIVE",
		mountType: "HARDPOINT",
		size: "LARGE",
		damage: 70,
		range: 450,
		arc: 120,
		hardpointArc: 120,
		cooldown: 3.0,
		fluxCost: 20,
		ignoresShields: false,
		burstSize: 4,
		burstDelay: 0.3,
		ammo: 8,
		reloadTime: 15,
		tracking: 0.8,
		opCost: 12,
		tags: ["ANTI_SHIP", "GUIDED", "HE"],
	},
];

// ==================== ??•Ší’™e•\ ====================

export const PRESET_WEAPONS: Record<string, WeaponSpec> = {
	...Object.fromEntries(SMALL_WEAPONS.map((w) => [w.id, w])),
	...Object.fromEntries(MEDIUM_WEAPONS.map((w) => [w.id, w])),
	...Object.fromEntries(LARGE_WEAPONS.map((w) => [w.id, w])),
};

// ==================== ?•”Ÿ” ====================

export function getWeaponSpec(id: string): WeaponSpec | undefined {
	return PRESET_WEAPONS[id];
}

export function getAvailableWeapons(): WeaponSpec[] {
	return Object.values(PRESET_WEAPONS);
}

/** ˆÂÚ¡?æ•Ší—ñ•\ */
export function getWeaponsBySize(size: string): WeaponSpec[] {
	return Object.values(PRESET_WEAPONS).filter((w) => w.size === size);
}

/** ˆÂ???æ•Ší—ñ•\ */
export function getWeaponsByCategory(category: string): WeaponSpec[] {
	return Object.values(PRESET_WEAPONS).filter((w) => w.category === category);
}

/** ˆÂŒ`??æ•Ší—ñ•\ */
export function getWeaponsByMountType(mountType: string): WeaponSpec[] {
	return Object.values(PRESET_WEAPONS).filter((w) => w.mountType === mountType);
}

/** ?Z•Ší”z’u“I OP ?Á–Õ */
export function calculateOpCost(loadout: { weaponId: string }[]): number {
	return loadout.reduce((sum, entry) => {
		const weapon = getWeaponSpec(entry.weaponId);
		return sum + (weapon?.opCost ?? 0);
	}, 0);
}

/** •ŠíÚ¡–‡?? */
export const WeaponSizeList = ["SMALL", "MEDIUM", "LARGE"] as const;