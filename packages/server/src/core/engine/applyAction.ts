/**
 * 核心引擎入口 - 应用 Action 到 GameRoomState
 *
 * Engine 层为纯计算层：
 * - 接受 GameRoomState（Record-based，与 @vt/data 一致）
 * - 返回 EngineResult（更新指令列表），不直接修改状态
 * - handlers.ts 负责通过 MutativeStateManager 执行更新
 *
 * 类型安全设计：
 * - ACTION_HANDLERS 的键类型从 @vt/data 的 GameActionName 派生
 * - GameActionName 来自 WsSchemas.ts 的 Zod enum（单一起源）
 * - 添加新 action 时，Zod enum + handler 映射不同步将在编译时报错
 */

import type { GameRoomState, GameActionName } from "@vt/data";
import type { EngineContext, EngineResult } from "./context.js";
import { createEngineContext } from "./context.js";
import { applyCombat, applyDeviation } from "./modules/combat.js";
import { applyMove, applyRotate, applyAdvancePhase } from "./modules/movement.js";
import { applyShieldToggle, applyShieldRotate } from "./modules/shield.js";
import { applyVent, applyEndTurn } from "./rules/turnEnd.js";

/** Action 处理函数签名 */
type ActionHandler = (context: EngineContext) => EngineResult;

/**
 * 客户端 Action 名称 → 处理函数映射表
 *
 * 键类型 GameActionName 来自 @vt/data 的 Zod enum（单一起源）。
 * 添加新 action 时需要同时更新 WsSchemas.ts 的 GAME_ACTION_NAMES 和此处，
 * 否则 TypeScript 编译报错。
 */
const ACTION_HANDLERS: { [K in GameActionName]: ActionHandler } = {
	move: applyMove,
	rotate: applyRotate,
	shield_toggle: applyShieldToggle,
	shield_rotate: applyShieldRotate,
	vent: applyVent,
	advance_phase: applyAdvancePhase,
	end_turn: applyEndTurn,
	attack: applyCombat,
	deviation: applyDeviation,
};

/**
 * 应用 Action 到游戏状态
 * @param state 当前游戏状态快照
 * @param actionType Action 类型（GameActionName，Zod 已校验）
 * @param playerId 发起玩家 ID
 * @param payload Action 负载
 * @returns 更新指令和事件列表
 */
export function applyAction(
	state: GameRoomState,
	actionType: string,
	playerId: string,
	payload: unknown
): EngineResult {
	const handler = ACTION_HANDLERS[actionType as GameActionName];
	if (!handler) {
		return { runtimeUpdates: [], events: [] };
	}
	const context = createEngineContext(state, actionType, playerId, payload);
	return handler(context);
}
