/**
 * 辐能模块
 * 基于 @vt/data 权威设计
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createFluxChangeEvent } from "../context.js";

/**
 * 应用辐能Action
 */
export function applyFlux(context: EngineContext): { newState: any; events: any[] } {
  const { state, action, ship } = context;
  
  if (!ship) {
    throw new Error("Ship not found for flux action");
  }

  const events = [];
  const updates = new Map<string, any>();

  if (action.type === "VENT_FLUX") {
    // 处理排散辐能
    const ventResult = processFluxVent(ship);
    
    // 更新舰船辐能状态
    updates.set(`ship:${ship.id}`, {
      runtime: ventResult.newRuntime,
    });

    // 创建辐能变化事件
    events.push(createFluxChangeEvent({
      shipId: ship.id,
      fluxSoft: ventResult.newRuntime.fluxSoft || 0,
      fluxHard: ventResult.newRuntime.fluxHard || 0,
      totalFlux: (ventResult.newRuntime.fluxSoft || 0) + (ventResult.newRuntime.fluxHard || 0),
      changeType: "VENTED",
      changeAmount: ventResult.ventedAmount,
      isOverloaded: ventResult.newRuntime.overloaded || false,
    }));

  } else if (action.type === "END_TURN") {
    // 处理回合结束时的辐能消散
    const dissipationResult = processFluxDissipation(state);
    
    // 应用所有舰船的辐能更新
    for (const [shipId, shipUpdate] of dissipationResult.shipUpdates.entries()) {
      updates.set(`ship:${shipId}`, shipUpdate);
      
      // 为每个有变化的舰船创建事件
      if (dissipationResult.fluxChanges.has(shipId)) {
        const change = dissipationResult.fluxChanges.get(shipId)!;
        events.push(createFluxChangeEvent({
          shipId,
          fluxSoft: change.newFluxSoft,
          fluxHard: change.newFluxHard,
          totalFlux: change.newTotalFlux,
          changeType: "DISSIPATED",
          changeAmount: change.dissipatedAmount,
          isOverloaded: change.isOverloaded,
          overloadTimeRemaining: change.overloadTimeRemaining,
        }));
      }
    }
  }

  // 应用状态更新
  const newState = applyStateUpdates(state, updates);

  return { newState, events };
}

/**
 * 处理排散辐能
 */
function processFluxVent(ship: any) {
  const runtime = { ...ship.runtime };
  const spec = ship.shipJson.ship;

  // 排散所有辐能
  const ventedAmount = (runtime.fluxSoft || 0) + (runtime.fluxHard || 0);
  
  runtime.fluxSoft = 0;
  runtime.fluxHard = 0;
  
  // 清除过载状态
  if (runtime.overloaded) {
    runtime.overloaded = false;
    runtime.overloadTime = 0;
  }

  // 标记为已排散（本回合不能开火）
  runtime.hasFired = true;

  return {
    newRuntime: runtime,
    ventedAmount,
  };
}

/**
 * 处理辐能消散（回合结束时）
 */
function processFluxDissipation(state: any) {
  const shipUpdates = new Map<string, any>();
  const fluxChanges = new Map<string, any>();

  for (const [shipId, ship] of state.ships.entries()) {
    if (ship.runtime.destroyed) continue;

    const runtime = { ...ship.runtime };
    const spec = ship.shipJson.ship;
    
    const oldFluxSoft = runtime.fluxSoft || 0;
    const oldFluxHard = runtime.fluxHard || 0;
    const oldTotalFlux = oldFluxSoft + oldFluxHard;

    // 计算消散量
    const dissipationRate = spec.fluxDissipation || 0;
    
    // 先消散软辐能
    let remainingDissipation = dissipationRate;
    let newFluxSoft = oldFluxSoft;
    
    if (newFluxSoft > 0) {
      const softDissipated = Math.min(newFluxSoft, remainingDissipation);
      newFluxSoft -= softDissipated;
      remainingDissipation -= softDissipated;
    }
    
    // 如果还有剩余消散量，消散硬辐能
    let newFluxHard = oldFluxHard;
    if (remainingDissipation > 0 && newFluxHard > 0) {
      const hardDissipated = Math.min(newFluxHard, remainingDissipation);
      newFluxHard -= hardDissipated;
    }

    // 更新过载状态
    let isOverloaded = runtime.overloaded || false;
    let overloadTimeRemaining = runtime.overloadTime || 0;
    
    if (isOverloaded) {
      // 减少过载时间
      overloadTimeRemaining = Math.max(0, overloadTimeRemaining - 1);
      
      if (overloadTimeRemaining === 0) {
        // 过载结束，清除一半辐能
        isOverloaded = false;
        const totalFlux = newFluxSoft + newFluxHard;
        const clearedFlux = Math.floor(totalFlux / 2);
        
        // 按比例清除软硬辐能
        const softRatio = newFluxSoft / totalFlux;
        const hardRatio = newFluxHard / totalFlux;
        
        newFluxSoft = Math.max(0, newFluxSoft - Math.floor(clearedFlux * softRatio));
        newFluxHard = Math.max(0, newFluxHard - Math.floor(clearedFlux * hardRatio));
      }
    }

    // 检查是否进入过载
    const fluxCapacity = spec.fluxCapacity || 0;
    const newTotalFlux = newFluxSoft + newFluxHard;
    
    if (newTotalFlux > fluxCapacity && !isOverloaded) {
      isOverloaded = true;
      overloadTimeRemaining = 1; // 过载持续1回合
    }

    // 更新运行时状态
    runtime.fluxSoft = newFluxSoft;
    runtime.fluxHard = newFluxHard;
    runtime.overloaded = isOverloaded;
    runtime.overloadTime = overloadTimeRemaining;

    // 重置移动和开火状态
    runtime.movement = {
      hasMoved: false,
      phaseAUsed: 0,
      turnAngleUsed: 0,
      phaseCUsed: 0,
    };
    runtime.hasFired = false;

    // 重置武器冷却
    if (runtime.weapons) {
      runtime.weapons = runtime.weapons.map((weapon: any) => ({
        ...weapon,
        state: weapon.state === "COOLDOWN" && weapon.cooldownRemaining <= 1 ? "READY" : weapon.state,
        cooldownRemaining: Math.max(0, (weapon.cooldownRemaining || 0) - 1),
      }));
    }

    shipUpdates.set(shipId, { runtime });

    // 记录辐能变化
    const dissipatedAmount = oldTotalFlux - newTotalFlux;
    if (dissipatedAmount > 0 || isOverloaded !== (ship.runtime.overloaded || false)) {
      fluxChanges.set(shipId, {
        newFluxSoft,
        newFluxHard,
        newTotalFlux,
        dissipatedAmount,
        isOverloaded,
        overloadTimeRemaining,
      });
    }
  }

  return {
    shipUpdates,
    fluxChanges,
  };
}

/**
 * 检查排散辐能合法性
 */
export function validateFluxVent(ship: any): { valid: boolean; error?: string } {
  // 检查舰船状态
  if (ship.runtime.destroyed) {
    return { valid: false, error: "Ship is destroyed" };
  }

  // 检查是否已开火
  if (ship.runtime.hasFired) {
    return { valid: false, error: "Cannot vent flux after firing" };
  }

  // 检查护盾是否开启
  if (ship.runtime.shield?.active) {
    return { valid: false, error: "Cannot vent flux with shield active" };
  }

  // 检查是否有辐能可排散
  const totalFlux = (ship.runtime.fluxSoft || 0) + (ship.runtime.fluxHard || 0);
  if (totalFlux <= 0) {
    return { valid: false, error: "No flux to vent" };
  }

  return { valid: true };
}

/**
 * 计算辐能状态
 */
export function calculateFluxState(
  fluxSoft: number,
  fluxHard: number,
  fluxCapacity: number
): "NORMAL" | "HIGH" | "OVERLOADED" | "VENTING" {
  const totalFlux = fluxSoft + fluxHard;
  const ratio = totalFlux / fluxCapacity;

  if (ratio >= 1.0) {
    return "OVERLOADED";
  } else if (ratio >= 0.7) {
    return "HIGH";
  } else {
    return "NORMAL";
  }
}