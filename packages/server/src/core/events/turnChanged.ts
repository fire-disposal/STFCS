/**
 * 回合变化Event定义
 * 基于 @vt/data 权威设计
 */

import type { GameEvent } from "../types/common.js";

/**
 * 回合变化Event类型
 */
export interface TurnChangedEventPayload {
  turn: number;
  activeFaction: "PLAYER_ALLIANCE" | "FATE_GRIP" | undefined;
  previousTurn: number;
  previousFaction: "PLAYER_ALLIANCE" | "FATE_GRIP" | undefined;
  phase?: "DEPLOYMENT" | "PLAYER_ACTION";
  factionTurnPhase?: "MOVEMENT" | "COMBAT" | "END";
}

/**
 * 创建回合变化Event
 */
export function createTurnChangedEvent(payload: TurnChangedEventPayload): GameEvent {
  return {
    type: "TURN_CHANGED",
    timestamp: Date.now(),
    payload,
  };
}

/**
 * 验证回合变化Event负载
 */
export function validateTurnChangedPayload(payload: any): payload is TurnChangedEventPayload {
  if (!payload || typeof payload !== "object") return false;

  const required = ["turn", "activeFaction", "previousTurn", "previousFaction"];
  for (const field of required) {
    if (!(field in payload)) return false;
  }

  if (typeof payload.turn !== "number" || payload.turn < 1) return false;
  if (payload.activeFaction !== undefined && !["PLAYER_ALLIANCE", "FATE_GRIP"].includes(payload.activeFaction)) return false;
  if (typeof payload.previousTurn !== "number" || payload.previousTurn < 0) return false;
  if (payload.previousFaction !== undefined && !["PLAYER_ALLIANCE", "FATE_GRIP"].includes(payload.previousFaction)) return false;

  if (payload.phase !== undefined && !["DEPLOYMENT", "PLAYER_ACTION"].includes(payload.phase)) return false;
  if (payload.factionTurnPhase !== undefined && !["MOVEMENT", "COMBAT", "END"].includes(payload.factionTurnPhase)) return false;

  return true;
}
