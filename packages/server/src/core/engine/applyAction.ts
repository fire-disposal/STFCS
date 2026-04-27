/**
 * 核心引擎入口 - 应用 Action 到 GameRoomState
 *
 * Engine 层为纯计算层：
 * - 接受 GameRoomState（Record-based，与 @vt/data 一致）
 * - 返回 EngineResult（更新指令列表），不直接修改状态
 * - handlers.ts 负责通过 MutativeStateManager 执行更新
 */

import type { GameRoomState } from "@vt/data";
import type { EngineContext, EngineResult } from "./context.js";
import { createEngineContext } from "./context.js";
import { applyCombat, applyDeviation } from "./modules/combat.js";
import { applyMove, applyRotate, applyAdvancePhase } from "./modules/movement.js";
import { applyShieldToggle, applyShieldRotate } from "./modules/shield.js";
import { applyVent } from "./modules/flux.js";
import { applyEndTurn } from "./rules/turnEnd.js";

/** Action 处理函数签名 */
type ActionHandler = (context: EngineContext) => EngineResult;

// ==================== Engine Action 类型常量 ====================

/**
 * Engine 支持的 Action 类型枚举
 * 使用 const object + type 模式，无需额外的 Enum 关键字开销
 */
export const EngineActionType = {
	MOVE: "MOVE",
	ROTATE: "ROTATE",
	SHIELD_TOGGLE: "SHIELD_TOGGLE",
	SHIELD_ROTATE: "SHIELD_ROTATE",
	VENT: "VENT",
	ADVANCE_PHASE: "ADVANCE_PHASE",
	END_TURN: "END_TURN",
	ATTACK: "ATTACK",
	DEVIATION: "DEVIATION",
} as const;

export type EngineActionType = (typeof EngineActionType)[keyof typeof EngineActionType];

/**
 * 客户端 Action 名称 → Engine Action 类型映射表
 *
 * 客户端通过 ws payload 发送的 action 名称（如 "move"、"rotate"）
 * 映射到 Engine 层的内部 Action 类型（如 "MOVE"、"ROTATE"）。
 *
 * 这个映射集中在此处管理，消除 handlers.ts 中的内联映射表风险。
 */
export const CLIENT_ACTION_MAP: Record<string, EngineActionType> = {
	move: EngineActionType.MOVE,
	rotate: EngineActionType.ROTATE,
	shield_toggle: EngineActionType.SHIELD_TOGGLE,
	shield_rotate: EngineActionType.SHIELD_ROTATE,
	vent: EngineActionType.VENT,
	advance_phase: EngineActionType.ADVANCE_PHASE,
	end_turn: EngineActionType.END_TURN,
	attack: EngineActionType.ATTACK,
	deviation: EngineActionType.DEVIATION,
};

/** Action 类型到处理函数的映射表 */
const ACTION_HANDLERS: Record<string, ActionHandler> = {
	[EngineActionType.MOVE]: applyMove,
	[EngineActionType.ROTATE]: applyRotate,
	[EngineActionType.SHIELD_TOGGLE]: applyShieldToggle,
	[EngineActionType.SHIELD_ROTATE]: applyShieldRotate,
	[EngineActionType.VENT]: applyVent,
	[EngineActionType.ADVANCE_PHASE]: applyAdvancePhase,
	[EngineActionType.END_TURN]: applyEndTurn,
	[EngineActionType.ATTACK]: applyCombat,
	[EngineActionType.DEVIATION]: applyDeviation,
};

/**
 * 应用 Action 到游戏状态
 * @param state 当前游戏状态快照
 * @param actionType Action 类型
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
	const handler = ACTION_HANDLERS[actionType];
	if (!handler) {
		return { runtimeUpdates: [], events: [] };
	}
	const context = createEngineContext(state, actionType, playerId, payload);
	return handler(context);
}
