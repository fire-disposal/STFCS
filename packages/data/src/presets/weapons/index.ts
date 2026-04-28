/**
 * 预设武器数据导出
 */

import railgunSmall from "./railgun-small.json";
import pulseLaserSmall from "./pulse-laser-small.json";
import grenadeSmall from "./grenade-small.json";
import cannonMedium from "./cannon-medium.json";
import plasmaMedium from "./plasma-medium.json";
import empDisruptorMedium from "./emp-disruptor-medium.json";
import missileLarge from "./missile-large.json";
import heavyTorpedoLarge from "./heavy-torpedo-large.json";

export const presetWeapons = [
	railgunSmall,
	pulseLaserSmall,
	grenadeSmall,
	cannonMedium,
	plasmaMedium,
	empDisruptorMedium,
	missileLarge,
	heavyTorpedoLarge,
] as const;

export type PresetWeapon = typeof presetWeapons[number];