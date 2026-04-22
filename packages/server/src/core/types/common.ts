/**
 * 核心类型定义 - 基于 @vt/data 权威设计
 */

import type { Faction, GamePhase, PlayerRoleValue } from "@vt/data";

import type { Token } from "../state/Token.js";

export type TurnPhase = string;
export type FactionTurnPhase = string;
export type TokenTurnState = string;

export interface GameState {
  id: string;
  phase: GamePhase;
  turn: number;
  activeFaction: Faction;
  players: Map<string, PlayerState>;
  tokens: Map<string, Token>;
  globalModifiers?: Map<string, number>;
  metadata: GameMetadata;
  turnPhase?: TurnPhase;
  factionTurnPhase?: FactionTurnPhase;
}

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

export interface GameAction {
  type: string;
  playerId: string;
  timestamp: number;
  payload: unknown;
}

export interface GameEvent {
  type: string;
  timestamp: number;
  payload: unknown;
}

export interface Point {
  x: number;
  y: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export type Angle = number;
export type Distance = number;

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;
export type ReadonlyMap<K, V> = Readonly<Map<K, V>>;