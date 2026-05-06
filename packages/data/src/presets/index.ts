/**
 * 预设数据统一导出
 *
 * 所有预设舰船、武器 JSON 数据从本文件导出
 * 后端 PresetLoader 从这里导入并验证后存入 persistence 层
 */

export { presetShips, type PresetShip } from "./ships/index.js";
export { presetWeapons, type PresetWeapon } from "./weapons/index.js";
export { presetWorlds, type PresetWorldId } from "./world/index.js";