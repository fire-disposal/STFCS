/**
 * 辐能变化Event定义
 * 基于 @vt/data 权威设计
 */

import type { GameEvent } from "../types/common.js";

/**
 * 辐能变化Event类型
 */
export interface FluxChangedEventPayload {
  shipId: string;
  fluxSoft: number;
  fluxHard: number;
  totalFlux: number;
  changeType: "GENERATED" | "DISSIPATED" | "VENTED" | "OVERLOAD_CLEARED";
  changeAmount: number;
  sourceId?: string; // 变化来源（如武器ID）
  weaponId?: string;
  isOverloaded: boolean;
  overloadTimeRemaining?: number;
}

/**
 * 创建辐能变化Event
 */
export function createFluxChangedEvent(payload: FluxChangedEventPayload): GameEvent {
  return {
    type: "FLUX_CHANGED",
    timestamp: Date.now(),
    payload,
  };
}

/**
 * 验证辐能变化Event负载
 */
export function validateFluxChangedPayload(payload: any): payload is FluxChangedEventPayload {
  if (!payload || typeof payload !== "object") return false;
  
  const required = [
    "shipId", "fluxSoft", "fluxHard", "totalFlux", 
    "changeType", "changeAmount", "isOverloaded"
  ];
  
  for (const field of required) {
    if (!(field in payload)) return false;
  }
  
  if (typeof payload.shipId !== "string") return false;
  if (typeof payload.fluxSoft !== "number" || payload.fluxSoft < 0) return false;
  if (typeof payload.fluxHard !== "number" || payload.fluxHard < 0) return false;
  if (typeof payload.totalFlux !== "number" || payload.totalFlux < 0) return false;
  if (!["GENERATED", "DISSIPATED", "VENTED", "OVERLOAD_CLEARED"].includes(payload.changeType)) return false;
  if (typeof payload.changeAmount !== "number") return false;
  if (typeof payload.isOverloaded !== "boolean") return false;
  
  if (payload.sourceId !== undefined && typeof payload.sourceId !== "string") return false;
  if (payload.weaponId !== undefined && typeof payload.weaponId !== "string") return false;
  if (payload.overloadTimeRemaining !== undefined) {
    if (typeof payload.overloadTimeRemaining !== "number" || payload.overloadTimeRemaining < 0) return false;
  }
  
  return true;
}