/**
 * 引擎执行上下文
 * 基于 @vt/data 权威设计
 */

import type { GameState, GameAction, GameEvent } from "../types/common.js";

/**
 * 引擎执行上下文
 */
export interface EngineContext {
  // 输入
  state: GameState;
  action: GameAction;
  
  // 中间数据
  player?: any; // PlayerState
  ship?: any;   // ShipState
  targetShip?: any; // ShipState (for attack)
  weapon?: any; // WeaponRuntime (for attack)
  
  // 输出
  events: GameEvent[];
  stateUpdates: Map<string, any>;
}

/**
 * 创建引擎上下文
 */
export function createEngineContext(
  state: GameState,
  action: GameAction
): EngineContext {
  const context: EngineContext = {
    state: { ...state },
    action,
    events: [],
    stateUpdates: new Map(),
  };

  // 填充玩家信息
  const player = state.players.get(action.playerId);
  if (player) {
    context.player = player;
  }

  // 根据Action类型填充其他信息
  const payload = action.payload as any;
  switch (action.type) {
    case "MOVE":
    case "ROTATE":
    case "TOGGLE_SHIELD":
    case "VENT_FLUX":
      if (payload.shipId) {
        const ship = state.tokens.get(payload.shipId);
        if (ship) {
          context.ship = ship;
        }
      }
      break;
    
    case "ATTACK":
      if (payload.attackerId) {
        const attacker = state.tokens.get(payload.attackerId);
        if (attacker) {
          context.ship = attacker;
        }
      }
      if (payload.targetId) {
        const target = state.tokens.get(payload.targetId);
        if (target) {
          context.targetShip = target;
        }
      }
      if (payload.weaponId && context.ship?.runtime?.weapons) {
        const weapon = context.ship.runtime.weapons.find(
          (w: any) => w.mountId === payload.weaponId
        );
        if (weapon) {
          context.weapon = weapon;
        }
      }
      break;
  }

  return context;
}

/**
 * 应用状态更新到游戏状态
 */
export function applyStateUpdates(
  state: GameState,
  updates: Map<string, any>
): GameState {
  const newState = { ...state };
  
  for (const [key, value] of updates.entries()) {
    if (key.startsWith("ship:")) {
      // 更新舰船状态
      const shipId = key.substring(5);
      const ship = newState.tokens.get(shipId);
      if (ship) {
        Object.assign(ship, value);
      }
    } else if (key.startsWith("player:")) {
      // 更新玩家状态
      const playerId = key.substring(7);
      const player = newState.players.get(playerId);
      if (player) {
        Object.assign(player, value);
      }
    } else if (key === "game") {
      // 更新游戏状态
      Object.assign(newState, value);
    }
  }
  
  return newState;
}

/**
 * 创建事件
 */
export function createEvent(
  type: string,
  payload: any,
  timestamp: number = Date.now()
): GameEvent {
  return {
    type,
    timestamp,
    payload,
  };
}

/**
 * 创建移动事件
 */
export function createMoveEvent(
  shipId: string,
  from: { x: number; y: number },
  to: { x: number; y: number },
  distance: number
): GameEvent {
  return createEvent("MOVED", {
    shipId,
    from,
    to,
    distance,
    movedAt: Date.now(),
  });
}

/**
 * 创建旋转事件
 */
export function createRotateEvent(
  shipId: string,
  fromAngle: number,
  toAngle: number,
  angleDelta: number
): GameEvent {
  return createEvent("ROTATED", {
    shipId,
    fromAngle,
    toAngle,
    angleDelta,
    rotatedAt: Date.now(),
  });
}

/**
 * 创建攻击事件
 */
export function createAttackEvent(
  attackerId: string,
  targetId: string,
  weaponId: string,
  damage: number,
  hit: boolean
): GameEvent {
  return createEvent("ATTACKED", {
    attackerId,
    targetId,
    weaponId,
    damage,
    hit,
    attackedAt: Date.now(),
  });
}

/**
 * 创建伤害事件
 */
export function createDamageEvent(
  targetId: string,
  damage: number,
  damageType: string,
  sourceId: string,
  shieldHit: boolean,
  armorHit: boolean
): GameEvent {
  return createEvent("DAMAGE_APPLIED", {
    targetId,
    damage,
    damageType,
    sourceId,
    shieldHit,
    armorHit,
    appliedAt: Date.now(),
  });
}

/**
 * 创建辐能变化事件
 */
export function createFluxChangeEvent(
  shipId: string,
  fluxSoft: number,
  fluxHard: number,
  totalFlux: number,
  changeType: "GENERATED" | "DISSIPATED" | "VENTED"
): GameEvent {
  return createEvent("FLUX_CHANGED", {
    shipId,
    fluxSoft,
    fluxHard,
    totalFlux,
    changeType,
    changedAt: Date.now(),
  });
}

/**
 * 创建护盾状态变化事件
 */
export function createShieldToggleEvent(
  shipId: string,
  active: boolean,
  previousActive: boolean
): GameEvent {
  return createEvent("SHIELD_TOGGLED", {
    shipId,
    active,
    previousActive,
    toggledAt: Date.now(),
  });
}

/**
 * 创建回合变化事件
 */
export function createTurnChangeEvent(
  turn: number,
  activeFaction: string,
  previousTurn: number,
  previousFaction: string
): GameEvent {
  return createEvent("TURN_CHANGED", {
    turn,
    activeFaction,
    previousTurn,
    previousFaction,
    changedAt: Date.now(),
  });
}

/**
 * 创建过载事件
 */
export function createOverloadEvent(
  shipId: string,
  overloaded: boolean,
  fluxAtOverload: number
): GameEvent {
  return createEvent("OVERLOADED", {
    shipId,
    overloaded,
    fluxAtOverload,
    overloadedAt: Date.now(),
  });
}

/**
 * 创建舰船摧毁事件
 */
export function createShipDestroyedEvent(
  shipId: string,
  killerId?: string,
  weaponId?: string
): GameEvent {
  return createEvent("SHIP_DESTROYED", {
    shipId,
    killerId,
    weaponId,
    destroyedAt: Date.now(),
  });
}

/**
 * 创建状态效果事件
 */
export function createStatusEffectEvent(
  shipId: string,
  effectId: string,
  effectType: string,
  action: "APPLIED" | "REMOVED" | "UPDATED",
  duration?: number
): GameEvent {
  return createEvent("STATUS_EFFECT_CHANGED", {
    shipId,
    effectId,
    effectType,
    action,
    duration,
    changedAt: Date.now(),
  });
}