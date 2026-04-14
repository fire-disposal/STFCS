/**
 * @vt/data - 游戏数据包
 *
 * 包含预设数据、游戏配置、伤害倍率等
 * 依赖 @vt/types 类型定义
 */

// 导出配置
export { DAMAGE_MODIFIERS, GAME_CONFIG, ARMOR_QUADRANT_NAMES } from "./config.js";

// 导出武器数据
export {
	PRESET_WEAPONS,
	getWeaponSpec,
	getAvailableWeapons,
	getWeaponsByCategory,
	getWeaponsByDamageType,
	type WeaponSpecData,
} from "./weapons.js";

// 导出舰船数据
export {
	PRESET_SHIPS,
	getShipHullSpec,
	getAvailableShips,
	getShipsBySize,
	getShipsByClass,
	type ShipHullSpecData,
	type WeaponMountSpecData,
} from "./ships.js";
