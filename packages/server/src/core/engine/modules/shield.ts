/**
 * 护盾模块
 * 基于 @vt/data 权威设计
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createShieldToggleEvent } from "../context.js";
import { angleBetween } from "../geometry/index.js";

/**
 * 应用护盾Action
 */
export function applyShield(context: EngineContext): { newState: any; events: any[] } {
  const { state, action, ship } = context;
  const payload = action.payload as any;
  
  if (!ship) {
    throw new Error("Ship not found for shield action");
  }

  const events = [];
  const updates = new Map<string, any>();

  if (action.type === "TOGGLE_SHIELD") {
    // 处理护盾切换
    const shieldResult = processShieldToggle(ship, payload);
    
    // 更新舰船护盾状态
    updates.set(`ship:${ship.id}`, {
      runtime: shieldResult.newRuntime,
    });

    // 创建护盾切换事件
    events.push(createShieldToggleEvent(
      ship.id,
      shieldResult.newRuntime.shield?.active || false,
      shieldResult.previousActive
    ));
  }

  // 应用状态更新
  const newState = applyStateUpdates(state, updates);

  return { newState, events };
}

/**
 * 处理护盾切换
 */
function processShieldToggle(ship: any, payload: any) {
  const runtime = { ...ship.runtime };
  const spec = ship.shipJson.ship;
  
  const previousActive = runtime.shield?.active || false;
  const newActive = payload.active !== undefined ? payload.active : !previousActive;

  // 初始化护盾状态
  if (!runtime.shield) {
    runtime.shield = {
      active: false,
      value: spec.shield?.radius || 0,
    };
  }

  // 更新护盾状态
  runtime.shield.active = newActive;

  // 如果开启护盾，检查是否会产生辐能
  if (newActive && !previousActive) {
    const shieldUpkeep = spec.shield?.upkeep || 0;
    if (shieldUpkeep > 0) {
      runtime.fluxSoft = (runtime.fluxSoft || 0) + shieldUpkeep;
    }
  }

  return {
    newRuntime: runtime,
    previousActive,
  };
}

/**
 * 检查攻击是否命中护盾
 */
export function checkShieldHit(
  ship: any,
  attackAngle: number, // 攻击方向角度
  hitPosition: { x: number; y: number }
): { hit: boolean; angleDiff: number } {
  const spec = ship.shipJson.ship;
  const runtime = ship.runtime;

  // 检查护盾是否开启
  if (!runtime.shield?.active || !spec.shield) {
    return { hit: false, angleDiff: 0 };
  }

  // 计算攻击相对于舰船的角度
  const shipAngle = runtime.heading || 0;
  const relativeAttackAngle = ((attackAngle - shipAngle + 360) % 360);

  // 计算护盾方向
  const shieldDirection = spec.shield.direction || 0;
  const shieldArc = spec.shield.arc || 360;

  // 计算角度差
  const angleDiff = Math.abs(((relativeAttackAngle - shieldDirection + 180) % 360) - 180);

  // 检查是否在护盾覆盖范围内
  const hit = angleDiff <= shieldArc / 2;

  return { hit, angleDiff };
}

/**
 * 计算护盾吸收的伤害
 */
export function calculateShieldAbsorption(
  damage: number,
  damageType: string,
  shieldSpec: any
): { absorbedDamage: number; fluxGenerated: number } {
  const efficiency = shieldSpec.efficiency || 1.0;
  
  // 根据伤害类型计算护盾伤害倍率
  let shieldMultiplier = 1.0;
  switch (damageType) {
    case "KINETIC":
      shieldMultiplier = 2.0; // 动能对护盾伤害加倍
      break;
    case "HIGH_EXPLOSIVE":
      shieldMultiplier = 0.5; // 高爆对护盾伤害减半
      break;
    case "ENERGY":
      shieldMultiplier = 1.0; // 能量伤害正常
      break;
    case "FRAGMENTATION":
      shieldMultiplier = 0.25; // 破片对护盾伤害大幅减少
      break;
  }

  const shieldDamage = damage * shieldMultiplier;
  const fluxGenerated = shieldDamage * efficiency;

  return {
    absorbedDamage: shieldDamage,
    fluxGenerated,
  };
}

/**
 * 更新护盾值
 */
export function updateShieldValue(
  shieldRuntime: any,
  shieldSpec: any,
  damage: number
): any {
  const newShield = { ...shieldRuntime };
  
  // 减少护盾值
  newShield.value = Math.max(0, (newShield.value || 0) - damage);
  
  // 如果护盾值降为0，自动关闭护盾
  if (newShield.value <= 0) {
    newShield.active = false;
    newShield.value = 0;
  }

  return newShield;
}

/**
 * 检查护盾切换合法性
 */
export function validateShieldToggle(ship: any, newActive: boolean): { valid: boolean; error?: string } {
  const runtime = ship.runtime;
  const spec = ship.shipJson.ship;

  // 检查舰船状态
  if (runtime.destroyed) {
    return { valid: false, error: "Ship is destroyed" };
  }

  if (runtime.overloaded) {
    return { valid: false, error: "Ship is overloaded" };
  }

  // 检查舰船是否有护盾
  if (!spec.shield) {
    return { valid: false, error: "Ship has no shield" };
  }

  // 检查护盾状态是否已经是指定状态
  const currentActive = runtime.shield?.active || false;
  if (currentActive === newActive) {
    return { valid: false, error: `Shield is already ${newActive ? "active" : "inactive"}` };
  }

  // 检查开启护盾时的辐能
  if (newActive) {
    const shieldUpkeep = spec.shield.upkeep || 0;
    const currentFlux = (runtime.fluxSoft || 0) + (runtime.fluxHard || 0);
    const fluxCapacity = spec.fluxCapacity || 0;
    
    if (currentFlux + shieldUpkeep > fluxCapacity) {
      return { valid: false, error: "Insufficient flux capacity for shield upkeep" };
    }
  }

  return { valid: true };
}

/**
 * 计算护盾覆盖角度
 */
export function calculateShieldCoverage(
  shieldSpec: any,
  shipHeading: number
): { startAngle: number; endAngle: number } {
  const shieldDirection = shieldSpec.direction || 0;
  const shieldArc = shieldSpec.arc || 360;
  
  const centerAngle = (shipHeading + shieldDirection) % 360;
  const halfArc = shieldArc / 2;
  
  const startAngle = (centerAngle - halfArc + 360) % 360;
  const endAngle = (centerAngle + halfArc) % 360;
  
  return { startAngle, endAngle };
}