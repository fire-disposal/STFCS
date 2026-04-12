/**
 * 核心类型导出
 *
 * 所有类型从 core-types.ts 统一导出，此处仅重新导出
 */

export type {
  // 基础类型
  Point,
  // 玩家相关
  PlayerInfo,
  PlayerGameState,
  // 舰船相关
  ArmorQuadrant,
  ArmorState,
  FluxType,
  FluxState,
  FluxOverloadState,
  ShieldSpec,
  ShipStatus,
  ShipMovement,
  // 武器相关
  WeaponType,
  WeaponMountType,
  WeaponSpec,
  WeaponMount,
  // 战斗相关
  AttackCommand,
  ExplosionData,
  CombatResult,
  // 地图与 Token
  MapConfig,
  TokenType,
  UnitTurnState,
  TokenInfo,
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
} from '../core-types.js';

// 导出阵营类型 Schema
export {
  FactionIdSchema,
  FactionDefinitionSchema,
  PlayerFactionInfoSchema,
} from './faction.js';

// 导出阵营回合类型 Schema
export {
  FactionTurnPhaseSchema,
  TurnHistoryEntrySchema,
  FactionTurnStateSchema,
  FactionTurnInitParamsSchema,
} from './factionTurn.js';

// 导出结果类型
export type { Result, Success, Failure, OptionalResult } from './result.js';
export { ok, fail } from './result.js';

// ==================== TokenV2 类型导出 ====================

// 导出三阶段移动类型
export {
  MovementPhaseSchema,
  MovementTypeSchema,
  MovementActionSchema,
  MovementStateSchema,
  MovementPhaseConfigSchema,
  createDefaultMovementState,
  resetMovementState,
  canExecutePhase,
  getAvailableMovementResources,
} from './movement-phase.js';

export type {
  MovementPhase,
  MovementType,
  MovementAction,
  MovementState,
  MovementPhaseConfig,
} from './movement-phase.js';

// 导出武器实例类型
export {
  WeaponStatusSchema,
  WeaponInstanceStateSchema,
  WeaponMountInstanceSchema,
  WeaponGroupSchema,
  ShipWeaponSystemSchema,
  createDefaultWeaponInstance,
  canWeaponFire,
  calculateWeaponDamage,
  resetWeaponTurnState,
} from './weapon-instance.js';

export type {
  WeaponStatus,
  WeaponInstanceState,
  WeaponMountInstance,
  WeaponGroup,
  ShipWeaponSystem,
} from './weapon-instance.js';

// 导出战斗状态类型
export {
  ArmorQuadrantInstanceSchema,
  ArmorInstanceStateSchema,
  ShieldTypeInstanceSchema,
  ShieldInstanceStateSchema,
  FluxStateSchema,
  FluxInstanceStateSchema,
  HullInstanceStateSchema,
  ActionTypeSchema,
  ActionsStateSchema,
  CombatStateSchema,
  createDefaultArmorState,
  createDefaultShieldState,
  createDefaultFluxState,
  createDefaultHullState,
  createDefaultActionsState,
  getArmorQuadrantFromAngle,
  calculateArmorDamageReduction,
  canStartVenting,
  isOverloaded,
  resetActionsState,
} from './combat-state.js';

export type {
  ArmorQuadrantInstance,
  ArmorInstanceState,
  ShieldTypeInstance,
  ShieldInstanceState,
  FluxState as FluxStateV2,
  FluxInstanceState,
  HullInstanceState,
  ActionType,
  ActionsState,
  CombatState,
} from './combat-state.js';

// 导出 TokenV2 类型
export {
  TokenTurnStateSchema,
  TokenVisualStateSchema,
  TokenInfoV2Schema,
  ShipTokenV2Schema,
  StationTokenV2Schema,
  AsteroidTokenV2Schema,
  TokenV2Schema,
  TokenCollectionSchema,
  createDefaultShipToken,
  resetTokenTurnState,
  canTokenAct,
  getAvailableActions,
  updateTokenPosition,
  isTokenInRange,
  getTokenCollisionRadius,
  areTokensColliding,
} from './token-v2.js';

export type {
  TokenTurnState,
  TokenVisualState,
  TokenInfoV2,
  ShipTokenV2,
  StationTokenV2,
  AsteroidTokenV2,
  TokenV2,
  TokenCollection,
} from './token-v2.js';