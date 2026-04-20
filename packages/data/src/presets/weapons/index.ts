/**
 * 预设武器数据导出
 */

import railgunSmall from "./railgun-small.json";
import laserMedium from "./laser-medium.json";
import missileLarge from "./missile-large.json";

export const presetWeapons = [
	railgunSmall,
	laserMedium,
	missileLarge,
] as const;

export type PresetWeapon = typeof presetWeapons[number];