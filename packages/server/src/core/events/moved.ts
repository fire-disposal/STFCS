/**
 * 移动Event定义
 * 基于 @vt/data 权威设计
 */

import type { GameEvent } from "../types/common.js";

/**
 * 移动Event类型
 */
export interface MovedEventPayload {
  shipId: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  distance: number;
  direction: "FORWARD" | "BACKWARD" | "STRAFE_LEFT" | "STRAFE_RIGHT";
  phase: "A" | "C";
  remainingMove: number; // 剩余移动力
}

/**
 * 创建移动Event
 */
export function createMovedEvent(payload: MovedEventPayload): GameEvent {
  return {
    type: "MOVED",
    timestamp: Date.now(),
    payload,
  };
}

/**
 * 验证移动Event负载
 */
export function validateMovedPayload(payload: any): payload is MovedEventPayload {
  if (!payload || typeof payload !== "object") return false;
  
  const required = ["shipId", "from", "to", "distance", "direction", "phase", "remainingMove"];
  for (const field of required) {
    if (!(field in payload)) return false;
  }
  
  if (typeof payload.shipId !== "string") return false;
  if (!payload.from || typeof payload.from.x !== "number" || typeof payload.from.y !== "number") return false;
  if (!payload.to || typeof payload.to.x !== "number" || typeof payload.to.y !== "number") return false;
  if (typeof payload.distance !== "number" || payload.distance < 0) return false;
  if (!["FORWARD", "BACKWARD", "STRAFE_LEFT", "STRAFE_RIGHT"].includes(payload.direction)) return false;
  if (!["A", "C"].includes(payload.phase)) return false;
  if (typeof payload.remainingMove !== "number" || payload.remainingMove < 0) return false;
  
  return true;
}