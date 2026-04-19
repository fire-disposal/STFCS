/**
 * 移动Action定义
 * 基于 @vt/data 权威设计
 */

import type { GameAction } from "../types/common.js";

/**
 * 移动Action类型
 */
export interface MoveActionPayload {
  shipId: string;
  distance: number;
  direction: "FORWARD" | "BACKWARD" | "STRAFE_LEFT" | "STRAFE_RIGHT";
  phase: "A" | "C"; // 移动阶段A或C
}

/**
 * 创建移动Action
 */
export function createMoveAction(
  playerId: string,
  payload: MoveActionPayload
): GameAction {
  return {
    type: "MOVE",
    playerId,
    timestamp: Date.now(),
    payload,
  };
}

/**
 * 验证移动Action负载
 */
export function validateMovePayload(payload: any): payload is MoveActionPayload {
  if (!payload || typeof payload !== "object") return false;
  
  const required = ["shipId", "distance", "direction", "phase"];
  for (const field of required) {
    if (!(field in payload)) return false;
  }
  
  if (typeof payload.shipId !== "string") return false;
  if (typeof payload.distance !== "number" || payload.distance < 0) return false;
  if (!["FORWARD", "BACKWARD", "STRAFE_LEFT", "STRAFE_RIGHT"].includes(payload.direction)) return false;
  if (!["A", "C"].includes(payload.phase)) return false;
  
  return true;
}