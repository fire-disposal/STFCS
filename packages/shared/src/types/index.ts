/**
 * 核心类型导出
 * 
 * 原则：
 * 1. 所有类型从 core-types.ts 统一导出
 * 2. 避免重复定义
 * 3. 保持向后兼容
 */

// 从统一来源导出所有核心类型
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
} from '../core-types';

// 导出结果类型
export type { Result, Success, Failure, OptionalResult } from './result';
export { ok, fail } from './result';
