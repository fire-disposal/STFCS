/**
 * contracts 包统一入口
 *
 * 所有类型、枚举、Schema、接口均从 definitions 导出
 * 这是唯一事实来源
 */

export { PROTOCOL_VERSION } from "./core-types.js";

// ==================== 统一定义导出（唯一事实来源） ====================
export * from "./definitions/index.js";

// ==================== 消息协议 Schema ====================
export * from "./messages.js";

// ==================== 其他模块导出 ====================
export * from "./protocol/index.js";
export * from "./constants/index.js";

// ==================== Config 模块（选择性导出，避免冲突） ====================
export type { ShipDefinition } from "./config/schemas.js";
export type {
	CreateShipInstanceParams,
	ShipInstanceState,
	IConfigLoader,
	ConfigValidationResult,
	ConfigValidationError,
	AssetRef,
} from "./config/types.js";
export {
	validateShipDefinition,
	mergeShipDefinition,
	DEFAULT_SHIPS,
	DEFAULT_SHIP_WOLF,
	DEFAULT_SHIP_HAMMERHEAD,
	DEFAULT_SHIP_FALCON,
} from "./config/index.js";

// ==================== Types 模块（选择性导出） ====================
export type { FactionId } from "./types/index.js";

// combatLog
export { combatLog } from "./combatLog.js";
export type { CombatLogEntry, LogFilter, LogLevel, LogType } from "./combatLog.js";

// 废弃的兼容性导出已全部清理，请使用 definitions 导出的类型
