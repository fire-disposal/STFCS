import { PRESET_SHIPS } from "./ships.js";
import { PRESET_WEAPONS } from "./weapons.js";

export { PRESET_WEAPONS, getWeaponSpec, getAvailableWeapons, type WeaponSpec } from "./weapons.js";
export { PRESET_SHIPS, getShipHullSpec, getAvailableShips, type ShipHullSpec } from "./ships.js";
export { DAMAGE_MODIFIERS, GAME_CONFIG } from "./config.js";

export const DEFAULT_WEAPONS = PRESET_WEAPONS;
export const DEFAULT_SHIPS = PRESET_SHIPS;
export const DEFAULT_HULLS = PRESET_SHIPS;
