/**
 * 共享包主导出文件
 *
 * 新架构：
 * - room/     声明式房间框架（核心）
 * - types/    领域类型定义
 * - config/   数据驱动配置
 * - events/   事件总线
 */

// ==================== 房间框架（核心） ====================
export * from './room/index.js';

// ==================== 领域类型 ====================
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
  // 房间系统（旧版，保留兼容）
  RoomPhase as LegacyRoomPhase,
  RoomInfo as LegacyRoomInfo,
  RoomState as LegacyRoomState,
} from './types/index.js';

// 导出结果类型工具函数
export { ok, fail } from './types/index.js';

// ==================== 配置系统 ====================
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

// ==================== Zod Schemas ====================
export * from './schemas/index.js';

// ==================== 常量 ====================
export * from './constants/index.js';

// ==================== 事件总线 ====================
export {
  EventBus,
  createDomainEvent,
  publishEvent,
} from './events/index.js';

export type {
  EventHandler,
  Unsubscribe,
  IEventBus,
  EventContext,
} from './events/index.js';

// ==================== 协议类型 ====================
export type {
  TurnPhase,
  GamePhase,
  ShipActionState,
  AttackPreviewResult,
  CombatResultPayload,
  AttackResult,
  WeaponSelected,
  TargetSelected,
  QuadrantSelected,
  DomainEvent,
  DomainEventType,
  DomainEventPayloadMap,
} from './protocol/index.js';

export { createDomainEvent as createDomainEventFromProtocol } from './protocol/index.js';

// ==================== WS 消息类型 ====================
export {
  WS_MESSAGE_TYPES,
} from './ws/index.js';

export type {
  WSMessageType,
  WSMessage,
} from './ws/index.js';

// ==================== 协议版本 ====================
export { PROTOCOL_VERSION } from './core-types.js';