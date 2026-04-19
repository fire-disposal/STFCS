/**
 * 旋转Action定义
 * 基于 @vt/data 权威设计
 */

import type { GameAction } from "../types/common.js";

/**
 * 旋转Action类型
 */
export interface RotateActionPayload {
  shipId: string;
  angle: number; // 旋转角度（正数顺时针，负数逆时针）
  phase: "B"; // 旋转阶段B
}

/**
 * 创建旋转Action
 */
export function createRotateAction(
  playerId: string,
  payload: RotateActionPayload
): GameAction {
  return {
    type: "ROTATE",
    playerId,
    timestamp: Date.now(),
    payload,
  };
}

/**
 * 验证旋转Action负载
 */
export function validateRotatePayload(payload: any): payload is RotateActionPayload {
  if (!payload || typeof payload !== "object") return false;
  
  const required = ["shipId", "angle", "phase"];
  for (const field of required) {
    if (!(field in payload)) return false;
  }
  
  if (typeof payload.shipId !== "string") return false;
  if (typeof payload.angle !== "number") return false;
  if (payload.phase !== "B") return false;
  
  return true;
}