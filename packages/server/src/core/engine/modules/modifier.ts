/**
 * 修正模块
 * 基于 @vt/data 权威设计
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createStatusEffectEvent } from "../context.js";

/**
 * 应用修正Action
 */
export function applyModifier(context: EngineContext): { newState: any; events: any[] } {
  const { state, action } = context;
  const payload = action.payload as any;
  
  const events = [];
  const updates = new Map<string, any>();

  if (action.type === "APPLY_MODIFIER") {
    // 处理应用修正
    const modifierResult = processModifierApplication(state, payload);
    
    // 应用状态更新
    for (const [shipId, shipUpdate] of modifierResult.shipUpdates.entries()) {
      updates.set(`ship:${shipId}`, shipUpdate);
      
      // 创建状态效果事件
      if (modifierResult.effectChanges.has(shipId)) {
        const change = modifierResult.effectChanges.get(shipId)!;
        events.push(createStatusEffectEvent(
          shipId,
          change.effectId,
          change.effectType,
          change.action,
          change.duration
        ));
      }
    }
  }

  // 应用状态更新
  const newState = applyStateUpdates(state, updates);

  return { newState, events };
}

/**
 * 处理修正应用
 */
function processModifierApplication(state: any, payload: any) {
  const shipUpdates = new Map<string, any>();
  const effectChanges = new Map<string, any>();

  const {
    targetType, // "SHIP", "FACTION", "ALL"
    targetId,
    faction,
    modifier,
    duration,
  } = payload;

  // 确定目标舰船
  const targetShips = getTargetShips(state, targetType, targetId, faction);

  for (const ship of targetShips) {
    const runtime = { ...ship.runtime };
    
    // 确保状态效果数组存在
    if (!runtime.statusEffects) {
      runtime.statusEffects = [];
    }

    // 检查是否已有相同类型的修正
    const existingEffectIndex = runtime.statusEffects.findIndex(
      (effect: any) => effect.type === modifier.type
    );

    if (existingEffectIndex >= 0) {
      // 更新现有修正
      const existingEffect = runtime.statusEffects[existingEffectIndex];
      
      if (modifier.stackable) {
        // 可叠加：增加层数
        existingEffect.stackCount = (existingEffect.stackCount || 1) + 1;
        existingEffect.duration = Math.max(existingEffect.duration || 0, duration || 1);
      } else {
        // 不可叠加：刷新持续时间
        existingEffect.duration = duration || 1;
      }
      
      // 记录更新事件
      effectChanges.set(ship.id, {
        effectId: existingEffect.id,
        effectType: existingEffect.type,
        action: "UPDATED",
        duration: existingEffect.duration,
      });
    } else {
      // 添加新修正
      const effectId = `effect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newEffect = {
        id: effectId,
        type: modifier.type,
        source: payload.sourceId || "system",
        duration: duration || 1,
        stackCount: 1,
        data: modifier.data || {},
      };
      
      runtime.statusEffects.push(newEffect);
      
      // 记录添加事件
      effectChanges.set(ship.id, {
        effectId,
        effectType: modifier.type,
        action: "APPLIED",
        duration,
      });
    }

    // 应用修正效果到舰船属性
    applyModifierToShip(runtime, modifier);

    shipUpdates.set(ship.id, { runtime });
  }

  return {
    shipUpdates,
    effectChanges,
  };
}

/**
 * 获取目标舰船
 */
function getTargetShips(state: any, targetType: string, targetId?: string, _faction?: string): any[] {
  const ships = Array.from(state.tokens.values());
  
  switch (targetType) {
    case "SHIP": {
      const ship = targetId ? state.tokens.get(targetId) : undefined;
      return ship ? [ship] : [];
    }
    case "FACTION":
      return ships.filter((ship: any) => ship.runtime?.faction === _faction);
    case "ALL":
      return ships;
    default:
      return [];
  }
}

/**
 * 应用修正到舰船属性
 */
function applyModifierToShip(runtime: any, modifier: any) {
  // 根据修正类型应用效果
  switch (modifier.type) {
    case "DAMAGE_BOOST":
      // 伤害提升
      runtime.damageMultiplier = (runtime.damageMultiplier || 1.0) * (modifier.data.multiplier || 1.2);
      break;
    
    case "DAMAGE_REDUCTION":
      // 伤害减免
      runtime.damageReduction = (runtime.damageReduction || 0) + (modifier.data.reduction || 0.1);
      break;
    
    case "SPEED_BOOST":
      // 速度提升
      runtime.speedMultiplier = (runtime.speedMultiplier || 1.0) * (modifier.data.multiplier || 1.2);
      break;
    
    case "FLUX_DISSIPATION_BOOST":
      // 辐能消散提升
      runtime.fluxDissipationMultiplier = (runtime.fluxDissipationMultiplier || 1.0) * (modifier.data.multiplier || 1.5);
      break;
    
    case "RANGE_BOOST":
      // 射程提升
      runtime.rangeMultiplier = (runtime.rangeMultiplier || 1.0) * (modifier.data.multiplier || 1.3);
      break;
    
    case "ACCURACY_BOOST":
      // 命中率提升
      runtime.accuracyBonus = (runtime.accuracyBonus || 0) + (modifier.data.bonus || 0.2);
      break;
    
    case "ARMOR_REPAIR":
      // 护甲修复
      if (runtime.armor) {
        const repairAmount = modifier.data.amount || 10;
        runtime.armor = runtime.armor.map((armor: number) => 
          Math.min(armor + repairAmount, modifier.data.max || 100)
        );
      }
      break;
    
    case "HULL_REPAIR":
      // 船体修复
      if (runtime.hull !== undefined) {
        const repairAmount = modifier.data.amount || 20;
        runtime.hull = Math.min(runtime.hull + repairAmount, modifier.data.max || 100);
      }
      break;
    
    case "OVERLOAD_IMMUNITY":
      // 过载免疫
      runtime.overloadImmune = true;
      break;
    
    case "SHIELD_BOOST":
      // 护盾增强
      if (runtime.shield) {
        runtime.shield.value = Math.min(
          (runtime.shield.value || 0) + (modifier.data.amount || 20),
          modifier.data.max || 100
        );
      }
      break;
  }
}

/**
 * 更新状态效果持续时间
 */
export function updateStatusEffects(state: any): { shipUpdates: Map<string, any>; expiredEffects: Map<string, any[]> } {
  const shipUpdates = new Map<string, any>();
  const expiredEffects = new Map<string, any[]>();

  for (const [shipId, ship] of state.tokens.entries()) {
    if (!ship.runtime.statusEffects || ship.runtime.statusEffects.length === 0) {
      continue;
    }

    const runtime = { ...ship.runtime };
    const expired = [];
    const remainingEffects = [];

    for (const effect of runtime.statusEffects) {
      // 减少持续时间
      const newDuration = (effect.duration || 0) - 1;
      
      if (newDuration <= 0) {
        // 效果过期
        expired.push(effect);
        // 移除效果影响
        removeModifierFromShip(runtime, effect);
      } else {
        // 更新持续时间
        effect.duration = newDuration;
        remainingEffects.push(effect);
      }
    }

    // 更新状态效果数组
    runtime.statusEffects = remainingEffects;
    
    if (expired.length > 0) {
      expiredEffects.set(shipId, expired);
    }
    
    if (remainingEffects.length !== runtime.statusEffects.length) {
      shipUpdates.set(shipId, { runtime });
    }
  }

  return { shipUpdates, expiredEffects };
}

/**
 * 移除修正效果
 */
function removeModifierFromShip(runtime: any, effect: any) {
  // 根据效果类型移除影响
  switch (effect.type) {
    case "DAMAGE_BOOST":
      runtime.damageMultiplier = 1.0;
      break;
    
    case "DAMAGE_REDUCTION":
      runtime.damageReduction = 0;
      break;
    
    case "SPEED_BOOST":
      runtime.speedMultiplier = 1.0;
      break;
    
    case "FLUX_DISSIPATION_BOOST":
      runtime.fluxDissipationMultiplier = 1.0;
      break;
    
    case "RANGE_BOOST":
      runtime.rangeMultiplier = 1.0;
      break;
    
    case "ACCURACY_BOOST":
      runtime.accuracyBonus = 0;
      break;
    
    case "OVERLOAD_IMMUNITY":
      runtime.overloadImmune = false;
      break;
    
    // 修复类效果不需要移除，因为修复是永久性的
  }
}

/**
 * 计算修正后的属性值
 */
export function calculateModifiedValue(
  baseValue: number,
  runtime: any,
  modifierType: string
): number {
  let modifiedValue = baseValue;

  switch (modifierType) {
    case "DAMAGE":
      modifiedValue *= (runtime.damageMultiplier || 1.0);
      modifiedValue *= (1 - (runtime.damageReduction || 0));
      break;
    
    case "SPEED":
      modifiedValue *= (runtime.speedMultiplier || 1.0);
      break;
    
    case "FLUX_DISSIPATION":
      modifiedValue *= (runtime.fluxDissipationMultiplier || 1.0);
      break;
    
    case "RANGE":
      modifiedValue *= (runtime.rangeMultiplier || 1.0);
      break;
    
    case "ACCURACY":
      modifiedValue += (runtime.accuracyBonus || 0);
      break;
  }

  return modifiedValue;
}

/**
 * 检查修正应用合法性
 */
export function validateModifierApplication(
  state: any,
  playerId: string,
  payload: any
): { valid: boolean; error?: string } {
  const player = state.players.get(playerId);
  
  if (!player) {
    return { valid: false, error: "Player not found" };
  }

  // 检查权限（简化：只有DM可以应用全局修正）
  if (payload.targetType === "ALL" || payload.targetType === "FACTION") {
    if (player.role !== "DM") {
      return { valid: false, error: "Only DM can apply global modifiers" };
    }
  }

  // 检查目标是否存在
  if (payload.targetType === "SHIP" && payload.targetId) {
    const targetShip = state.tokens.get(payload.targetId);
    if (!targetShip) {
      return { valid: false, error: "Target ship not found" };
    }
  }

  // 检查修正数据
  if (!payload.modifier || !payload.modifier.type) {
    return { valid: false, error: "Invalid modifier data" };
  }

  return { valid: true };
}