/**
 * 核心类型定义 - 基于 @vt/data 权威设计
 */

import type { Faction, GamePhase, PlayerRoleValue } from "@vt/data";

import type { Token } from "../state/Token.js";
import type { ComponentState } from "../state/Component.js";

// 本地定义这些类型（@vt/data 中不存在）
export type TurnPhase = string;
export type FactionTurnPhase = string;
export type TokenTurnState = string;

// ==================== 游戏状态类型 ====================

/** 游戏状态快照 - 基于data包schema设计 */
export interface GameState {
  id: string;
  phase: GamePhase;
  turn: number;
  activeFaction: Faction;
  players: Map<string, PlayerState>;
  tokens: Map<string, Token>;
  components: Map<string, ComponentState>;
  globalModifiers?: Map<string, number>;
  metadata: GameMetadata;
  turnPhase?: TurnPhase;
  factionTurnPhase?: FactionTurnPhase;
}

/** 玩家状态 - 基于data包设计 */
export interface PlayerState {
  id: string;
  sessionId: string;
  name: string;
  nickname?: string;
  role: PlayerRoleValue;
  faction: Faction;
  ready: boolean;
  connected: boolean;
  pingMs: number;
  jitterMs?: number;
  connectionQuality?: string;
  avatar?: string;
}

/** 游戏元数据 */
export interface GameMetadata {
  roomId: string;
  roomName: string;
  createdAt: number;
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  creatorSessionId?: string;
  displayName?: string;
}

// ==================== Action/Event 类型 ====================

/** Action基类 */
export interface GameAction {
  type: string;
  playerId: string;
  timestamp: number;
  payload: unknown;
}

/** Event基类 */
export interface GameEvent {
  type: string;
  timestamp: number;
  payload: unknown;
}

// ==================== 几何类型 ====================

/** 2D点 */
export interface Point {
  x: number;
  y: number;
}

/** 2D向量 */
export interface Vector2D {
  x: number;
  y: number;
}

/** 角度（0-360度） */
export type Angle = number;

/** 距离 */
export type Distance = number;

// ==================== 验证结果 ====================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

// ==================== 工具类型 ====================

/** 可选但非null */
export type Optional<T> = T | undefined;

/** 可为null */
export type Nullable<T> = T | null;

/** 只读映射 */
export type ReadonlyMap<K, V> = Readonly<Map<K, V>>;