/**
 * 引擎执行上下文
 *
 * 基于 @vt/data GameRoomState（Record-based），非 Map-based。
 * Engine 层为纯计算层，不直接修改状态，返回更新指令由调用方执行。
 */

import type { CombatToken, GameRoomState, RoomPlayerState } from "@vt/data";

/**
 * 引擎执行上下文
 * 包含执行一次 Action 所需的全部输入
 */
export interface EngineContext {
  /** 当前游戏状态快照（只读） */
  state: GameRoomState;

  /** Action 类型标识 */
  actionType: string;

  /** 发起 Action 的玩家 ID */
  playerId: string;

  /** Action 负载 */
  payload: unknown;

  /** 预解析的玩家对象（快捷访问） */
  player?: RoomPlayerState;

  /** 预解析的舰船对象（快捷访问） */
  ship?: CombatToken;

  /** 预解析的目标舰船（攻击时） */
  targetShip?: CombatToken;
}

/**
 * 更新指令 - 描述对 TokenRuntime 的修改
 * 由 engine 模块生成，由 handlers.ts 通过 MutativeStateManager 执行
 */
export interface TokenRuntimeUpdate {
  tokenId: string;
  updates: Record<string, unknown>;
}

/**
 * 引擎执行结果
 * 包含更新指令列表和事件列表
 */
export interface EngineResult {
  runtimeUpdates: TokenRuntimeUpdate[];
  events: EngineEvent[];
  error?: {
    code: string;
    message: string;
  };
}

/**
 * 引擎事件（轻量级，用于日志/广播）
 */
export interface EngineEvent {
  type: string;
  tokenId?: string;
  data: Record<string, unknown>;
}

/**
 * 创建引擎上下文
 * 从 GameRoomState 中解析出 player 和 ship 对象
 */
export function createEngineContext(
  state: GameRoomState,
  actionType: string,
  playerId: string,
  payload: unknown
): EngineContext {
  const context: EngineContext = {
    state,
    actionType,
    playerId,
    payload,
  };

  // 填充玩家信息
  const player = state.players[playerId];
  if (player) {
    context.player = player;
  }

  // 根据 Action 类型填充舰船信息
  const p = payload as Record<string, unknown>;
  const shipId = (p["tokenId"] ?? p["shipId"] ?? p["attackerId"]) as string | undefined;
  if (shipId && state.tokens[shipId]) {
    context.ship = state.tokens[shipId];
  }

  const targetId = p["targetId"] as string | undefined;
  if (targetId && state.tokens[targetId]) {
    context.targetShip = state.tokens[targetId];
  }

  return context;
}

/**
 * 创建引擎事件
 */
export function createEngineEvent(
  type: string,
  tokenId?: string,
  data: Record<string, unknown> = {}
): EngineEvent {
  return { type, ...(tokenId !== undefined ? { tokenId } : {}), data };
}
