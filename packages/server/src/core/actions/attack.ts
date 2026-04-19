/**
 * 攻击Action定义
 * 基于 @vt/data 权威设计
 */

import type { GameAction } from "../types/common.js";

/**
 * 攻击Action类型
 */
export interface AttackActionPayload {
  attackerId: string;
  targetId: string;
  weaponId: string;
  fireMode?: "SINGLE" | "BURST" | "SUSTAINED";
  targetQuadrant?: number; // 0-5，指定攻击象限
}

/**
 * 创建攻击Action
 */
export function createAttackAction(
  playerId: string,
  payload: AttackActionPayload
): GameAction {
  return {
    type: "ATTACK",
    playerId,
    timestamp: Date.now(),
    payload,
  };
}

/**
 * 验证攻击Action负载
 */
export function validateAttackPayload(payload: any): payload is AttackActionPayload {
  if (!payload || typeof payload !== "object") return false;
  
  const required = ["attackerId", "targetId", "weaponId"];
  for (const field of required) {
    if (!(field in payload)) return false;
  }
  
  if (typeof payload.attackerId !== "string") return false;
  if (typeof payload.targetId !== "string") return false;
  if (typeof payload.weaponId !== "string") return false;
  
  if (payload.fireMode && !["SINGLE", "BURST", "SUSTAINED"].includes(payload.fireMode)) return false;
  if (payload.targetQuadrant !== undefined) {
    if (typeof payload.targetQuadrant !== "number" || payload.targetQuadrant < 0 || payload.targetQuadrant > 5) return false;
  }
  
  return true;
}