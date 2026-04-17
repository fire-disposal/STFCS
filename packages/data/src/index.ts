// 导出所有类型
export * from "./types.js";

// 导出武器数据
export {
	PRESET_WEAPONS,
	getWeaponSpec,
	getAvailableWeapons,
	getWeaponsBySize,
	getWeaponsByCategory,
	getWeaponsByMountType,
	calculateOpCost,
	WeaponSizeList,
} from "./weapons.js";

// 导出舰船数据
export {
	PRESET_SHIPS,
	STATION_SPEC,
	ASTEROID_SPEC,
	getShipHullSpec,
	getAvailableShips,
	getShipsBySize,
	getShipOpCapacity,
	calculateShipOpUsed,
	ShipSizeList,
} from "./ships.js";

// 导出配置
export {
	DAMAGE_MODIFIERS,
	GAME_CONFIG,
	ARMOR_QUADRANT_NAMES,
} from "./config.js";

// 兼容别名（重新导出）
export { PRESET_WEAPONS as DEFAULT_WEAPONS } from "./weapons.js";
export { PRESET_SHIPS as DEFAULT_SHIPS, PRESET_SHIPS as DEFAULT_HULLS } from "./ships.js";