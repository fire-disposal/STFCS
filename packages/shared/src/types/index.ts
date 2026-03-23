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
  ShipCustomization,
  ShipAssetDefinition,
  InventoryItem,
  DockedShip,
  PlayerHangar,
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
  // 回合系统
  TurnPhase,
  TurnUnit,
  TurnOrder,
  TurnState,
} from '../core-types.js';

// 导出结果类型
export type { Result, Success, Failure, OptionalResult } from './result.js';
export { ok, fail } from './result.js';
