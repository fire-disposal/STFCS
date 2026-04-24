/**
 * 回合模块
 * 基于 @vt/data 权威设计
 *
 * 使用 TURN_ORDER 定义派系行动顺序，支持可扩展的回合制。
 * 每轮（turn）中，TURN_ORDER 中的每个派系依次行动。
 * 最后一个派系行动完毕后 turn++ 并回到第一个派系。
 */

import { TURN_ORDER } from "@vt/data";
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
 * 根据 TURN_ORDER 计算下一个派系
 * 如果当前派系是 TURN_ORDER 中最后一个，则回到第一个并递增回合数
 */
function getNextFaction(currentFaction: string | undefined): { nextFaction: string | undefined; incrementTurn: boolean } {
  if (!currentFaction) {
    // 无当前派系时，从 TURN_ORDER 第一个开始
    return { nextFaction: TURN_ORDER[0], incrementTurn: false };
  }

  const currentIndex = TURN_ORDER.indexOf(currentFaction as any);
  if (currentIndex === -1) {
    // 当前派系不在 TURN_ORDER 中，从头开始
    return { nextFaction: TURN_ORDER[0], incrementTurn: false };
  }

  const nextIndex = currentIndex + 1;
  if (nextIndex >= TURN_ORDER.length) {
    // 最后一个派系，回到第一个并递增回合
    return { nextFaction: TURN_ORDER[0], incrementTurn: true };
  }

  // 下一个派系
  return { nextFaction: TURN_ORDER[nextIndex], incrementTurn: false };
}

/**
 * 处理结束回合
 */
function processEndTurn(state: any) {
  const newGameState = { ...state };

  const { nextFaction, incrementTurn } = getNextFaction(state.activeFaction);

  let nextTurn = state.turn;
  if (incrementTurn) {
    nextTurn++;
  }

  // 更新游戏状态
  newGameState.activeFaction = nextFaction;
  newGameState.turn = nextTurn;

  // 更新回合阶段
  newGameState.factionTurnPhase = "MOVEMENT";

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
  gamePhase: "DEPLOYMENT" | "PLAYER_ACTION";
  factionPhase: "MOVEMENT" | "COMBAT" | "END";
} {
  let gamePhase: "DEPLOYMENT" | "PLAYER_ACTION";
  let factionPhase: "MOVEMENT" | "COMBAT" | "END" = factionTurnPhase as any || "MOVEMENT";

  if (activeFaction && TURN_ORDER.includes(activeFaction as any)) {
    // 当前派系在 TURN_ORDER 中 → 玩家行动阶段
    gamePhase = "PLAYER_ACTION";
  } else {
    gamePhase = "DEPLOYMENT";
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

  // 按 TURN_ORDER 中的派系统计舰船数量
  const factionShipCounts: Record<string, number> = {};
  for (const faction of TURN_ORDER) {
    factionShipCounts[faction] = 0;
  }
  for (const ship of aliveShips) {
    const shipAny = ship as any;
    const f: string | undefined = shipAny.runtime?.faction;
    if (f && f in factionShipCounts) {
      factionShipCounts[f]!++;
    }
  }

  // playerShips = 当前 activeFaction 的舰船（如果有）
  const playerShips = state.activeFaction ? (factionShipCounts[state.activeFaction] ?? 0) : 0;
  // enemyShips = 其他所有派系的舰船总数
  const enemyShips = aliveShips.length - playerShips;

  return {
    turn: state.turn,
    activeFaction: state.activeFaction,
    gamePhase,
    factionPhase,
    playerShips,
    enemyShips,
  };
}
