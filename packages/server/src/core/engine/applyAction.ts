/**
 * 核心引擎入口 - 应用Action到GameState
 * 基于 @vt/data 权威设计
 */

import type { GameAction, GameEvent } from "../types/common.js";
import type { GameState } from "../types/common.js";
import { createEngineContext } from "./context.js";
import { applyMovement } from "./modules/movement.js";
import { applyCombat } from "./modules/combat.js";
import { applyFlux } from "./modules/flux.js";
import { applyShield } from "./modules/shield.js";
import { applyTurn } from "./modules/turn.js";
import { applyModifier } from "./modules/modifier.js";

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
  const context = createEngineContext(state, action);

  // 根据Action类型分发处理
  switch (action.type) {
    case "MOVE":
      return applyMovement(context);
    case "ATTACK":
      return applyCombat(context);
    case "ROTATE":
      return applyMovement(context); // 旋转作为移动的一部分
    case "END_TURN":
      return applyTurn(context);
    case "TOGGLE_SHIELD":
      return applyShield(context);
    case "VENT_FLUX":
      return applyFlux(context);
    case "APPLY_MODIFIER":
      return applyModifier(context);
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
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