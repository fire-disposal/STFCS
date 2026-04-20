/**
 * 核心引擎入口 - 应用Action到GameState
 * 基于 @vt/data 权威设计
 */

import type { GameAction, GameEvent } from "../types/common.js";
import type { GameState } from "../types/common.js";
import type { EngineContext } from "./context.js";
import { createEngineContext } from "./context.js";
import { applyMovement } from "./modules/movement.js";
import { applyCombat } from "./modules/combat.js";
import { applyFlux } from "./modules/flux.js";
import { applyShield } from "./modules/shield.js";
import { applyTurn } from "./modules/turn.js";
import { applyModifier } from "./modules/modifier.js";

/** Action 处理函数签名 */
type ActionHandler = (context: EngineContext) => { newState: GameState; events: GameEvent[] };

/** Action 类型到处理函数的映射表 */
const ACTION_HANDLERS: Record<string, ActionHandler> = {
	MOVE: applyMovement,
	ATTACK: applyCombat,
	ROTATE: applyMovement, // 旋转作为移动的一部分
	END_TURN: applyTurn,
	TOGGLE_SHIELD: applyShield,
	VENT_FLUX: applyFlux,
	APPLY_MODIFIER: applyModifier,
};

/**
 * 应用Action到游戏状态
 * @param state 当前游戏状态
 * @param action 要应用的Action
 * @returns 更新后的游戏状态和产生的事件
 */
export function applyAction(
	state: GameState,
	action: GameAction
): { newState: GameState; events: GameEvent[] } {
	const handler = ACTION_HANDLERS[action.type];
	if (!handler) {
		throw new Error(`Unknown action type: ${action.type}`);
	}
	return handler(createEngineContext(state, action));
}

/**
 * 批量应用Actions
 */
export function applyActions(
  state: GameState,
  actions: GameAction[]
): { newState: GameState; events: GameEvent[] } {
  let currentState = state;
  const allEvents: GameEvent[] = [];

  for (const action of actions) {
    const result = applyAction(currentState, action);
    currentState = result.newState;
    allEvents.push(...result.events);
  }

  return { newState: currentState, events: allEvents };
}