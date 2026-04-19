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
  
  const events = [];
  const updates = new Map<string, any>();

  if (action.type === "END_TURN") {
    // 处理结束回合
    const turnResult = processEndTurn(state);
    
    // 更新游戏状态
    updates.set("game", turnResult.newGameState);

    // 创建回合变化事件
    events.push(createTurnChangeEvent({
      turn: turnResult.newGameState.turn,
      activeFaction: turnResult.newGameState.activeFaction,
      previousTurn: state.turn,
      previousFaction: state.activeFaction,
      phase: turnResult.newGameState.phase,
      factionTurnPhase: turnResult.newGameState.factionTurnPhase,
    }));

    // 处理回合结束时的其他逻辑（辐能消散等）
    const fluxContext = {
      ...context,
      state: { ...state, ...turnResult.newGameState },
    };
    const fluxResult = applyFlux(fluxContext);
    
    // 合并状态更新
    for (const [key, value] of fluxResult.stateUpdates.entries()) {
      updates.set(key, value);
    }
    
    // 合并事件
    events.push(...fluxResult.events);
  }

  // 应用状态更新
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
  for (const [shipId, ship] of newGameState.ships.entries()) {
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
 */
export function calculateTurnPhase(
  turn: number,
  activeFaction: string,
  factionTurnPhase?: string
): {
  gamePhase: "DEPLOYMENT" | "PLAYER_ACTION" | "DM_ACTION" | "TURN_END";
  factionPhase: "MOVEMENT" | "COMBAT" | "END";
} {
  let gamePhase: "DEPLOYMENT" | "PLAYER_ACTION" | "DM_ACTION" | "TURN_END";
  let factionPhase: "MOVEMENT" | "COMBAT" | "END" = factionTurnPhase as any || "MOVEMENT";

  if (turn === 1 && activeFaction === "PLAYER") {
    gamePhase = "DEPLOYMENT";
  } else if (activeFaction === "PLAYER") {
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
  activeFaction: string;
  gamePhase: string;
  factionPhase: string;
  playerShips: number;
  enemyShips: number;
} {
  const { gamePhase, factionPhase } = calculateTurnPhase(
    state.turn,
    state.activeFaction,
    state.factionTurnPhase
  );

  const aliveShips = Array.from(state.ships.values()).filter(
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