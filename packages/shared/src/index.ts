/**
 * 共享包主导出文件
 *
 * 使用明确导出而不是通配符导出，避免类型冲突
 */

// 导出常量和配置
export * from './constants';

// 导出 Zod schemas
export * from './schemas';

// 导出核心类型定义
export type {
  // 基础类型
  Point,
  // 玩家相关
  PlayerInfo,
  PlayerGameState,
  // 舰船相关
  ShipStatus,
  ArmorQuadrant,
  ArmorState,
  FluxState,
  FluxType,
  FluxOverloadState,
  ShieldSpec,
  ShipMovement,
  // 武器相关
  WeaponType,
  WeaponMountType,
  WeaponSpec,
  WeaponMount,
  // 战斗相关
  ExplosionData,
  AttackCommand,
  CombatResult,
  // 地图与 Token
  MapConfig,
  TokenInfo,
  TokenType,
  UnitTurnState,
  // 相机
  CameraState,
  PlayerCamera,
  CameraUpdateCommand,
  CameraConfig,
  // 回合系统
  TurnPhase,
  TurnUnit,
  TurnOrder,
  TurnState,
} from './types';

// 导出结果类型工具函数
export { ok, fail } from './types';

// 导出协议版本
export { PROTOCOL_VERSION } from './core-types';

// 导出 WebSocket 消息类型和工具
export {
  WS_MESSAGE_TYPES,
  type WSMessage,
  type WSMessageType,
  type WSMessagePayloadMap,
  type WSMessageOf,
  // 事件消息
  type PlayerJoinedMessage,
  type PlayerLeftMessage,
  type ShipMovedMessage,
  type ShipStatusUpdateMessage,
  type ExplosionMessage,
  type ShieldUpdateMessage,
  type FluxStateMessage,
  type CombatEventMessage,
  type MapInitializedMessage,
  type TokenPlacedMessage,
  type TokenMovedMessage,
  type CameraUpdatedMessage,
  type WeaponFiredMessage,
  type DamageDealtMessage,
  type DrawingAddMessage,
  type DrawingClearMessage,
  type DrawingSyncMessage,
  type ChatMessagePayload,
  type ErrorMessage,
  type PingMessage,
  type PongMessage,
  type RoomUpdateMessage,
  type RoomPlayerSnapshot,
  // DM 模式
  type DMToggleMessage,
  type DMStatusUpdateMessage,
  // 选择系统
  type ObjectSelectedMessage,
  type ObjectDeselectedMessage,
  type SelectionUpdateMessage,
  // Token 拖拽
  type TokenDragStartMessage,
  type TokenDraggingMessage,
  type TokenDragEndMessage,
  // 回合系统
  type TurnOrderInitializedMessage,
  type TurnOrderUpdatedMessage,
  type TurnIndexChangedMessage,
  type UnitStateChangedMessage,
  type RoundIncrementedMessage,
  // 请求 - 响应
  type RequestMessage,
  type ResponseMessage,
  type RequestPayload,
  type RequestOperation,
  type ResponseData,
  type ResponseForOperation,
  type OperationHandler,
  type RequestHandlers,
  type SuccessResponse,
  type ErrorResponse,
  type ResponsePayload,
  // 请求负载类型
  type PlayerJoinRequestPayload,
  type PlayerLeaveRequestPayload,
  type PlayerListRequestPayload,
  type RoomListRequestPayload,
  type RoomCreateRequestPayload,
  type ShipMoveRequestPayload,
  type ShipToggleShieldRequestPayload,
  type ShipVentRequestPayload,
  type ShipGetStatusRequestPayload,
  type DMToggleRequestPayload,
  type CameraUpdateRequestPayload,
  // 响应负载类型
  type PlayerJoinResponsePayload,
  type PlayerLeaveResponsePayload,
  type PlayerListResponsePayload,
  type RoomListResponsePayload,
  type RoomCreateResponsePayload,
  type ShipMoveResponsePayload,
  type ShipToggleShieldResponsePayload,
  type ShipVentResponsePayload,
  type ShipGetStatusResponsePayload,
  type DMToggleResponsePayload,
  type CameraUpdateResponsePayload,
  // 接口
  type IWSServer,
  type IWSClient,
  // 类型守卫
  isRequestMessage,
  isResponseMessage,
  isSuccessResponse,
  isErrorResponse,
  isPlayerJoinedMessage,
  isShipMovedMessage,
  isCameraUpdatedMessage,
} from './ws';

// 导出领域事件总线
export * from './events';
