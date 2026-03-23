/**
 * WebSocket 消息协议定义（简化版）
 *
 * 保留核心 WS 通信基础设施：
 * 1. 消息类型常量
 * 2. 请求 - 响应消息 schema 和类型
 * 3. 接口定义 (IWSServer, IWSClient)
 * 4. 类型守卫函数
 *
 * 事件消息 schema 已迁移到 protocol/DomainEvents.ts
 */

import { z } from 'zod';
// @ts-ignore - 类型在 WSMessage 联合类型中使用
import type {
  PlayerInfo,
  PlayerHangar,
  ShipAssetDefinition,
  ShipStatus,
  ShipMovement,
  PlayerCamera,
  TokenInfo,
  MapConfig,
  ArmorQuadrant,
  MapSnapshot,
} from '../types/index.js';
// @ts-ignore - 类型在 schema 中使用
import type {
  PlayerInfoSchema,
  ShipMovementSchema,
  ShipStatusSchema,
  MapConfigSchema,
  TokenInfoSchema,
  PlayerCameraSchema,
  ArmorQuadrantSchema,
  PointSchema,
} from '../core-types.js';

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

// ==================== 基础 Schema ====================
const ErrorPayloadSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

// ==================== 请求 - 响应消息 Schema（核心业务） ====================
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
  'dm.getStatus',
  'camera.update',
  'map.snapshot.get',
  'map.snapshot.save',
  'map.token.move',
  'map.token.deploy',
  'turn.initialize',
  'turn.advance',
  'turn.setPhase',
  'turn.state.get',
  'ship.assets.list',
  'player.hangar.get',
  'player.hangar.setActiveShip',
  'map.token.move.step',
  'room.state.get',
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
  playerId: z.string(),
});

export const DMGetStatusRequestSchema = z.object({});

export const CameraUpdateRequestSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number(),
});

export const MapSnapshotGetRequestSchema = z.object({
  roomId: z.string().optional(),
});

export const MapSnapshotSaveRequestSchema = z.object({
  roomId: z.string().optional(),
  snapshot: z.unknown(),
});

export const MapTokenMoveRequestSchema = z.object({
  roomId: z.string().optional(),
  tokenId: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  heading: z.number(),
  ownerId: z.string().optional(),
  type: z.enum(['ship', 'station', 'asteroid']).optional(),
  size: z.number().optional(),
});

export const MapTokenDeployRequestSchema = z.object({
  roomId: z.string().optional(),
  tokenId: z.string(),
  ownerId: z.string().optional(),
  position: z.object({ x: z.number(), y: z.number() }),
  heading: z.number().default(0),
  type: z.enum(['ship', 'station', 'asteroid']).optional(),
  size: z.number().optional(),
  shipAssetId: z.string().optional(),
  dockedShipId: z.string().optional(),
  customization: z.record(z.string(), z.unknown()).optional(),
});

export const MapTokenMoveStepRequestSchema = z.object({
  roomId: z.string().optional(),
  tokenId: z.string(),
  stepIndex: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  forward: z.number().optional(),
  strafe: z.number().optional(),
  rotation: z.number().optional(),
});

export const TurnInitializeRequestSchema = z.object({
  roomId: z.string().optional(),
});

export const TurnAdvanceRequestSchema = z.object({
  roomId: z.string().optional(),
});

export const TurnSetPhaseRequestSchema = z.object({
  roomId: z.string().optional(),
  phase: z.enum(['deployment', 'planning', 'movement', 'action', 'resolution']),
});

export const TurnStateGetRequestSchema = z.object({
  roomId: z.string().optional(),
});

export const ShipAssetsListRequestSchema = z.object({});

export const PlayerHangarGetRequestSchema = z.object({
  playerId: z.string().optional(),
});

export const PlayerHangarSetActiveShipRequestSchema = z.object({
  dockedShipId: z.string(),
});

export const RoomStateGetRequestSchema = z.object({
  roomId: z.string().optional(),
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
  z.object({ operation: z.literal('dm.getStatus'), data: DMGetStatusRequestSchema }),
  z.object({ operation: z.literal('camera.update'), data: CameraUpdateRequestSchema }),
  z.object({ operation: z.literal('map.snapshot.get'), data: MapSnapshotGetRequestSchema }),
  z.object({ operation: z.literal('map.snapshot.save'), data: MapSnapshotSaveRequestSchema }),
  z.object({ operation: z.literal('map.token.move'), data: MapTokenMoveRequestSchema }),
  z.object({ operation: z.literal('map.token.deploy'), data: MapTokenDeployRequestSchema }),
  z.object({ operation: z.literal('map.token.move.step'), data: MapTokenMoveStepRequestSchema }),
  z.object({ operation: z.literal('turn.initialize'), data: TurnInitializeRequestSchema }),
  z.object({ operation: z.literal('turn.advance'), data: TurnAdvanceRequestSchema }),
  z.object({ operation: z.literal('turn.setPhase'), data: TurnSetPhaseRequestSchema }),
  z.object({ operation: z.literal('turn.state.get'), data: TurnStateGetRequestSchema }),
  z.object({ operation: z.literal('ship.assets.list'), data: ShipAssetsListRequestSchema }),
  z.object({ operation: z.literal('player.hangar.get'), data: PlayerHangarGetRequestSchema }),
  z.object({ operation: z.literal('player.hangar.setActiveShip'), data: PlayerHangarSetActiveShipRequestSchema }),
  z.object({ operation: z.literal('room.state.get'), data: RoomStateGetRequestSchema }),
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

// ==================== 请求/响应类型 ====================
export type RequestMessage = z.infer<typeof RequestMessageSchema>;
export type ResponseMessage = z.infer<typeof ResponseMessageSchema>;

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
export type DMGetStatusRequestPayload = z.infer<typeof DMGetStatusRequestSchema>;
export type CameraUpdateRequestPayload = z.infer<typeof CameraUpdateRequestSchema>;
export type MapSnapshotGetRequestPayload = z.infer<typeof MapSnapshotGetRequestSchema>;
export type MapSnapshotSaveRequestPayload = z.infer<typeof MapSnapshotSaveRequestSchema>;
export type MapTokenMoveRequestPayload = z.infer<typeof MapTokenMoveRequestSchema>;
export type MapTokenDeployRequestPayload = z.infer<typeof MapTokenDeployRequestSchema>;
export type MapTokenMoveStepRequestPayload = z.infer<typeof MapTokenMoveStepRequestSchema>;
export type TurnInitializeRequestPayload = z.infer<typeof TurnInitializeRequestSchema>;
export type TurnAdvanceRequestPayload = z.infer<typeof TurnAdvanceRequestSchema>;
export type TurnSetPhaseRequestPayload = z.infer<typeof TurnSetPhaseRequestSchema>;
export type TurnStateGetRequestPayload = z.infer<typeof TurnStateGetRequestSchema>;
export type ShipAssetsListRequestPayload = z.infer<typeof ShipAssetsListRequestSchema>;
export type PlayerHangarGetRequestPayload = z.infer<typeof PlayerHangarGetRequestSchema>;
export type PlayerHangarSetActiveShipRequestPayload = z.infer<typeof PlayerHangarSetActiveShipRequestSchema>;
export type RoomStateGetRequestPayload = z.infer<typeof RoomStateGetRequestSchema>;

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
export type DMGetStatusResponsePayload = { isDMMode: boolean; players: Array<{ id: string; name: string; isDMMode: boolean }> };
export type CameraUpdateResponsePayload = void;
export type MapSnapshotGetResponsePayload = { roomId: string; snapshot: MapSnapshot };
export type MapSnapshotSaveResponsePayload = { roomId: string; snapshot: MapSnapshot };
export type MapTokenMoveResponsePayload = { roomId: string; token: TokenInfo };
export type MapTokenDeployResponsePayload = { roomId: string; token: TokenInfo; phase: 'deployment' | 'planning' | 'movement' | 'action' | 'resolution' };
export type MapTokenMoveStepResponsePayload = { roomId: string; token: TokenInfo; appliedStep: { stepIndex: 1 | 2 | 3; forward?: number; strafe?: number; rotation?: number } };
export type TurnStateResponsePayload = { roomId: string; phase: 'deployment' | 'planning' | 'movement' | 'action' | 'resolution'; round: number; order: string[]; currentIndex: number };
export type ShipAssetsListResponsePayload = { assets: ShipAssetDefinition[] };
export type PlayerHangarGetResponsePayload = PlayerHangar;
export type RoomStateGetResponsePayload = {
  roomId: string;
  players: PlayerInfo[];
  dm: { isDMMode: boolean; players: Array<{ id: string; name: string; isDMMode: boolean }> };
  snapshot: MapSnapshot;
  turn: TurnStateResponsePayload;
  hangar: PlayerHangar | null;
};

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
  | { operation: 'dm.getStatus'; data: DMGetStatusResponsePayload }
  | { operation: 'camera.update'; data: CameraUpdateResponsePayload }
  | { operation: 'map.snapshot.get'; data: MapSnapshotGetResponsePayload }
  | { operation: 'map.snapshot.save'; data: MapSnapshotSaveResponsePayload }
  | { operation: 'map.token.move'; data: MapTokenMoveResponsePayload }
  | { operation: 'map.token.deploy'; data: MapTokenDeployResponsePayload }
  | { operation: 'map.token.move.step'; data: MapTokenMoveStepResponsePayload }
  | { operation: 'turn.initialize'; data: TurnStateResponsePayload }
  | { operation: 'turn.advance'; data: TurnStateResponsePayload }
  | { operation: 'turn.setPhase'; data: TurnStateResponsePayload }
  | { operation: 'turn.state.get'; data: TurnStateResponsePayload }
  | { operation: 'ship.assets.list'; data: ShipAssetsListResponsePayload }
  | { operation: 'player.hangar.get'; data: PlayerHangarGetResponsePayload }
  | { operation: 'player.hangar.setActiveShip'; data: PlayerHangarGetResponsePayload }
  | { operation: 'room.state.get'; data: RoomStateGetResponsePayload };

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

// ==================== 事件消息类型（从 DomainEvents 导入） ====================
// 注意：事件消息的完整 schema 定义在 protocol/DomainEvents.ts
// 这里只定义 WS 消息包装类型

/** 绘图元素 Schema（本地使用） */
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

export type DrawingElement = z.infer<typeof DrawingElementSchema>;

// ==================== WS 消息联合类型 ====================
/**
 * WS 消息联合类型
 * 
 * 包含：
 * 1. 请求 - 响应消息（完整定义）
 * 2. 事件消息（简化，使用 payload 类型）
 */
export type WSMessage =
  // 请求 - 响应
  | RequestMessage
  | ResponseMessage
  // 事件消息（简化定义，完整 schema 在 DomainEvents）
  | { type: typeof WS_MESSAGE_TYPES.PLAYER_JOINED; payload: PlayerInfo }
  | { type: typeof WS_MESSAGE_TYPES.PLAYER_LEFT; payload: { playerId: string; reason?: string } }
  | { type: typeof WS_MESSAGE_TYPES.SHIP_MOVED; payload: ShipMovement }
  | { type: typeof WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE; payload: ShipStatus }
  | { type: typeof WS_MESSAGE_TYPES.SHIELD_UPDATE; payload: { shipId: string; active: boolean; type: 'front' | 'full'; coverageAngle: number } }
  | { type: typeof WS_MESSAGE_TYPES.FLUX_STATE; payload: { shipId: string; fluxState: 'normal' | 'venting' | 'overloaded'; currentFlux: number; softFlux: number; hardFlux: number } }
  | { type: typeof WS_MESSAGE_TYPES.CAMERA_UPDATED; payload: PlayerCamera }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_MOVED; payload: { tokenId: string; previousPosition: { x: number; y: number }; newPosition: { x: number; y: number }; previousHeading: number; newHeading: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_PLACED; payload: TokenInfo }
  | { type: typeof WS_MESSAGE_TYPES.MAP_INITIALIZED; payload: MapConfig & { tokens: TokenInfo[] } }
  | { type: typeof WS_MESSAGE_TYPES.OBJECT_SELECTED; payload: { playerId: string; playerName: string; tokenId: string; timestamp: number; forceOverride?: boolean } }
  | { type: typeof WS_MESSAGE_TYPES.OBJECT_DESELECTED; payload: { playerId: string; tokenId: string; timestamp: number; reason?: 'manual' | 'override' | 'released' } }
  | { type: typeof WS_MESSAGE_TYPES.SELECTION_UPDATE; payload: { selections: Array<{ tokenId: string; selectedBy: { id: string; name: string; isDMMode: boolean } | null; timestamp: number }> } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_START; payload: { tokenId: string; playerId: string; playerName: string; position: { x: number; y: number }; heading: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAGGING; payload: { tokenId: string; playerId: string; playerName: string; position: { x: number; y: number }; heading: number; timestamp: number; isDragging: boolean } }
  | { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_END; payload: { tokenId: string; playerId: string; finalPosition: { x: number; y: number }; finalHeading: number; timestamp: number; committed: boolean } }
  | { type: typeof WS_MESSAGE_TYPES.DM_STATUS_UPDATE; payload: { players: Array<{ id: string; name: string; isDMMode: boolean }> } }
  | { type: typeof WS_MESSAGE_TYPES.DM_TOGGLE; payload: { playerId: string; playerName: string; enable: boolean; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.TURN_ORDER_INITIALIZED; payload: { units: Array<{ id: string; name: string; ownerId: string; ownerName: string; unitType: 'ship' | 'station' | 'npc'; state: 'waiting' | 'active' | 'moved' | 'acted' | 'ended'; initiative: number }>; roundNumber: number; phase: 'deployment' | 'planning' | 'movement' | 'action' | 'resolution' } }
  | { type: typeof WS_MESSAGE_TYPES.TURN_ORDER_UPDATED; payload: { units: Array<{ id: string; name: string; ownerId: string; ownerName: string; unitType: 'ship' | 'station' | 'npc'; state: 'waiting' | 'active' | 'moved' | 'acted' | 'ended'; initiative: number }>; roundNumber: number; phase: 'deployment' | 'planning' | 'movement' | 'action' | 'resolution' } }
  | { type: typeof WS_MESSAGE_TYPES.TURN_INDEX_CHANGED; payload: { currentIndex: number; previousIndex: number; roundNumber: number } }
  | { type: typeof WS_MESSAGE_TYPES.UNIT_STATE_CHANGED; payload: { unitId: string; state: 'waiting' | 'active' | 'moved' | 'acted' | 'ended' } }
  | { type: typeof WS_MESSAGE_TYPES.ROUND_INCREMENTED; payload: { roundNumber: number } }
  | { type: typeof WS_MESSAGE_TYPES.WEAPON_FIRED; payload: { sourceShipId: string; targetShipId: string; weaponId: string; mountId: string; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.DAMAGE_DEALT; payload: { sourceShipId: string; targetShipId: string; hit: boolean; damage?: number; shieldAbsorbed: number; armorReduced: number; hullDamage: number; hitQuadrant?: ArmorQuadrant; softFluxGenerated: number; hardFluxGenerated: number; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.EXPLOSION; payload: { id: string; position: { x: number; y: number }; radius: number; damage: number; sourceShipId?: string; targetShipId?: string; hitQuadrant?: ArmorQuadrant; timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.COMBAT_EVENT; payload: { sourceShipId: string; targetShipId: string; weaponId: string; hit: boolean; damage?: number; hitQuadrant?: ArmorQuadrant; timestamp: number } }
  // 绘图消息
  | { type: typeof WS_MESSAGE_TYPES.DRAWING_ADD; payload: { playerId: string; element: DrawingElement } }
  | { type: typeof WS_MESSAGE_TYPES.DRAWING_CLEAR; payload: { playerId: string } }
  | { type: typeof WS_MESSAGE_TYPES.DRAWING_SYNC; payload: { elements: DrawingElement[] } }
  // 聊天消息
  | { type: typeof WS_MESSAGE_TYPES.CHAT_MESSAGE; payload: { senderId: string; senderName: string; content: string; timestamp: number } }
  // 错误消息
  | { type: typeof WS_MESSAGE_TYPES.ERROR; payload: { code: string; message: string; details?: Record<string, unknown> } }
  // 连接控制消息
  | { type: typeof WS_MESSAGE_TYPES.PING; payload: { timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.PONG; payload: { timestamp: number } }
  | { type: typeof WS_MESSAGE_TYPES.ROOM_UPDATE; payload: { roomId: string; players: Array<{ id: string; name: string; isReady: boolean; currentShipId: string | null }> } };

// ==================== 工具类型 ====================
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
export const isPlayerJoinedMessage = createMessageGuard<Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_JOINED }>>(WS_MESSAGE_TYPES.PLAYER_JOINED);
export const isShipMovedMessage = createMessageGuard<Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_MOVED }>>(WS_MESSAGE_TYPES.SHIP_MOVED);
export const isCameraUpdatedMessage = createMessageGuard<Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.CAMERA_UPDATED }>>(WS_MESSAGE_TYPES.CAMERA_UPDATED);

// ==================== 向后兼容的类型别名 ====================
// 注意：这些类型别名用于向后兼容，新代码应直接使用 WSMessage 联合类型

export type PlayerJoinedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_JOINED }>;
export type PlayerLeftMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PLAYER_LEFT }>;
export type ShipMovedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_MOVED }>;
export type ShipStatusUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE }>;
export type ExplosionMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.EXPLOSION }>;
export type ShieldUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SHIELD_UPDATE }>;
export type FluxStateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.FLUX_STATE }>;
export type CombatEventMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.COMBAT_EVENT }>;
export type MapInitializedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.MAP_INITIALIZED }>;
export type TokenPlacedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_PLACED }>;
export type TokenMovedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_MOVED }>;
export type CameraUpdatedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.CAMERA_UPDATED }>;
export type WeaponFiredMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.WEAPON_FIRED }>;
export type DamageDealtMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DAMAGE_DEALT }>;
export type DrawingAddMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DRAWING_ADD }>;
export type DrawingClearMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DRAWING_CLEAR }>;
export type DrawingSyncMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DRAWING_SYNC }>;
export type ChatMessagePayload = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.CHAT_MESSAGE }>;
export type ErrorMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ERROR }>;
export type PingMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PING }>;
export type PongMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.PONG }>;
export type RoomUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ROOM_UPDATE }>;
export type RoomPlayerSnapshot = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ROOM_UPDATE }>['payload']['players'][number];
export type DMToggleMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DM_TOGGLE }>;
export type DMStatusUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.DM_STATUS_UPDATE }>;
export type ObjectSelectedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.OBJECT_SELECTED }>;
export type ObjectDeselectedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.OBJECT_DESELECTED }>;
export type SelectionUpdateMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.SELECTION_UPDATE }>;
export type TokenDragStartMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_START }>;
export type TokenDraggingMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAGGING }>;
export type TokenDragEndMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TOKEN_DRAG_END }>;
export type TurnOrderInitializedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TURN_ORDER_INITIALIZED }>;
export type TurnOrderUpdatedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TURN_ORDER_UPDATED }>;
export type TurnIndexChangedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.TURN_INDEX_CHANGED }>;
export type UnitStateChangedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.UNIT_STATE_CHANGED }>;
export type RoundIncrementedMessage = Extract<WSMessage, { type: typeof WS_MESSAGE_TYPES.ROUND_INCREMENTED }>;
