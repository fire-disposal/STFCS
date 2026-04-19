/**
 * 核心引擎入口 - 应用Action到GameState
 * 基于 @vt/data 权威设计
 */

import type { GameAction, GameEvent } from "../types/common.js";
import type { GameState } from "../types/common.js";
import { createEngineContext } from "./context.js";
import { applyMovement } from "./modules/movement.js";
import { applyCombat } from "./modules/combat.js";
import { applyFlux } from "./modules/flux.js";
import { applyShield } from "./modules/shield.js";
import { applyTurn } from "./modules/turn.js";
import { applyModifier } from "./modules/modifier.js";

/**
 * 应用Action到游戏状态
 * @param state 当前游戏状态
 * @param action 要应用的Action
 * @returns 更新后的游戏状态和产生的事件
 */
export function applyAction(
  state: GameState,
  action: GameAction
): { newState: GameState; events: GameEvent[] } {
  const context = createEngineContext(state, action);
  const events: GameEvent[] = [];

  // 根据Action类型分发处理
  switch (action.type) {
    case "MOVE":
      return applyMovement(context);
    case "ATTACK":
      return applyCombat(context);
    case "ROTATE":
      return applyMovement(context); // 旋转作为移动的一部分
    case "END_TURN":
      return applyTurn(context);
    case "TOGGLE_SHIELD":
      return applyShield(context);
    case "VENT_FLUX":
      return applyFlux(context);
    case "APPLY_MODIFIER":
      return applyModifier(context);
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/**
 * 验证Action是否合法
 */
function validateAction(context: any): { valid: boolean; error?: string } {
  const { state, action } = context;

  // 检查玩家是否存在
  const player = state.players.get(action.playerId);
  if (!player) {
    return { valid: false, error: "Player not found" };
  }

  // 检查玩家是否连接
  if (!player.connected) {
    return { valid: false, error: "Player not connected" };
  }

  // 检查回合权限
  if (action.type.startsWith("TURN_") && state.activeFaction !== player.faction) {
    return { valid: false, error: "Not your turn" };
  }

  // Action特定验证
  switch (action.type) {
    case "MOVE":
      return validateMoveAction(context);
    case "ATTACK":
      return validateAttackAction(context);
    case "ROTATE":
      return validateRotateAction(context);
    case "END_TURN":
      return validateEndTurnAction(context);
    case "TOGGLE_SHIELD":
      return validateToggleShieldAction(context);
    case "VENT_FLUX":
      return validateVentFluxAction(context);
    default:
      return { valid: true };
  }
}

/**
 * 验证移动Action
 */
function validateMoveAction(context: any): { valid: boolean; error?: string } {
  const { action, state } = context;
  const payload = action.payload as any;

  // 检查舰船是否存在
  const ship = state.ships.get(payload.shipId);
  if (!ship) {
    return { valid: false, error: "Ship not found" };
  }

  // 检查舰船是否被摧毁
  if (ship.runtime.destroyed) {
    return { valid: false, error: "Ship is destroyed" };
  }

  // 检查舰船是否过载
  if (ship.runtime.overloaded) {
    return { valid: false, error: "Ship is overloaded" };
  }

  // 检查舰船是否已移动
  if (ship.runtime.movement?.hasMoved) {
    return { valid: false, error: "Ship has already moved this turn" };
  }

  // 检查移动距离是否合法
  const maxMove = ship.shipJson.ship.maxSpeed || 0;
  const moveDistance = payload.distance || 0;
  if (moveDistance > maxMove) {
    return { valid: false, error: `Move distance exceeds max speed (${maxMove})` };
  }

  return { valid: true };
}

/**
 * 验证攻击Action
 */
function validateAttackAction(context: any): { valid: boolean; error?: string } {
  const { action, state } = context;
  const payload = action.payload as any;

  // 检查攻击者舰船
  const attacker = state.ships.get(payload.attackerId);
  if (!attacker) {
    return { valid: false, error: "Attacker ship not found" };
  }

  // 检查目标舰船
  const target = state.ships.get(payload.targetId);
  if (!target) {
    return { valid: false, error: "Target ship not found" };
  }

  // 检查攻击者是否被摧毁
  if (attacker.runtime.destroyed) {
    return { valid: false, error: "Attacker is destroyed" };
  }

  // 检查攻击者是否过载
  if (attacker.runtime.overloaded) {
    return { valid: false, error: "Attacker is overloaded" };
  }

  // 检查攻击者是否已开火
  if (attacker.runtime.hasFired) {
    return { valid: false, error: "Attacker has already fired this turn" };
  }

  // 检查武器是否存在
  const weaponId = payload.weaponId;
  const weapon = attacker.runtime.weapons?.find(w => w.mountId === weaponId);
  if (!weapon) {
    return { valid: false, error: "Weapon not found" };
  }

  // 检查武器状态
  if (weapon.state !== "READY") {
    return { valid: false, error: "Weapon is not ready" };
  }

  return { valid: true };
}

/**
 * 验证旋转Action
 */
function validateRotateAction(context: any): { valid: boolean; error?: string } {
  const { action, state } = context;
  const payload = action.payload as any;

  // 检查舰船是否存在
  const ship = state.ships.get(payload.shipId);
  if (!ship) {
    return { valid: false, error: "Ship not found" };
  }

  // 检查舰船是否被摧毁
  if (ship.runtime.destroyed) {
    return { valid: false, error: "Ship is destroyed" };
  }

  // 检查舰船是否过载
  if (ship.runtime.overloaded) {
    return { valid: false, error: "Ship is overloaded" };
  }

  // 检查转向角度是否合法
  const maxTurn = ship.shipJson.ship.maxTurnRate || 0;
  const turnAngle = payload.angle || 0;
  if (Math.abs(turnAngle) > maxTurn) {
    return { valid: false, error: `Turn angle exceeds max turn rate (${maxTurn})` };
  }

  return { valid: true };
}

/**
 * 验证结束回合Action
 */
function validateEndTurnAction(context: any): { valid: boolean; error?: string } {
  const { action, state } = context;
  const player = state.players.get(action.playerId);

  // 检查玩家是否是当前行动阵营
  if (player?.faction !== state.activeFaction) {
    return { valid: false, error: "Not your turn" };
  }

  return { valid: true };
}

/**
 * 验证切换护盾Action
 */
function validateToggleShieldAction(context: any): { valid: boolean; error?: string } {
  const { action, state } = context;
  const payload = action.payload as any;

  // 检查舰船是否存在
  const ship = state.ships.get(payload.shipId);
  if (!ship) {
    return { valid: false, error: "Ship not found" };
  }

  // 检查舰船是否被摧毁
  if (ship.runtime.destroyed) {
    return { valid: false, error: "Ship is destroyed" };
  }

  // 检查舰船是否过载
  if (ship.runtime.overloaded) {
    return { valid: false, error: "Ship is overloaded" };
  }

  // 检查舰船是否有护盾
  if (!ship.shipJson.ship.shield) {
    return { valid: false, error: "Ship has no shield" };
  }

  return { valid: true };
}

/**
 * 验证排散辐能Action
 */
function validateVentFluxAction(context: any): { valid: boolean; error?: string } {
  const { action, state } = context;
  const payload = action.payload as any;

  // 检查舰船是否存在
  const ship = state.ships.get(payload.shipId);
  if (!ship) {
    return { valid: false, error: "Ship not found" };
  }

  // 检查舰船是否被摧毁
  if (ship.runtime.destroyed) {
    return { valid: false, error: "Ship is destroyed" };
  }

  // 检查舰船是否已开火
  if (ship.runtime.hasFired) {
    return { valid: false, error: "Cannot vent flux after firing" };
  }

  // 检查舰船护盾是否开启
  if (ship.runtime.shield?.active) {
    return { valid: false, error: "Cannot vent flux with shield active" };
  }

  return { valid: true };
}

/**
 * 批量应用Actions
 */
export function applyActions(
  state: GameState,
  actions: GameAction[]
): { newState: GameState; events: GameEvent[] } {
  let currentState = state;
  const allEvents: GameEvent[] = [];

  for (const action of actions) {
    const result = applyAction(currentState, action);
    currentState = result.newState;
    allEvents.push(...result.events);
  }

  return { newState: currentState, events: allEvents };
}