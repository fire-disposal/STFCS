/**
 * 世界地图预设
 */
import demo from "./demo-sector.js";

export const presetWorlds = {
	demo: demo as any,
} as const;

export type PresetWorldId = keyof typeof presetWorlds;
