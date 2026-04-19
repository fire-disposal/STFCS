/**
 * 核心类型定义 - 基于 @vt/data 权威设计
 */

import type { 
  ShipJSON, 
  WeaponJSON, 
  ShipRuntime, 
  WeaponRuntime,
  FactionType,
  PlayerRoleValue,
  GamePhaseType,
  TurnPhase,
  FactionTurnPhase,
  TokenType,
  TokenTurnState,
  ClientCommand,
  Point
} from "@vt/data";

import type { TokenState, ShipTokenState } from "../state/Token.js";
import type { ComponentState, WeaponComponentState } from "../state/Component.js";

// ==================== 游戏状态类型 ====================

/** 游戏状态快照 - 基于data包schema设计 */
export interface GameState {
  id: string;
  phase: GamePhaseType;
  turn: number;
  activeFaction: FactionType;
  players: Map<string, PlayerState>;
  tokens: Map<string, TokenState>; // 所有Token（舰船、站台、小行星等）
  components: Map<string, ComponentState>; // 所有组件（武器、引擎等）
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
  faction: FactionType;
  ready: boolean;
  connected: boolean;
  pingMs: number;
  jitterMs?: number;
  connectionQuality?: string;
  avatar?: string;
}

/** 舰船状态（兼容旧接口） - 基于ShipTokenState */
export interface ShipState {
  id: string;
  shipJson: ShipJSON;
  runtime: ShipRuntime;
  tokenType?: TokenType;
  tokenTurnState?: TokenTurnState;
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