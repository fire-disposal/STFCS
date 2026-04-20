/**
 * Core 模块导出
 *
 * 所有核心游戏模型从 GameSchemas（Zod Schema）统一导出
 */

export * from "./GameSchemas.js";
export * from "./ActionSchemas.js";

// ==================== 数据注册器 ====================
export { DataRegistry, dataRegistry } from "./DataRegistry.js";
