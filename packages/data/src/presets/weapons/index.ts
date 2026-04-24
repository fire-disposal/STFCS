/**
 * 预设武器数据导出
 */

import railgunSmall from "./railgun-small.json";
import pulseLaserSmall from "./pulse-laser-small.json";
import grenadeSmall from "./grenade-small.json";
import cannonMedium from "./cannon-medium.json";
import plasmaMedium from "./plasma-medium.json";
import missileLarge from "./missile-large.json";

export const presetWeapons = [
	railgunSmall,
	pulseLaserSmall,
	grenadeSmall,
	cannonMedium,
	plasmaMedium,
	missileLarge,
] as const;

export type PresetWeapon = typeof presetWeapons[number];