/**
 * 新一代WebSocket协议定义
 * 基于 @vt/data schema化架构设计
 */

import type { ShipJSON, WeaponJSON, FactionType, GamePhaseType } from "@vt/data";

// ==================== 协议版本 ====================

export const PROTOCOL_VERSION = "2.0.0";
export const PROTOCOL_SCHEMA = "stfcs-ws-v2";

// ==================== 基础消息结构 ====================

/**
 * 基础消息接口
 */
export interface BaseMessage {
  /** 协议版本 */
  version: string;
  /** 消息类型 */
  type: string;
  /** 消息ID（用于请求-响应匹配） */
  id?: string;
  /** 时间戳 */
  timestamp: number;
  /** 消息负载 */
  payload: unknown;
}

/**
 * 请求消息
 */
export interface RequestMessage extends BaseMessage {
  id: string;
}

/**
 * 响应消息
 */
export interface ResponseMessage extends BaseMessage {
  /** 关联的请求ID */
  requestId: string;
  /** 响应状态 */
  status: "success" | "error";
}

// ==================== 连接层消息 ====================

/**
 * 连接建立消息
 */
export interface ConnectMessage extends BaseMessage {
  type: "connect";
  payload: {
    clientId: string;
    clientVersion: string;
    capabilities: string[];
  };
}

/**
 * 连接确认消息
 */
export interface ConnectedMessage extends BaseMessage {
  type: "connected";
  payload: {
    serverId: string;
    serverVersion: string;
    sessionId: string;
    protocolVersion: string;
    serverTime: number;
    features: string[];
  };
}

/**
 * 心跳消息
 */
export interface HeartbeatMessage extends BaseMessage {
  type: "heartbeat";
  payload: {
    clientTime: number;
    sequence: number;
  };
}

/**
 * 心跳响应
 */
export interface HeartbeatResponse extends BaseMessage {
  type: "heartbeat_response";
  payload: {
    clientTime: number;
    serverTime: number;
    latency: number;
    sequence: number;
  };
}

// ==================== 认证层消息 ====================

/**
 * 认证请求
 */
export interface AuthenticateMessage extends BaseMessage {
  type: "authenticate";
  payload: {
    token: string;
    userId: string;
    displayName?: string;
    metadata?: Record<string, any>;
  };
}

/**
 * 认证响应
 */
export interface AuthenticatedMessage extends BaseMessage {
  type: "authenticated";
  payload: {
    userId: string;
    sessionId: string;
    authenticatedAt: number;
    permissions: string[];
    profile?: Record<string, any>;
  };
}

// ==================== 房间层消息 ====================

/**
 * 房间列表请求
 */
export interface ListRoomsMessage extends BaseMessage {
  type: "list_rooms";
  payload: {
    filter?: {
      status?: "open" | "full" | "in_progress" | "ended";
      maxPlayers?: number;
      hasPassword?: boolean;
    };
    limit?: number;
    offset?: number;
  };
}

/**
 * 房间列表响应
 */
export interface RoomsListMessage extends BaseMessage {
  type: "rooms_list";
  payload: {
    rooms: RoomInfo[];
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * 房间信息
 */
export interface RoomInfo {
  id: string;
  name: string;
  description?: string;
  status: "open" | "full" | "in_progress" | "ended";
  playerCount: number;
  maxPlayers: number;
  gamePhase: "DEPLOYMENT" | "PLAYER_ACTION" | "DM_ACTION" | "TURN_END";
  turn: number;
  createdAt: number;
  creatorId?: string;
  metadata?: Record<string, any>;
}

/**
 * 创建房间请求
 */
export interface CreateRoomMessage extends BaseMessage {
  type: "create_room";
  payload: {
    name: string;
    description?: string;
    maxPlayers?: number;
    mapConfig?: {
      width: number;
      height: number;
      preset?: string;
    };
    gameConfig?: {
      turnTimeLimit?: number;
      victoryConditions?: string[];
      modifiers?: Record<string, any>;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * 创建房间响应
 */
export interface RoomCreatedMessage extends BaseMessage {
  type: "room_created";
  payload: {
    roomId: string;
    name: string;
    createdAt: number;
    creatorId: string;
    joinToken?: string;
  };
}

/**
 * 加入房间请求
 */
export interface JoinRoomMessage extends BaseMessage {
  type: "join_room";
  payload: {
    roomId: string;
    joinToken?: string;
    playerConfig?: {
      faction?: "PLAYER" | "ENEMY" | "NEUTRAL";
      ready?: boolean;
      metadata?: Record<string, any>;
    };
  };
}

/**
 * 加入房间响应
 */
export interface RoomJoinedMessage extends BaseMessage {
  type: "room_joined";
  payload: {
    roomId: string;
    playerId: string;
    joinedAt: number;
    roomInfo: RoomInfo;
    players: PlayerInfo[];
    tokens: TokenInfo[];
    components: ComponentInfo[];
  };
}

/**
 * 离开房间请求
 */
export interface LeaveRoomMessage extends BaseMessage {
  type: "leave_room";
  payload: {
    roomId: string;
  };
}

/**
 * 离开房间响应
 */
export interface RoomLeftMessage extends BaseMessage {
  type: "room_left";
  payload: {
    roomId: string;
    leftAt: number;
  };
}

/**
 * 删除房间请求
 */
export interface DeleteRoomMessage extends BaseMessage {
  type: "delete_room";
  payload: {
    roomId: string;
  };
}

/**
 * 保存房间请求
 */
export interface SaveRoomMessage extends BaseMessage {
  type: "save_room";
  payload: {
    roomId: string;
    saveName: string;
    description?: string;
  };
}

/**
 * 加载存档请求
 */
export interface LoadSaveMessage extends BaseMessage {
  type: "load_save";
  payload: {
    saveId: string;
  };
}

/**
 * 列出存档请求
 */
export interface ListSavesMessage extends BaseMessage {
  type: "list_saves";
  payload: {
    filter?: {
      creatorId?: string;
      tags?: string[];
    };
    limit?: number;
    offset?: number;
  };
}

/**
 * 删除存档请求
 */
export interface DeleteSaveMessage extends BaseMessage {
  type: "delete_save";
  payload: {
    saveId: string;
  };
}

// ==================== 游戏状态消息 ====================

/**
 * 玩家信息
 */
export interface PlayerInfo {
  id: string;
  name: string;
  faction: "PLAYER" | "ENEMY" | "NEUTRAL";
  role: "player" | "dm" | "observer";
  ready: boolean;
  connected: boolean;
  ping: number;
  joinedAt: number;
  metadata?: Record<string, any>;
}

/**
 * Token信息
 */
export interface TokenInfo {
  id: string;
  type: "ship" | "station" | "asteroid" | "projectile" | "effect";
  dataRef: string; // 引用到data包中的JSON数据ID
  position: { x: number; y: number };
  heading: number;
  scale: number;
  visible: boolean;
  selected: boolean;
  locked: boolean;
  metadata: {
    name: string;
    faction?: FactionType;
    ownerId?: string;
    tags: string[];
  };
  // 舰船特定字段
  shipState?: {
    hull: number;
    maxHull: number;
    armor: number[];
    maxArmor: number;
    fluxSoft: number;
    fluxHard: number;
    fluxCapacity: number;
    shieldActive: boolean;
    shieldValue: number;
    maxShield: number;
    overloaded: boolean;
    overloadTime: number;
    destroyed: boolean;
    hasMoved: boolean;
    hasFired: boolean;
  };
}

/**
 * 组件信息
 */
export interface ComponentInfo {
  id: string;
  type: "weapon" | "engine" | "shield" | "armor" | "system";
  dataRef: string; // 引用到data包中的JSON数据ID
  mountId: string;
  tokenId: string;
  enabled: boolean;
  state: "ready" | "active" | "cooldown" | "disabled" | "damaged";
  cooldownRemaining: number;
  durability: number;
  maxDurability: number;
  metadata: {
    name: string;
    tags: string[];
  };
  // 武器特定字段
  weaponState?: {
    damage: number;
    damageType: string;
    range: number;
    minRange: number;
    ready: boolean;
    canFire: boolean;
    fluxCost: number;
    burstCount: number;
    allowsMultipleTargets: boolean;
    isPointDefense: boolean;
  };
}

/**
 * 游戏状态更新
 */
export interface GameStateUpdateMessage extends BaseMessage {
  type: "game_state_update";
  payload: {
    roomId: string;
    updateType: "full" | "partial" | "delta";
    state: {
      phase?: GamePhaseType;
      turn?: number;
      activeFaction?: Faction;
      turnPhase?: string;
      factionTurnPhase?: string;
    };
    tokens?: TokenInfo[];
    components?: ComponentInfo[];
    players?: PlayerInfo[];
    events?: GameEvent[];
  };
}

// ==================== 游戏命令消息 ====================

/**
 * 游戏命令基类
 */
export interface GameCommandMessage extends BaseMessage {
  type: "game_command";
  payload: {
    command: string;
    params: Record<string, any>;
  };
}

/**
 * 移动命令
 */
export interface MoveCommand {
  command: "move";
  params: {
    tokenId: string;
    distance: number;
    direction: "forward" | "backward" | "strafe_left" | "strafe_right";
    phase: "a" | "c";
  };
}

/**
 * 旋转命令
 */
export interface RotateCommand {
  command: "rotate";
  params: {
    tokenId: string;
    angle: number;
    phase: "b";
  };
}

/**
 * 攻击命令
 */
export interface AttackCommand {
  command: "attack";
  params: {
    attackerId: string;
    targetId: string;
    weaponId: string;
    fireMode?: "single" | "burst" | "sustained";
    targetQuadrant?: number;
  };
}

/**
 * 切换护盾命令
 */
export interface ToggleShieldCommand {
  command: "toggle_shield";
  params: {
    tokenId: string;
    active: boolean;
  };
}

/**
 * 排散辐能命令
 */
export interface VentFluxCommand {
  command: "vent_flux";
  params: {
    tokenId: string;
  };
}

/**
 * 结束回合命令
 */
export interface EndTurnCommand {
  command: "end_turn";
  params: Record<string, never>;
}

/**
 * 应用修正命令
 */
export interface ApplyModifierCommand {
  command: "apply_modifier";
  params: {
    targetType: "ship" | "faction" | "all";
    targetId?: string;
    faction?: FactionType;
    modifier: {
      type: string;
      data: Record<string, any>;
      stackable?: boolean;
    };
    duration?: number;
    sourceId?: string;
  };
}

// ==================== 游戏事件消息 ====================

/**
 * 游戏事件
 */
export interface GameEvent {
  type: string;
  timestamp: number;
  source?: string;
  target?: string;
  data: Record<string, any>;
}

/**
 * 游戏事件消息
 */
export interface GameEventMessage extends BaseMessage {
  type: "game_event";
  payload: {
    roomId: string;
    events: GameEvent[];
  };
}

// ==================== 数据同步消息 ====================

/**
 * 数据同步请求
 */
export interface DataSyncRequestMessage extends BaseMessage {
  type: "data_sync_request";
  payload: {
    dataType: "ships" | "weapons" | "presets" | "all";
    since?: number;
    ids?: string[];
  };
}

/**
 * 数据同步响应
 */
export interface DataSyncResponseMessage extends BaseMessage {
  type: "data_sync_response";
  payload: {
    dataType: string;
    data: {
      ships?: ShipJSON[];
      weapons?: WeaponJSON[];
      presets?: any[];
    };
    timestamp: number;
    syncId: string;
  };
}

// ==================== 错误消息 ====================

/**
 * 错误消息
 */
export interface ErrorMessage extends BaseMessage {
  type: "error";
  payload: {
    code: string;
    message: string;
    details?: Record<string, any>;
    requestId?: string;
  };
}

// ==================== 工具类型 ====================

/**
 * 消息类型映射
 */
export type MessageTypeMap = {
  connect: ConnectMessage;
  connected: ConnectedMessage;
  heartbeat: HeartbeatMessage;
  heartbeat_response: HeartbeatResponse;
  authenticate: AuthenticateMessage;
  authenticated: AuthenticatedMessage;
  list_rooms: ListRoomsMessage;
  rooms_list: RoomsListMessage;
  create_room: CreateRoomMessage;
  room_created: RoomCreatedMessage;
  join_room: JoinRoomMessage;
  room_joined: RoomJoinedMessage;
  leave_room: LeaveRoomMessage;
  room_left: RoomLeftMessage;
  delete_room: DeleteRoomMessage;
  save_room: SaveRoomMessage;
  load_save: LoadSaveMessage;
  list_saves: ListSavesMessage;
  delete_save: DeleteSaveMessage;
  game_state_update: GameStateUpdateMessage;
  game_command: GameCommandMessage;
  game_event: GameEventMessage;
  data_sync_request: DataSyncRequestMessage;
  data_sync_response: DataSyncResponseMessage;
  error: ErrorMessage;
};

/**
 * 消息类型
 */
export type MessageType = keyof MessageTypeMap;

/**
 * 消息联合类型
 */
export type Message = MessageTypeMap[MessageType];

/**
 * 创建基础消息
 */
export function createMessage<T extends MessageType>(
  type: T,
  payload: MessageTypeMap[T]["payload"],
  id?: string
): MessageTypeMap[T] {
  const now = Date.now();
  
  const baseMessage = {
    version: PROTOCOL_VERSION,
    type,
    timestamp: now,
    payload,
  };

  if (id) {
    return {
      ...baseMessage,
      id,
    } as unknown as MessageTypeMap[T];
  }

  return baseMessage as unknown as MessageTypeMap[T];
}

/**
 * 创建响应消息
 */
export function createResponseMessage(
  requestId: string,
  type: MessageType,
  payload: any,
  status: "success" | "error" = "success"
): ResponseMessage {
  return {
    version: PROTOCOL_VERSION,
    type,
    requestId,
    timestamp: Date.now(),
    status,
    payload,
  };
}

/**
 * 创建错误消息
 */
export function createErrorMessage(
  code: string,
  message: string,
  details?: Record<string, any>,
  requestId?: string
): ErrorMessage {
  return createMessage("error", {
    code,
    message,
    ...(details && { details }),
    ...(requestId && { requestId }),
  });
}

/**
 * 验证消息格式
 */
export function validateMessage(message: any): message is Message {
  if (!message || typeof message !== "object") return false;
  
  const required = ["version", "type", "timestamp", "payload"];
  for (const field of required) {
    if (!(field in message)) return false;
  }
  
  if (typeof message.version !== "string") return false;
  if (typeof message.type !== "string") return false;
  if (typeof message.timestamp !== "number") return false;
  
  return true;
}

/**
 * 解析消息
 */
export function parseMessage(data: string): Message | null {
  try {
    const parsed = JSON.parse(data);
    if (validateMessage(parsed)) {
      return parsed as Message;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 序列化消息
 */
export function serializeMessage(message: Message): string {
  return JSON.stringify(message);
}