/**
 * WebSocket 消息协议定义
 *
 * 所有消息类型从 Zod schema 推导，确保类型安全
 */

import { z } from 'zod';
import type { PlayerInfo, ShipStatus } from '../types';
import {
  PlayerInfoSchema,
  ShipMovementSchema,
  ShipStatusSchema,
  ExplosionDataSchema,
  MapConfigSchema,
  TokenInfoSchema,
  PlayerCameraSchema,
  ArmorQuadrantSchema,
  FluxOverloadStateSchema,
  PointSchema,
} from '../core-types';

// ==================== 消息类型常量 ====================
export const WS_MESSAGE_TYPES = {
  // 事件消息（广播）
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  SHIP_MOVED: 'SHIP_MOVED',
  SHIP_STATUS_UPDATE: 'SHIP_STATUS_UPDATE',
  EXPLOSION: 'EXPLOSION',
  SHIELD_UPDATE: 'SHIELD_UPDATE',
  FLUX_STATE: 'FLUX_STATE',
  COMBAT_EVENT: 'COMBAT_EVENT',
  MAP_INITIALIZED: 'MAP_INITIALIZED',
  TOKEN_PLACED: 'TOKEN_PLACED',
  TOKEN_MOVED: 'TOKEN_MOVED',
  CAMERA_UPDATED: 'CAMERA_UPDATED',
  WEAPON_FIRED: 'WEAPON_FIRED',
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  DRAWING_ADD: 'DRAWING_ADD',
  DRAWING_CLEAR: 'DRAWING_CLEAR',
  DRAWING_SYNC: 'DRAWING_SYNC',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  ERROR: 'ERROR',

  // 请求 - 响应消息
  REQUEST: 'REQUEST',
  RESPONSE: 'RESPONSE',

  // 连接控制消息
  PING: 'PING',
  PONG: 'PONG',
  ROOM_UPDATE: 'ROOM_UPDATE',

  // DM 模式
  DM_TOGGLE: 'DM_TOGGLE',
  DM_STATUS_UPDATE: 'DM_STATUS_UPDATE',

  // 选择系统
  OBJECT_SELECTED: 'OBJECT_SELECTED',
  OBJECT_DESELECTED: 'OBJECT_DESELECTED',
  SELECTION_UPDATE: 'SELECTION_UPDATE',

  // Token 拖拽
  TOKEN_DRAG_START: 'TOKEN_DRAG_START',
  TOKEN_DRAGGING: 'TOKEN_DRAGGING',
  TOKEN_DRAG_END: 'TOKEN_DRAG_END',

  // 回合系统
  TURN_ORDER_INITIALIZED: 'TURN_ORDER_INITIALIZED',
  TURN_ORDER_UPDATED: 'TURN_ORDER_UPDATED',
  TURN_INDEX_CHANGED: 'TURN_INDEX_CHANGED',
  UNIT_STATE_CHANGED: 'UNIT_STATE_CHANGED',
  ROUND_INCREMENTED: 'ROUND_INCREMENTED',
} as const;

export type WSMessageType = (typeof WS_MESSAGE_TYPES)[keyof typeof WS_MESSAGE_TYPES];

// ==================== 基础消息 Schema ====================
const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

// ==================== 事件消息 Schema ====================
export const PlayerJoinedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.PLAYER_JOINED),
  payload: PlayerInfoSchema,
});

export const PlayerLeftMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.PLAYER_LEFT),
  payload: z.object({
    playerId: z.string(),
    reason: z.string().optional(),
  }),
});

export const ShipMovedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.SHIP_MOVED),
  payload: ShipMovementSchema,
});

export const ShipStatusUpdateMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE),
  payload: ShipStatusSchema,
});

export const ExplosionMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.EXPLOSION),
  payload: ExplosionDataSchema,
});

export const ShieldUpdateMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.SHIELD_UPDATE),
  payload: z.object({
    shipId: z.string(),
    active: z.boolean(),
    type: z.enum(['front', 'full']),
    coverageAngle: z.number().min(0).max(360),
  }),
});

export const FluxStateMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.FLUX_STATE),
  payload: z.object({
    shipId: z.string(),
    fluxState: FluxOverloadStateSchema,
    currentFlux: z.number().min(0),
    softFlux: z.number().min(0),
    hardFlux: z.number().min(0),
  }),
});

export const CombatEventMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.COMBAT_EVENT),
  payload: z.object({
    sourceShipId: z.string(),
    targetShipId: z.string(),
    weaponId: z.string(),
    hit: z.boolean(),
    damage: z.number().min(0).optional(),
    hitQuadrant: ArmorQuadrantSchema.optional(),
    timestamp: z.number(),
  }),
});

export const MapInitializedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.MAP_INITIALIZED),
  payload: MapConfigSchema.extend({
    tokens: z.array(TokenInfoSchema),
  }),
});

export const TokenPlacedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TOKEN_PLACED),
  payload: TokenInfoSchema,
});

export const TokenMovedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TOKEN_MOVED),
  payload: z.object({
    tokenId: z.string(),
    previousPosition: PointSchema,
    newPosition: PointSchema,
    previousHeading: z.number(),
    newHeading: z.number(),
    timestamp: z.number(),
  }),
});

export const CameraUpdatedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.CAMERA_UPDATED),
  payload: PlayerCameraSchema,
});

export const WeaponFiredMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.WEAPON_FIRED),
  payload: z.object({
    sourceShipId: z.string(),
    targetShipId: z.string(),
    weaponId: z.string(),
    mountId: z.string(),
    timestamp: z.number(),
  }),
});

export const DamageDealtMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.DAMAGE_DEALT),
  payload: z.object({
    hit: z.boolean(),
    damage: z.number().min(0).optional(),
    shieldAbsorbed: z.number().min(0),
    armorReduced: z.number().min(0),
    hullDamage: z.number().min(0),
    hitQuadrant: ArmorQuadrantSchema.optional(),
    softFluxGenerated: z.number().min(0),
    hardFluxGenerated: z.number().min(0),
    sourceShipId: z.string(),
    targetShipId: z.string(),
    timestamp: z.number(),
  }),
});

const DrawingElementSchema = z.object({
  type: z.enum(['path', 'line', 'arrow', 'rect', 'circle']),
  color: z.string(),
  lineWidth: z.number(),
  path: z.string().optional(),
  x1: z.number().optional(),
  y1: z.number().optional(),
  x2: z.number().optional(),
  y2: z.number().optional(),
  cx: z.number().optional(),
  cy: z.number().optional(),
  radius: z.number().optional(),
});

export const DrawingAddMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.DRAWING_ADD),
  payload: z.object({
    playerId: z.string(),
    element: DrawingElementSchema,
  }),
});

export const DrawingClearMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.DRAWING_CLEAR),
  payload: z.object({
    playerId: z.string(),
  }),
});

export const DrawingSyncMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.DRAWING_SYNC),
  payload: z.object({
    elements: z.array(DrawingElementSchema),
  }),
});

export const ChatMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.CHAT_MESSAGE),
  payload: z.object({
    senderId: z.string(),
    senderName: z.string(),
    content: z.string(),
    timestamp: z.number(),
  }),
});

export const ErrorMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.ERROR),
  payload: ErrorPayloadSchema,
});

export const PingMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.PING),
  payload: z.object({
    timestamp: z.number(),
  }),
});

export const PongMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.PONG),
  payload: z.object({
    timestamp: z.number(),
  }),
});

const RoomPlayerSnapshotSchema = z.object({
  id: z.string(),
  name: z.string(),
  isReady: z.boolean(),
  currentShipId: z.string().nullable(),
});

export const RoomUpdateMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.ROOM_UPDATE),
  payload: z.object({
    roomId: z.string(),
    players: z.array(RoomPlayerSnapshotSchema),
  }),
});

// DM 模式消息
export const DMToggleMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.DM_TOGGLE),
  payload: z.object({
    playerId: z.string(),
    playerName: z.string(),
    enable: z.boolean(),
    timestamp: z.number(),
  }),
});

export const DMStatusUpdateMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.DM_STATUS_UPDATE),
  payload: z.object({
    players: z.array(z.object({
      id: z.string(),
      name: z.string(),
      isDMMode: z.boolean(),
    })),
  }),
});

// 选择系统消息
export const ObjectSelectedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.OBJECT_SELECTED),
  payload: z.object({
    playerId: z.string(),
    playerName: z.string(),
    tokenId: z.string(),
    timestamp: z.number(),
    forceOverride: z.boolean().optional(),
  }),
});

export const ObjectDeselectedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.OBJECT_DESELECTED),
  payload: z.object({
    playerId: z.string(),
    tokenId: z.string(),
    timestamp: z.number(),
    reason: z.enum(['manual', 'override', 'released']).optional(),
  }),
});

export const SelectionUpdateMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.SELECTION_UPDATE),
  payload: z.object({
    selections: z.array(z.object({
      tokenId: z.string(),
      selectedBy: z.object({
        id: z.string(),
        name: z.string(),
        isDMMode: z.boolean(),
      }).nullable(),
      timestamp: z.number(),
    })),
  }),
});

// Token 拖拽消息
export const TokenDragStartMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TOKEN_DRAG_START),
  payload: z.object({
    tokenId: z.string(),
    playerId: z.string(),
    playerName: z.string(),
    position: PointSchema,
    heading: z.number(),
    timestamp: z.number(),
  }),
});

export const TokenDraggingMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TOKEN_DRAGGING),
  payload: z.object({
    tokenId: z.string(),
    playerId: z.string(),
    playerName: z.string(),
    position: PointSchema,
    heading: z.number(),
    timestamp: z.number(),
    isDragging: z.boolean(),
  }),
});

export const TokenDragEndMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TOKEN_DRAG_END),
  payload: z.object({
    tokenId: z.string(),
    playerId: z.string(),
    finalPosition: PointSchema,
    finalHeading: z.number(),
    timestamp: z.number(),
    committed: z.boolean(),
  }),
});

// ==================== 回合系统消息 Schema ====================
const TurnUnitMessageSchema = z.object({
  id: z.string(),
  name: z.string(),
  ownerId: z.string(),
  ownerName: z.string(),
  unitType: z.enum(['ship', 'station', 'npc']),
  state: z.enum(['waiting', 'active', 'moved', 'acted', 'ended']),
  initiative: z.number(),
});

export const TurnOrderInitializedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TURN_ORDER_INITIALIZED),
  payload: z.object({
    units: z.array(TurnUnitMessageSchema),
    roundNumber: z.number(),
    phase: z.enum(['planning', 'movement', 'action', 'resolution']),
  }),
});

export const TurnOrderUpdatedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TURN_ORDER_UPDATED),
  payload: z.object({
    units: z.array(TurnUnitMessageSchema),
    roundNumber: z.number(),
    phase: z.enum(['planning', 'movement', 'action', 'resolution']),
  }),
});

export const TurnIndexChangedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.TURN_INDEX_CHANGED),
  payload: z.object({
    currentIndex: z.number(),
    previousIndex: z.number(),
    roundNumber: z.number(),
  }),
});

export const UnitStateChangedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.UNIT_STATE_CHANGED),
  payload: z.object({
    unitId: z.string(),
    state: z.enum(['waiting', 'active', 'moved', 'acted', 'ended']),
  }),
});

export const RoundIncrementedMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.ROUND_INCREMENTED),
  payload: z.object({
    roundNumber: z.number(),
  }),
});

// ==================== 请求 - 响应消息 Schema ====================
export const RequestOperationSchema = z.enum([
  'player.join',
  'player.leave',
  'player.list',
  'room.list',
  'room.create',
  'ship.move',
  'ship.toggleShield',
  'ship.vent',
  'ship.getStatus',
  'dm.toggle',
  'camera.update',
]);

export type RequestOperation = z.infer<typeof RequestOperationSchema>;

// 请求负载 Schema
export const PlayerJoinRequestSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(32),
  roomId: z.string().optional(),
});

export const PlayerLeaveRequestSchema = z.object({
  playerId: z.string(),
  roomId: z.string(),
});

export const PlayerListRequestSchema = z.object({
  roomId: z.string(),
});

export const RoomListRequestSchema = z.object({});

export const RoomCreateRequestSchema = z.object({
  roomId: z.string(),
  maxPlayers: z.number().optional(),
});

export const ShipMoveRequestSchema = z.object({
  shipId: z.string(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  type: z.enum(['straight', 'strafe', 'rotate']),
  distance: z.number().optional(),
  angle: z.number().optional(),
});

export const ShipToggleShieldRequestSchema = z.object({
  shipId: z.string(),
});

export const ShipVentRequestSchema = z.object({
  shipId: z.string(),
});

export const ShipGetStatusRequestSchema = z.object({
  shipId: z.string(),
});

export const DMToggleRequestSchema = z.object({
  enable: z.boolean(),
});

export const CameraUpdateRequestSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

// 请求负载联合 Schema
export const RequestPayloadSchema = z.discriminatedUnion('operation', [
  z.object({ operation: z.literal('player.join'), data: PlayerJoinRequestSchema }),
  z.object({ operation: z.literal('player.leave'), data: PlayerLeaveRequestSchema }),
  z.object({ operation: z.literal('player.list'), data: PlayerListRequestSchema }),
  z.object({ operation: z.literal('room.list'), data: RoomListRequestSchema }),
  z.object({ operation: z.literal('room.create'), data: RoomCreateRequestSchema }),
  z.object({ operation: z.literal('ship.move'), data: ShipMoveRequestSchema }),
  z.object({ operation: z.literal('ship.toggleShield'), data: ShipToggleShieldRequestSchema }),
  z.object({ operation: z.literal('ship.vent'), data: ShipVentRequestSchema }),
  z.object({ operation: z.literal('ship.getStatus'), data: ShipGetStatusRequestSchema }),
  z.object({ operation: z.literal('dm.toggle'), data: DMToggleRequestSchema }),
  z.object({ operation: z.literal('camera.update'), data: CameraUpdateRequestSchema }),
]);

export type RequestPayload = z.infer<typeof RequestPayloadSchema>;

// 响应负载 Schema
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
  operation: RequestOperationSchema,
  data: z.unknown(),
  timestamp: z.number(),
});

export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  operation: RequestOperationSchema,
  error: ErrorPayloadSchema,
  timestamp: z.number(),
});

export const ResponsePayloadSchema = z.discriminatedUnion('success', [
  SuccessResponseSchema,
  ErrorResponseSchema,
]);

// 请求消息
export const RequestMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.REQUEST),
  payload: z.object({
    requestId: z.string(),
  }).and(RequestPayloadSchema),
});

// 响应消息
export const ResponseMessageSchema = z.object({
  type: z.literal(WS_MESSAGE_TYPES.RESPONSE),
  payload: z.object({
    requestId: z.string(),
  }).and(ResponsePayloadSchema),
});

// ==================== 类型推导 ====================
export type PlayerJoinedMessage = z.infer<typeof PlayerJoinedMessageSchema>;
export type PlayerLeftMessage = z.infer<typeof PlayerLeftMessageSchema>;
export type ShipMovedMessage = z.infer<typeof ShipMovedMessageSchema>;
export type ShipStatusUpdateMessage = z.infer<typeof ShipStatusUpdateMessageSchema>;
export type ExplosionMessage = z.infer<typeof ExplosionMessageSchema>;
export type ShieldUpdateMessage = z.infer<typeof ShieldUpdateMessageSchema>;
export type FluxStateMessage = z.infer<typeof FluxStateMessageSchema>;
export type CombatEventMessage = z.infer<typeof CombatEventMessageSchema>;
export type MapInitializedMessage = z.infer<typeof MapInitializedMessageSchema>;
export type TokenPlacedMessage = z.infer<typeof TokenPlacedMessageSchema>;
export type TokenMovedMessage = z.infer<typeof TokenMovedMessageSchema>;
export type CameraUpdatedMessage = z.infer<typeof CameraUpdatedMessageSchema>;
export type WeaponFiredMessage = z.infer<typeof WeaponFiredMessageSchema>;
export type DamageDealtMessage = z.infer<typeof DamageDealtMessageSchema>;
export type DrawingAddMessage = z.infer<typeof DrawingAddMessageSchema>;
export type DrawingClearMessage = z.infer<typeof DrawingClearMessageSchema>;
export type DrawingSyncMessage = z.infer<typeof DrawingSyncMessageSchema>;
export type ChatMessagePayload = z.infer<typeof ChatMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type PingMessage = z.infer<typeof PingMessageSchema>;
export type PongMessage = z.infer<typeof PongMessageSchema>;
export type RoomUpdateMessage = z.infer<typeof RoomUpdateMessageSchema>;
export type DMToggleMessage = z.infer<typeof DMToggleMessageSchema>;
export type DMStatusUpdateMessage = z.infer<typeof DMStatusUpdateMessageSchema>;
export type ObjectSelectedMessage = z.infer<typeof ObjectSelectedMessageSchema>;
export type ObjectDeselectedMessage = z.infer<typeof ObjectDeselectedMessageSchema>;
export type SelectionUpdateMessage = z.infer<typeof SelectionUpdateMessageSchema>;
export type TokenDragStartMessage = z.infer<typeof TokenDragStartMessageSchema>;
export type TokenDraggingMessage = z.infer<typeof TokenDraggingMessageSchema>;
export type TokenDragEndMessage = z.infer<typeof TokenDragEndMessageSchema>;
export type TurnOrderInitializedMessage = z.infer<typeof TurnOrderInitializedMessageSchema>;
export type TurnOrderUpdatedMessage = z.infer<typeof TurnOrderUpdatedMessageSchema>;
export type TurnIndexChangedMessage = z.infer<typeof TurnIndexChangedMessageSchema>;
export type UnitStateChangedMessage = z.infer<typeof UnitStateChangedMessageSchema>;
export type RoundIncrementedMessage = z.infer<typeof RoundIncrementedMessageSchema>;
export type RequestMessage = z.infer<typeof RequestMessageSchema>;
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

// 响应数据类型
export type RoomPlayerSnapshot = z.infer<typeof RoomPlayerSnapshotSchema>;
export type DrawingElement = z.infer<typeof DrawingElementSchema>;

// 请求负载类型别名
export type PlayerJoinRequestPayload = z.infer<typeof PlayerJoinRequestSchema>;
export type PlayerLeaveRequestPayload = z.infer<typeof PlayerLeaveRequestSchema>;
export type PlayerListRequestPayload = z.infer<typeof PlayerListRequestSchema>;
export type RoomListRequestPayload = z.infer<typeof RoomListRequestSchema>;
export type RoomCreateRequestPayload = z.infer<typeof RoomCreateRequestSchema>;
export type ShipMoveRequestPayload = z.infer<typeof ShipMoveRequestSchema>;
export type ShipToggleShieldRequestPayload = z.infer<typeof ShipToggleShieldRequestSchema>;
export type ShipVentRequestPayload = z.infer<typeof ShipVentRequestSchema>;
export type ShipGetStatusRequestPayload = z.infer<typeof ShipGetStatusRequestSchema>;
export type DMToggleRequestPayload = z.infer<typeof DMToggleRequestSchema>;
export type CameraUpdateRequestPayload = z.infer<typeof CameraUpdateRequestSchema>;

// 响应负载类型
export type PlayerJoinResponsePayload = PlayerInfo;
export type PlayerLeaveResponsePayload = void;
export type PlayerListResponsePayload = PlayerInfo[];
export type RoomListResponsePayload = {
  rooms: Array<{ roomId: string; playerCount: number; maxPlayers: number; createdAt: number }>;
};
export type RoomCreateResponsePayload = { roomId: string };
export type ShipMoveResponsePayload = ShipStatus | null;
export type ShipToggleShieldResponsePayload = ShipStatus | null;
export type ShipVentResponsePayload = ShipStatus | null;
export type ShipGetStatusResponsePayload = ShipStatus | null;
export type DMToggleResponsePayload = PlayerInfo;
export type CameraUpdateResponsePayload = void;

// 响应数据联合类型
export type ResponseData =
  | { operation: 'player.join'; data: PlayerJoinResponsePayload }
  | { operation: 'player.leave'; data: PlayerLeaveResponsePayload }
  | { operation: 'player.list'; data: PlayerListResponsePayload }
  | { operation: 'room.list'; data: RoomListResponsePayload }
  | { operation: 'room.create'; data: RoomCreateResponsePayload }
  | { operation: 'ship.move'; data: ShipMoveResponsePayload }
  | { operation: 'ship.toggleShield'; data: ShipToggleShieldResponsePayload }
  | { operation: 'ship.vent'; data: ShipVentResponsePayload }
  | { operation: 'ship.getStatus'; data: ShipGetStatusResponsePayload }
  | { operation: 'dm.toggle'; data: DMToggleResponsePayload }
  | { operation: 'camera.update'; data: CameraUpdateResponsePayload };

export type ResponsePayload<T extends RequestOperation = RequestOperation> =
  | z.infer<typeof SuccessResponseSchema> & { operation: T }
  | z.infer<typeof ErrorResponseSchema>;

export type SuccessResponse<T extends RequestOperation = RequestOperation> = Extract<
  ResponsePayload<T>,
  { success: true }
>;

export type ErrorResponse = Extract<ResponsePayload, { success: false }>;

// 工具类型
export type ResponseForOperation<T extends RequestOperation> = Extract<
  ResponseData,
  { operation: T }
>['data'];

export type OperationHandler<O extends RequestOperation> = (
  clientId: string,
  data: Extract<RequestPayload, { operation: O }>['data']
) => Promise<ResponseForOperation<O>>;

export type RequestHandlers = {
  [O in RequestOperation]?: OperationHandler<O>;
};

// ==================== 消息联合类型 ====================
export type WSMessage =
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ShipMovedMessage
  | ShipStatusUpdateMessage
  | ExplosionMessage
  | ShieldUpdateMessage
  | FluxStateMessage
  | CombatEventMessage
  | MapInitializedMessage
  | TokenPlacedMessage
  | TokenMovedMessage
  | CameraUpdatedMessage
  | WeaponFiredMessage
  | DamageDealtMessage
  | DrawingAddMessage
  | DrawingClearMessage
  | DrawingSyncMessage
  | ChatMessagePayload
  | ErrorMessage
  | PingMessage
  | PongMessage
  | RoomUpdateMessage
  | DMToggleMessage
  | DMStatusUpdateMessage
  | ObjectSelectedMessage
  | ObjectDeselectedMessage
  | SelectionUpdateMessage
  | TokenDragStartMessage
  | TokenDraggingMessage
  | TokenDragEndMessage
  | TurnOrderInitializedMessage
  | TurnOrderUpdatedMessage
  | TurnIndexChangedMessage
  | UnitStateChangedMessage
  | RoundIncrementedMessage
  | RequestMessage
  | ResponseMessage;

// ==================== 工具类型 ====================
// 使用映射类型从消息类型推导 payload 类型
type ExtractPayload<T> = T extends { payload: infer P } ? P : never;

export type WSMessagePayloadMap = {
  [K in WSMessageType]: ExtractPayload<Extract<WSMessage, { type: K }>>;
};

export type WSMessageOf<T extends WSMessageType> = Extract<WSMessage, { type: T }>;

// ==================== 接口定义 ====================
export interface IWSServer {
  broadcast(message: WSMessage, excludeClientId?: string): void;
  sendTo(clientId: string, message: WSMessage): void;
  getConnectedClients(): Set<string>;
  close(): void;
}

export interface IWSClient {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: WSMessage): void;
  on<T extends WSMessageType>(
    type: T,
    handler: (payload: WSMessagePayloadMap[T]) => void
  ): void;
  off<T extends WSMessageType>(
    type: T,
    handler?: (payload: WSMessagePayloadMap[T]) => void
  ): void;
  isConnected(): boolean;
}

// ==================== 类型守卫函数 ====================
export function isRequestMessage(msg: WSMessage): msg is RequestMessage {
  return msg.type === WS_MESSAGE_TYPES.REQUEST;
}

export function isResponseMessage(msg: WSMessage): msg is ResponseMessage {
  return msg.type === WS_MESSAGE_TYPES.RESPONSE;
}

export function isSuccessResponse<T extends RequestOperation>(
  response: ResponsePayload<T>
): response is SuccessResponse<T> {
  return response.success === true;
}

export function isErrorResponse<T extends RequestOperation>(
  response: ResponsePayload<T>
): response is ErrorResponse {
  return response.success === false;
}

// 为常用消息类型创建类型守卫
type MessageGuard<T extends WSMessage> = (msg: WSMessage) => msg is T;

export function createMessageGuard<T extends WSMessage>(type: T['type']): MessageGuard<T> {
  return (msg: WSMessage): msg is T => msg.type === type;
}

// 导出常用类型守卫
export const isPlayerJoinedMessage = createMessageGuard<PlayerJoinedMessage>(WS_MESSAGE_TYPES.PLAYER_JOINED);
export const isShipMovedMessage = createMessageGuard<ShipMovedMessage>(WS_MESSAGE_TYPES.SHIP_MOVED);
export const isCameraUpdatedMessage = createMessageGuard<CameraUpdatedMessage>(WS_MESSAGE_TYPES.CAMERA_UPDATED);
