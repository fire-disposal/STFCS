/**
 * 游戏引擎核心入口
 * 基于 @vt/data 权威设计
 *
 * Engine 层为纯计算层：
 * - 接受 GameRoomState（Record-based，与 @vt/data 一致）
 * - 返回 EngineResult（更新指令列表），不直接修改状态
 * - handlers.ts 负责通过 MutativeStateManager 执行更新
 */

export * from "./applyAction.js";
export * from "./context.js";
export * from "./modules/index.js";
export * as rules from "./rules/index.js";
