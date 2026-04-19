/**
 * 结束回合Action定义
 * 基于 @vt/data 权威设计
 */

import type { GameAction } from "../types/common.js";

/**
 * 结束回合Action类型
 */
export interface EndTurnActionPayload {
  // 无额外负载，仅表示结束当前回合
}

/**
 * 创建结束回合Action
 */
export function createEndTurnAction(playerId: string): GameAction {
  return {
    type: "END_TURN",
    playerId,
    timestamp: Date.now(),
    payload: {},
  };
}

/**
 * 验证结束回合Action负载
 */
export function validateEndTurnPayload(payload: any): payload is EndTurnActionPayload {
  // 结束回合Action没有必须的负载字段
  return payload && typeof payload === "object";
}