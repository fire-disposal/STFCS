/**
 * 前端类型定义
 * 
 * 从 @vt/schema-types 和 @vt/data 导入类型定义
 * 定义前端特有的类型
 */

// ==================== 从类型包导入 ====================

// 从 @vt/data 导入JSON模型类型
import type {
  // 通用类型
  TextureSourceType,
  Texture,
  FactionType,
  FluxStateType,
  GamePhaseType,
  Metadata,
  Point,
  
  // 玩家档案类型
  PlayerProfile,
  GameSave,
  SaveMetadata,
  
  // 资产类型
  Asset,
  AssetType,
  
  // 舰船类型
  ShipJSON,
  ShipSpec,
  ShipRuntime,
  ShieldSpec,
  MountSpec,
  MovementState,
  ShipIdFormat,
  
  // 武器类型
  WeaponJSON,
  WeaponSpec,
  WeaponRuntime,
  WeaponCategoryType,
  DamageTypeType,
  WeaponStateType,
  WeaponTagType,
  StatusEffect,
  WeaponIdFormat,
} from '@vt/data'

// 从 @vt/data 导入运行时枚举值
import {
  DamageType,
  WeaponCategory,
  WeaponSlotSize,
  WeaponTag,
  HullSize,
  ShipClass,
  WeaponState,
  ArmorQuadrant,
  GamePhase,
  Faction,
  PlayerRole,
  ConnectionQuality,
  ChatMessageType,
} from '@vt/data'

// 从 @vt/data 导入类型别名
import type {
  GamePhaseValue,
  FactionValue,
  PlayerRoleValue,
  WeaponCategoryValue,
  DamageTypeValue,
  WeaponStateValue,
  WeaponTagValue,
} from '@vt/data'

// 重新导出所有导入的类型
export {
  DamageType,
  WeaponCategory,
  WeaponSlotSize,
  WeaponTag,
  HullSize,
  ShipClass,
  WeaponState,
  ArmorQuadrant,
  GamePhase,
  Faction,
  PlayerRole,
  ConnectionQuality,
  ChatMessageType,
}

export type {
  TextureSourceType,
  Texture,
  FactionType,
  FluxStateType,
  GamePhaseType,
  Metadata,
  Point,
  PlayerProfile,
  GameSave,
  SaveMetadata,
  Asset,
  AssetType,
  ShipJSON,
  ShipSpec,
  ShipRuntime,
  ShieldSpec,
  MountSpec,
  MovementState,
  ShipIdFormat,
  WeaponJSON,
  WeaponSpec,
  WeaponRuntime,
  WeaponCategoryType,
  DamageTypeType,
  WeaponStateType,
  WeaponTagType,
  StatusEffect,
  WeaponIdFormat,
  GamePhaseValue,
  FactionValue,
  PlayerRoleValue,
  WeaponCategoryValue,
  DamageTypeValue,
  WeaponStateValue,
  WeaponTagValue,
}

// ==================== 前端特有类型 ====================

/**
 * 应用状态类型
 */
export interface AppState {
  // 连接状态
  connection: ConnectionState
  
  // 玩家状态
  player: FrontendPlayerState
  
  // 房间状态
  room: RoomState | null
  
  // 游戏状态
  game: GameState
  
  // UI状态
  ui: UIState
}

/**
 * 连接状态
 */
export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  latency: number
  serverTimeOffset: number
  lastHeartbeat: number
  connectionId: string | null
}

/**
 * 前端玩家状态（扩展后端玩家状态）
 */
export interface FrontendPlayerState {
  id: string | null
  sessionId: string | null
  name: string | null
  role: PlayerRoleValue | null
  profile: PlayerProfile | null
  ready: boolean
  connected: boolean
  connectionQuality: typeof ConnectionQuality[keyof typeof ConnectionQuality]
}

/**
 * 房间状态
 */
export interface RoomState {
  id: string
  name: string
  maxPlayers: number
  phase: GamePhaseValue
  turn: number
  players: Map<string, FrontendPlayerState>
  ownerId: string | null
  createdAt: number
  isPrivate: boolean
}

/**
 * 游戏状态
 */
export interface GameState {
  ships: Map<string, ShipRuntime>
  weapons: Map<string, WeaponRuntime>
  objects: Map<string, GameObject>
  turn: number
  phase: GamePhaseValue
}

/**
 * 游戏对象
 */
export interface GameObject {
  id: string
  type: 'ship' | 'token' | 'marker' | 'terrain'
  position: Point
  rotation: number
  data: Record<string, unknown>
}

/**
 * UI状态
 */
export interface UIState {
  // 相机状态
  camera: {
    position: Point
    zoom: number
    rotation: number
  }
  
  // 选择状态
  selection: {
    shipId: string | null
    weaponId: string | null
    targetId: string | null
  }
  
  // 面板状态
  panels: {
    leftPanel: boolean
    rightPanel: boolean
    bottomPanel: boolean
    chatPanel: boolean
  }
  
  // 显示设置
  display: {
    showGrid: boolean
    showLabels: boolean
    showEffects: boolean
    showWeaponArcs: boolean
    showMovementRange: boolean
    showBackground: boolean
  }
  
  // 工具状态
  tool: 'select' | 'move' | 'rotate' | 'attack' | 'measure'
}

/**
 * WebSocket消息类型
 */
export interface WSMessage<T = unknown> {
  type: string
  payload: T
  id?: string
  timestamp?: number
}

/**
 * 连接消息负载
 */
export interface ConnectPayload {
  clientVersion: string
  playerName: string
  sessionId?: string
}

/**
 * 连接响应负载
 */
export interface ConnectedPayload {
  serverVersion: string
  sessionId: string
  serverTime: number
  playerId: string
}

/**
 * 心跳消息负载
 */
export interface HeartbeatPayload {
  clientTime: number
  sequence: number
}

/**
 * 心跳响应负载
 */
export interface HeartbeatAckPayload {
  clientTime: number
  serverTime: number
  latency: number
  sequence: number
}

/**
 * 房间信息
 */
export interface RoomInfo {
  id: string
  name: string
  playerCount: number
  maxPlayers: number
  status: 'open' | 'full' | 'in_progress'
  phase: GamePhaseValue
  ownerId: string | null
  createdAt: number
}

/**
 * 房间列表响应
 */
export interface RoomListResultPayload {
  rooms: RoomInfo[]
}

/**
 * 房间创建负载
 */
export interface RoomCreatePayload {
  name: string
  maxPlayers?: number
  mapWidth?: number
  mapHeight?: number
  isPrivate?: boolean
}

/**
 * 房间创建响应
 */
export interface RoomCreatedPayload {
  roomId: string
  name: string
  joinToken: string
}

/**
 * 房间加入负载
 */
export interface RoomJoinPayload {
  roomId: string
  joinToken?: string
  faction?: FactionValue
}

/**
 * 房间加入响应
 */
export interface RoomJoinedPayload {
  roomId: string
  playerId: string
  roomInfo: RoomInfo
  players: Array<{
    id: string
    name: string
    faction: FactionValue
    ready: boolean
    role: PlayerRoleValue
  }>
}

/**
 * 错误负载
 */
export interface ErrorPayload {
  code: string
  message: string
  details?: Record<string, unknown>
}

/**
 * 游戏命令结果
 */
export interface GameCommandResultPayload {
  success: boolean
  command: string
  data?: Record<string, unknown>
  error?: ErrorPayload
}

/**
 * 状态完整同步
 */
export interface StateFullPayload {
  gameState: Record<string, unknown>
}

/**
 * 状态增量更新
 */
export interface StateDeltaPayload {
  changes: Array<{
    path: string
    value: unknown
    oldValue?: unknown
  }>
}

/**
 * 游戏事件
 */
export interface EventPayload {
  eventType: string
  data: Record<string, unknown>
  timestamp: number
}

// ==================== 类型守卫 ====================

/**
 * 检查是否是连接消息
 */
export function isConnectMessage(msg: WSMessage): msg is WSMessage<ConnectPayload> {
  return msg.type === 'connect'
}

/**
 * 检查是否是连接响应消息
 */
export function isConnectedMessage(msg: WSMessage): msg is WSMessage<ConnectedPayload> {
  return msg.type === 'connected'
}

/**
 * 检查是否是心跳消息
 */
export function isHeartbeatMessage(msg: WSMessage): msg is WSMessage<HeartbeatPayload> {
  return msg.type === 'heartbeat'
}

/**
 * 检查是否是心跳响应消息
 */
export function isHeartbeatAckMessage(msg: WSMessage): msg is WSMessage<HeartbeatAckPayload> {
  return msg.type === 'heartbeat_ack'
}

/**
 * 检查是否是错误消息
 */
export function isErrorMessage(msg: WSMessage): msg is WSMessage<ErrorPayload> {
  return msg.type === 'error'
}

/**
 * 检查是否是房间列表响应
 */
export function isRoomListResultMessage(msg: WSMessage): msg is WSMessage<RoomListResultPayload> {
  return msg.type === 'room:list_result'
}

/**
 * 检查是否是房间创建响应
 */
export function isRoomCreatedMessage(msg: WSMessage): msg is WSMessage<RoomCreatedPayload> {
  return msg.type === 'room:created'
}

/**
 * 检查是否是房间加入响应
 */
export function isRoomJoinedMessage(msg: WSMessage): msg is WSMessage<RoomJoinedPayload> {
  return msg.type === 'room:joined'
}

/**
 * 检查是否是状态完整同步
 */
export function isStateFullMessage(msg: WSMessage): msg is WSMessage<StateFullPayload> {
  return msg.type === 'state:full'
}

/**
 * 检查是否是状态增量更新
 */
export function isStateDeltaMessage(msg: WSMessage): msg is WSMessage<StateDeltaPayload> {
  return msg.type === 'state:delta'
}

/**
 * 检查是否是游戏事件
 */
export function isEventMessage(msg: WSMessage): msg is WSMessage<EventPayload> {
  return msg.type === 'event'
}

// ==================== 工具类型 ====================

/**
 * 提取Promise的类型
 */
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

/**
 * 提取数组元素的类型
 */
export type UnwrapArray<T> = T extends Array<infer U> ? U : T

/**
 * 使所有属性可选，包括嵌套属性
 */
export type DeepPartial<T> = T extends object ? {
  [P in keyof T]?: DeepPartial<T[P]>
} : T

/**
 * 使所有属性必需，包括嵌套属性
 */
export type DeepRequired<T> = T extends object ? {
  [P in keyof T]-?: DeepRequired<T[P]>
} : T

/**
 * 从类型中排除null和undefined
 */
export type NonNullable<T> = T extends null | undefined ? never : T

/**
 * 从类型中排除undefined
 */
export type NonUndefined<T> = T extends undefined ? never : T