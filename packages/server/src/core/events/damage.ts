/**
 * 伤害Event定义
 * 基于 @vt/data 权威设计
 */

import type { GameEvent } from "../types/common.js";

/**
 * 伤害Event类型
 */
export interface DamageEventPayload {
  targetId: string;
  damage: number;
  damageType: "KINETIC" | "HIGH_EXPLOSIVE" | "ENERGY" | "FRAGMENTATION";
  sourceId: string;
  weaponId?: string;
  shieldHit: boolean;
  armorHit: boolean;
  armorQuadrant?: number; // 0-5
  hullDamage: number;
  armorDamage: number;
  fluxGenerated: number;
  targetDestroyed: boolean;
  targetOverloaded: boolean;
}

/**
 * 创建伤害Event
 */
export function createDamageEvent(payload: DamageEventPayload): GameEvent {
  return {
    type: "DAMAGE_APPLIED",
    timestamp: Date.now(),
    payload,
  };
}

/**
 * 验证伤害Event负载
 */
export function validateDamagePayload(payload: any): payload is DamageEventPayload {
  if (!payload || typeof payload !== "object") return false;
  
  const required = [
    "targetId", "damage", "damageType", "sourceId", 
    "shieldHit", "armorHit", "hullDamage", "armorDamage",
    "fluxGenerated", "targetDestroyed", "targetOverloaded"
  ];
  
  for (const field of required) {
    if (!(field in payload)) return false;
  }
  
  if (typeof payload.targetId !== "string") return false;
  if (typeof payload.damage !== "number" || payload.damage < 0) return false;
  if (!["KINETIC", "HIGH_EXPLOSIVE", "ENERGY", "FRAGMENTATION"].includes(payload.damageType)) return false;
  if (typeof payload.sourceId !== "string") return false;
  if (typeof payload.shieldHit !== "boolean") return false;
  if (typeof payload.armorHit !== "boolean") return false;
  if (typeof payload.hullDamage !== "number" || payload.hullDamage < 0) return false;
  if (typeof payload.armorDamage !== "number" || payload.armorDamage < 0) return false;
  if (typeof payload.fluxGenerated !== "number" || payload.fluxGenerated < 0) return false;
  if (typeof payload.targetDestroyed !== "boolean") return false;
  if (typeof payload.targetOverloaded !== "boolean") return false;
  
  if (payload.weaponId !== undefined && typeof payload.weaponId !== "string") return false;
  if (payload.armorQuadrant !== undefined) {
    if (typeof payload.armorQuadrant !== "number" || payload.armorQuadrant < 0 || payload.armorQuadrant > 5) return false;
  }
  
  return true;
}