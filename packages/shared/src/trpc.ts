// tRPC类型定义文件
// 此文件定义了tRPC的共享类型，确保前后端类型安全
// 使用类型推断和泛型来减少重复代码

import type { PlayerInfo, ShipStatus } from "./types";

// ==================== 输入类型定义 ====================

// 玩家相关输入
export interface PlayerJoinInput {
  id: string;
  name: string;
  roomId?: string;
}

export interface PlayerLeaveInput {
  playerId: string;
  roomId: string;
}

export interface PlayerListInput {
  roomId: string;
}

// 舰船相关输入
export interface ShipMoveInput {
  shipId: string;
  phase: 1 | 2 | 3;
  type: "straight" | "strafe" | "rotate";
  distance?: number;
  angle?: number;
}

export interface ShipToggleShieldInput {
  shipId: string;
}

export interface ShipVentInput {
  shipId: string;
}

export interface ShipGetStatusInput {
  shipId: string;
}

// ==================== tRPC路由类型定义 ====================

// 使用泛型定义路由过程
export interface TRPCProcedure<I = unknown, O = unknown> {
  input: I;
  output: O;
}

// 使用泛型定义路由
export interface TRPCRouter {
  [key: string]: TRPCProcedure | TRPCRouter;
}

// 玩家路由
export interface PlayerRouter {
  join: TRPCProcedure<PlayerJoinInput, PlayerInfo>;
  leave: TRPCProcedure<PlayerLeaveInput, void>;
  list: TRPCProcedure<PlayerListInput, PlayerInfo[]>;
}

// 舰船路由
export interface ShipRouter {
  move: TRPCProcedure<ShipMoveInput, ShipStatus | null>;
  toggleShield: TRPCProcedure<ShipToggleShieldInput, ShipStatus | null>;
  vent: TRPCProcedure<ShipVentInput, ShipStatus | null>;
  getStatus: TRPCProcedure<ShipGetStatusInput, ShipStatus | null>;
}

// 主应用路由
export interface AppRouter {
  player: PlayerRouter;
  ship: ShipRouter;
}

// ==================== 类型推断工具 ====================

// 推断路由输入类型
export type InferRouterInput<
  TRouter extends TRPCRouter,
  TKey extends keyof TRouter
> = TRouter[TKey] extends TRPCProcedure<infer I, any> ? I : never;

// 推断路由输出类型
export type InferRouterOutput<
  TRouter extends TRPCRouter,
  TKey extends keyof TRouter
> = TRouter[TKey] extends TRPCProcedure<any, infer O> ? O : never;

// 推断嵌套路由过程
export type InferProcedureInput<
  TRouter extends TRPCRouter,
  TPath extends string
> = TPath extends `${infer TKey}.${infer Rest}`
  ? TKey extends keyof TRouter
    ? TRouter[TKey] extends TRPCRouter
      ? InferProcedureInput<TRouter[TKey], Rest>
      : never
    : never
  : TPath extends keyof TRouter
  ? TRouter[TPath] extends TRPCProcedure<infer I, any>
    ? I
    : never
  : never;

export type InferProcedureOutput<
  TRouter extends TRPCRouter,
  TPath extends string
> = TPath extends `${infer TKey}.${infer Rest}`
  ? TKey extends keyof TRouter
    ? TRouter[TKey] extends TRPCRouter
      ? InferProcedureOutput<TRouter[TKey], Rest>
      : never
    : never
  : TPath extends keyof TRouter
  ? TRouter[TPath] extends TRPCProcedure<any, infer O>
    ? O
    : never
  : never;

// ==================== 类型安全工具 ====================

// 创建类型安全的tRPC客户端配置
export interface TRPCClientConfig {
  url: string;
  headers?: () => Record<string, string>;
}

// 注意：WSMessage接口已在ws/index.ts中定义
// 这里不再重复定义，直接导出ws中的类型

// 导出所有类型
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
} from "./types";
