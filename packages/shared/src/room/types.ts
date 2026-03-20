/**
 * 房间框架核心类型定义
 *
 * 设计原则：
 * 1. 状态即真相 - 单一数据源
 * 2. 操作即函数 - 类型安全，自动同步
 * 3. 声明式权限 - onlyOwner, onlyDM
 */

import type { FactionId, ArmorQuadrant, Point } from '../types/index.js';

// ==================== 基础类型 ====================

/** 玩家状态 */
export interface PlayerState {
  id: string;
  name: string;
  isDM: boolean;
  faction: FactionId | null;
  isReady: boolean;
  isConnected: boolean;
}

/** Token 类型 */
export type TokenType = 'ship' | 'station' | 'asteroid' | 'debris' | 'objective';

/** Token 状态 */
export interface TokenState {
  id: string;
  type: TokenType;
  faction: FactionId | null;
  position: Point;
  heading: number;
  size: number;

  // 指挥权
  controllingPlayerId: string | null;  // 谁可以操作这个 Token
  isEnemy: boolean;  // 是否为敌方单位（DM 控制）

  // 舰船属性（仅 ship 类型）
  hull: number;
  maxHull: number;
  armor: Record<ArmorQuadrant, number>;
  maxArmor: number;
  shield: number;
  maxShield: number;
  flux: number;
  maxFlux: number;
  isShieldOn: boolean;
  isOverloaded: boolean;

  // 回合状态
  hasActed: boolean;
  movementRemaining: number;

  // 元数据
  name: string;  // 显示名称
  templateId: string;  // 来源模板 ID
}

/** 游戏阶段 */
export type RoomPhase = 'lobby' | 'deployment' | 'playing' | 'ended';

/** 回合阶段 */
export type RoomTurnPhase = 'player_action' | 'dm_action' | 'resolution';

/** 房间元数据 */
export interface RoomMeta {
  id: string;
  name: string;
  ownerId: string;
  phase: RoomPhase;
  round: number;
  turnPhase: RoomTurnPhase;
  currentFactionTurn: FactionId | null;
  createdAt: number;
  updatedAt: number;
}

/** 游戏状态 */
export interface GameState {
  tokens: Record<string, TokenState>;
  selectedTargets: Record<string, string[]>;  // playerId -> targetIds
  selectedWeapons: Record<string, string>;    // playerId -> weaponId
  selectedQuadrants: Record<string, ArmorQuadrant>;  // playerId -> quadrant
}

// ==================== 房间状态 ====================

/** 完整房间状态 */
export interface RoomState {
  meta: RoomMeta;
  players: Record<string, PlayerState>;
  game: GameState;
}

/** 空房间状态 */
export function createEmptyRoomState(roomId: string, name: string, ownerId: string): RoomState {
  const now = Date.now();
  return {
    meta: {
      id: roomId,
      name,
      ownerId,
      phase: 'lobby',
      round: 0,
      turnPhase: 'player_action',
      currentFactionTurn: null,
      createdAt: now,
      updatedAt: now,
    },
    players: {
      [ownerId]: {
        id: ownerId,
        name: '',
        isDM: true,  // 房主 = DM
        faction: null,
        isReady: false,
        isConnected: true,
      },
    },
    game: {
      tokens: {},
      selectedTargets: {},
      selectedWeapons: {},
      selectedQuadrants: {},
    },
  };
}

// ==================== 操作类型推导 ====================

/** 操作函数签名 */
export type OperationFn<TArgs extends any[] = any[], TReturn = void> = (
  state: RoomState,
  clientId: string,
  ...args: TArgs
) => TReturn | Promise<TReturn>;

/** 操作定义 */
export interface OperationDef<TArgs extends any[] = any[], TReturn = void> {
  handler: OperationFn<TArgs, TReturn>;
  requireOwner?: boolean;
  requireDM?: boolean;
  description?: string;
}

/** 从操作定义提取参数类型 */
export type InferArgs<T> = T extends OperationDef<infer Args, any> ? Args : never;

/** 从操作定义提取返回类型 */
export type InferReturn<T> = T extends OperationDef<any, infer R> ? R : never;

/** 操作映射 */
export type OperationMap = Record<string, OperationDef<any, any>>;

/** 从操作映射提取操作名 */
export type OperationName<T extends OperationMap> = keyof T & string;

/** 客户端可调用操作签名 */
export type ClientOperation<T extends OperationMap, K extends OperationName<T>> = (
  ...args: InferArgs<T[K]>
) => Promise<InferReturn<T[K]>>;

// ==================== 消息类型 ====================

/** 状态更新消息 */
export interface StateUpdateMessage {
  type: 'STATE_UPDATE';
  version: number;
  diff: Partial<RoomState>;
  timestamp: number;
}

/** 事件消息 */
export interface EventMessage<T = unknown> {
  type: 'EVENT';
  event: string;
  payload: T;
  timestamp: number;
}

/** 操作请求消息 */
export interface OperationRequestMessage<TArgs extends any[] = any[]> {
  type: 'OPERATION';
  operation: string;
  args: TArgs;
  requestId: string;
}

/** 操作响应消息 */
export interface OperationResponseMessage<TReturn = void> {
  type: 'OPERATION_RESPONSE';
  requestId: string;
  success: boolean;
  result?: TReturn;
  error?: string;
  timestamp: number;
}

/** 同步消息 */
export type SyncMessage = 
  | StateUpdateMessage 
  | EventMessage 
  | OperationRequestMessage 
  | OperationResponseMessage;

// ==================== 状态差异 ====================

/** 状态差异计算结果 */
export interface StateDiff {
  added: Record<string, unknown>;
  removed: string[];
  changed: Record<string, { old: unknown; new: unknown }>;
}

// ==================== 房间配置 ====================

/** 房间配置 */
export interface RoomConfig<T extends OperationMap = OperationMap> {
  name: string;
  maxPlayers: number;
  operations: T;

  /** 状态变化时自动广播的路径 */
  broadcastPaths?: Record<string, string>;

  /** 初始化钩子 */
  onCreated?: (state: RoomState) => void | Promise<void>;

  /** 玩家加入钩子 */
  onPlayerJoin?: (state: RoomState, playerId: string) => void | Promise<void>;

  /** 玩家离开钩子 */
  onPlayerLeave?: (state: RoomState, playerId: string) => void | Promise<void>;
}

// ==================== 素材模板 ====================

/** 素材模板 - 可拖拽放置的预设单位 */
export interface AssetTemplate {
  id: string;
  name: string;
  type: TokenType;
  category: 'ship' | 'environment' | 'objective';
  
  // 阵营限制（null 表示可选）
  faction: FactionId | null;
  
  // 是否为敌方单位
  isEnemy: boolean;
  
  // 属性配置
  config: {
    hull: number;
    armor: number;
    shield: number;
    flux: number;
    speed: number;
    turnRate: number;
    size: number;
  };
  
  // 图标/图片
  icon?: string;
  thumbnail?: string;
  
  // 描述
  description?: string;
}

/** 素材分类 */
export interface AssetCategory {
  id: string;
  name: string;
  icon: string;
  templates: AssetTemplate[];
}

/** 素材库 */
export interface AssetLibrary {
  categories: AssetCategory[];
}