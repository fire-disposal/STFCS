/**
 * 回合模块
 * 基于 @vt/data 权威设计
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createTurnChangeEvent } from "../context.js";
import { applyFlux } from "./flux.js";

/**
 * 应用回合Action
 */
export function applyTurn(context: EngineContext): { newState: any; events: any[] } {
  const { state, action } = context;
  
  const events: any[] = [];
  const updates = new Map<string, any>();

  if (action.type === "END_TURN") {
    // 处理结束回合
    const turnResult = processEndTurn(state);
    
    // 更新游戏状态
    updates.set("game", turnResult.newGameState);

    // 创建回合变化事件
    events.push(createTurnChangeEvent(
      turnResult.newGameState.turn,
      turnResult.newGameState.activeFaction,
      state.turn,
      state.activeFaction
    ));

    // 应用回合更新
    const stateAfterTurn = applyStateUpdates(state, updates);

    // 处理回合结束时的其他逻辑（辐能消散等）
    const fluxContext = {
      ...context,
      state: stateAfterTurn,
    };
    const fluxResult = applyFlux(fluxContext);
    
    // 合并事件
    events.push(...fluxResult.events);

    return { newState: fluxResult.newState, events };
  }

  // 应用状态更新（非 END_TURN 时）
  const newState = applyStateUpdates(state, updates);

  return { newState, events };
}

/**
 * 处理结束回合
 */
function processEndTurn(state: any) {
  const newGameState = { ...state };
  
  // 确定下一个行动阵营
  let nextFaction = state.activeFaction;
  let nextTurn = state.turn;
  
  if (state.activeFaction === "PLAYER") {
    // 玩家回合结束，切换到敌人回合
    nextFaction = "ENEMY";
  } else if (state.activeFaction === "ENEMY") {
    // 敌人回合结束，切换到玩家回合并增加回合数
    nextFaction = "PLAYER";
    nextTurn++;
  }
  
  // 更新游戏状态
  newGameState.activeFaction = nextFaction;
  newGameState.turn = nextTurn;
  
  // 更新回合阶段
  if (nextFaction === "PLAYER" && nextTurn > state.turn) {
    // 新回合开始
    newGameState.factionTurnPhase = "MOVEMENT";
  } else {
    // 同一回合内切换阵营
    newGameState.factionTurnPhase = "MOVEMENT";
  }

  // 重置所有舰船的移动和开火状态
  for (const [_shipId, ship] of newGameState.tokens.entries()) {
    if (!ship.runtime.destroyed) {
      ship.runtime.movement = {
        hasMoved: false,
        phaseAUsed: 0,
        turnAngleUsed: 0,
        phaseCUsed: 0,
      };
      ship.runtime.hasFired = false;
    }
  }

  return {
    newGameState,
  };
}

/**
 * 检查结束回合合法性
 */
export function validateEndTurn(state: any, playerId: string): { valid: boolean; error?: string } {
  const player = state.players.get(playerId);
  
  if (!player) {
    return { valid: false, error: "Player not found" };
  }

  if (!player.connected) {
    return { valid: false, error: "Player not connected" };
  }

  // 检查玩家是否是当前行动阵营
  if (player.faction !== state.activeFaction) {
    return { valid: false, error: "Not your turn" };
  }

  // 检查是否所有行动都已完成（简化：总是允许结束回合）
  // TODO: 实现更复杂的检查逻辑

  return { valid: true };
}

/**
 * 计算回合阶段
 * 
 * 注意：gamePhase 由 state.phase 直接控制，不应根据 turn 数推导。
 * 此函数主要用于根据 activeFaction 确定显示用的 gamePhase，
 * 实际状态应使用 state.phase。
 * 
 * @deprecated 建议直接使用 state.phase 获取当前阶段
 */
export function calculateTurnPhase(
  _turn: number,
  activeFaction: string | undefined,
  factionTurnPhase?: string
): {
  gamePhase: "DEPLOYMENT" | "PLAYER_ACTION" | "DM_ACTION" | "TURN_END";
  factionPhase: "MOVEMENT" | "COMBAT" | "END";
} {
  let gamePhase: "DEPLOYMENT" | "PLAYER_ACTION" | "DM_ACTION" | "TURN_END";
  let factionPhase: "MOVEMENT" | "COMBAT" | "END" = factionTurnPhase as any || "MOVEMENT";

  if (activeFaction === "PLAYER") {
    gamePhase = "PLAYER_ACTION";
  } else if (activeFaction === "ENEMY") {
    gamePhase = "DM_ACTION";
  } else {
    gamePhase = "TURN_END";
  }

  return { gamePhase, factionPhase };
}

/**
 * 获取当前回合信息
 */
export function getTurnInfo(state: any): {
  turn: number;
  activeFaction: string | undefined;
  gamePhase: string;
  factionPhase: string;
  playerShips: number;
  enemyShips: number;
} {
  const gamePhase = state.phase ?? calculateTurnPhase(state.turn, state.activeFaction, state.factionTurnPhase).gamePhase;
  const factionPhase = state.factionTurnPhase ?? "MOVEMENT";

  const aliveShips = Array.from(state.tokens.values()).filter(
    (ship: any) => !ship.runtime.destroyed
  );

  const playerShips = aliveShips.filter(
    (ship: any) => ship.runtime.faction === "PLAYER"
  ).length;

  const enemyShips = aliveShips.filter(
    (ship: any) => ship.runtime.faction === "ENEMY"
  ).length;

  return {
    turn: state.turn,
    activeFaction: state.activeFaction,
    gamePhase,
    factionPhase,
    playerShips,
    enemyShips,
  };
}