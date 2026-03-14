// 共享包主导出文件
// 为避免类型冲突，使用明确导出而不是通配符导出

// 导出常量
export * from "./constants";

// 导出模式验证
export * from "./schemas";

// 导出tRPC类型（不包含WebSocket类型）
export type {
  AppRouter,
  PlayerJoinInput,
  PlayerLeaveInput,
  PlayerListInput,
  ShipMoveInput,
  ShipToggleShieldInput,
  ShipVentInput,
  ShipGetStatusInput,
  InferRouterInput,
  InferRouterOutput,
  InferProcedureInput,
  InferProcedureOutput,
} from "./trpc";

// 导出核心类型定义
export type {
  PlayerInfo,
  ShipStatus,
  ArmorQuadrant,
  ArmorState,
  FluxState,
  FluxOverloadState,
  ShieldSpec,
  WeaponType,
  WeaponMountType,
  WeaponSpec,
  WeaponMount,
  ShipMovement,
  ExplosionData,
  AttackCommand,
  CombatResult,
  MapConfig,
  TokenInfo,
  CameraState,
} from "./types";

// 导出WebSocket类型（权威定义）
export {
  WS_MESSAGE_TYPES,
  type WSMessage,
  type WSMessageType,
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
  type IWSServer,
  type IWSClient,
} from "./ws";
