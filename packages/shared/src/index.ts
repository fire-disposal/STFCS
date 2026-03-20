/**
 * 共享包主导出文件
 *
 * 使用明确导出而不是通配符导出，避免类型冲突
 */

// 导出常量和配置
export * from './constants/index.js';

// 导出数据驱动配置模块（排除与协议冲突的导出）
export {
  // schemas
  DamageTypeSchema,
  WeaponCategorySchema,
  MountTypeSchema,
  ShieldTypeSchema,
  HullSizeSchema,
  ArmorQuadrantConfigSchema,
  WeaponDefinitionSchema,
  ShieldConfigSchema,
  FluxConfigSchema,
  ArmorConfigSchema,
  HullDefinitionSchema,
  ShipDefinitionSchema,
  AssetManifestSchema,
  // types
  type DamageModifiers,
  type WeaponSlotSize,
  type CreateShipInstanceParams,
  type ShipInstanceState,
  type IConfigLoader,
  type ConfigValidationResult,
  type ConfigValidationError,
  type AssetRef,
  DAMAGE_MODIFIERS,
  WEAPON_SIZE_COMPATIBILITY,
  DEFAULT_SHIP_STATS,
  DEFAULT_WEAPON_STATS,
  DEFAULT_FLUX_STATS,
  // validation
  validateWeaponDefinition,
  validateHullDefinition,
  validateShipDefinition,
} from './config/index.js';

// 导出配置类型
export type {
  DamageType,
  WeaponCategory,
  MountType,
  ShieldType,
  HullSize,
  WeaponDefinition,
  HullDefinition,
  ShipDefinition,
  ShieldConfig,
  FluxConfig,
  ArmorConfig,
  AssetManifest,
} from './config/schemas.js';

// 导出 Zod schemas
export * from './schemas/index.js';

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
  StarNode,
  PlanetNode,
  StarSystem,
  StarMap,
  MapSnapshot,
  // 相机
  CameraState,
  PlayerCamera,
  CameraUpdateCommand,
  CameraConfig,
  // 阵营系统
  FactionId,
  FactionDefinition,
  PlayerFactionInfo,
  FactionTurnPhase,
  TurnHistoryEntry,
  FactionTurnState,
  FactionTurnInitParams,
  // 房间系统
  RoomPhase,
  RoomInfo,
  RoomState,
} from './types/index.js';

// 导出结果类型工具函数
export { ok, fail } from './types/index.js';

// 导出协议层（统一消息协议 DSL 和领域事件）
export * from './protocol/index.js';

// 导出协议版本
export { PROTOCOL_VERSION } from './core-types.js';

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
  // 阵营回合系统
  type FactionSelectedMessage,
  type FactionTurnStartMessage,
  type FactionTurnEndMessage,
  type PlayerEndTurnMessage,
  type PlayerCancelEndTurnMessage,
  type RoundStartMessage,
  type FactionOrderDeterminedMessage,
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
  type MapSnapshotGetRequestPayload,
  type MapSnapshotSaveRequestPayload,
  type MapTokenMoveRequestPayload,
  type RoomStateGetRequestPayload,
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
  type MapSnapshotGetResponsePayload,
  type MapSnapshotSaveResponsePayload,
  type MapTokenMoveResponsePayload,
  type RoomStateGetResponsePayload,
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
} from './ws/index.js';

// 导出领域事件总线（重新导出，保持向后兼容）
export {
  EventBus,
  DefaultEventTranslator,
  createDomainEvent,
  publishEvent,
} from './events/index.js';

export type {
  EventHandler,
  Unsubscribe,
  EventTranslator,
  IEventBus,
  EventContext,
} from './events/index.js';
