import { PRESET_SHIPS } from "./ships.js";
import { PRESET_WEAPONS } from "./weapons.js";

// 导出类型
export * from "./types.js";

// 导出数据
export { PRESET_WEAPONS, getWeaponSpec, getAvailableWeapons } from "./weapons.js";
export { PRESET_SHIPS, getShipHullSpec, getAvailableShips } from "./ships.js";
export { DAMAGE_MODIFIERS, GAME_CONFIG } from "./config.js";

export const DEFAULT_WEAPONS = PRESET_WEAPONS;
export const DEFAULT_SHIPS = PRESET_SHIPS;
export const DEFAULT_HULLS = PRESET_SHIPS;
