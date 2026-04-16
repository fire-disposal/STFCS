/**
 * @vt/schema-types
 *
 * 从 @vt/server Schema 类自动推导的类型定义
 * 供前端和其他包使用，零维护成本，100% 同步
 *
 * 使用方式：
 *   import type { ShipStateType, GameRoomStateType } from '@vt/schema-types';
 */

// ==================== Schema 实例类型（自动推导）====================

import type {
	ShipState,
	WeaponSlot,
	Transform,
	HullState,
	ArmorState,
	FluxStateSchema,
	ShieldState,
	GameRoomState,
	PlayerState,
} from "@vt/server";

// Schema 类的实例类型 - 供客户端使用
export type ShipStateType = InstanceType<typeof ShipState>;
export type WeaponSlotType = InstanceType<typeof WeaponSlot>;
export type TransformType = InstanceType<typeof Transform>;
export type HullStateType = InstanceType<typeof HullState>;
export type ArmorStateType = InstanceType<typeof ArmorState>;
export type FluxStateType = InstanceType<typeof FluxStateSchema>;
export type ShieldStateType = InstanceType<typeof ShieldState>;
export type GameRoomStateType = InstanceType<typeof GameRoomState>;
export type PlayerStateType = InstanceType<typeof PlayerState>;

// ==================== 从 Schema 字段提取的枚举类型 ====================

export type Faction = ShipStateType["faction"];
export type GamePhase = GameRoomStateType["currentPhase"];
export type PlayerRole = PlayerStateType["role"];
export type WeaponState = WeaponSlotType["state"];
export type MovePhase = ShipStateType["movePhase"];
export type ConnectionQuality = PlayerStateType["connectionQuality"];

// ==================== Schema 容器类型（客户端辅助）====================

/**
 * Colyseus MapSchema 的类型表示
 * 前端需要此接口来正确处理 Schema Map
 */
export interface SchemaMap<T> {
	get(key: string): T | undefined;
	set(key: string, value: T): void;
	has(key: string): boolean;
	delete(key: string): boolean;
	clear(): void;
	forEach(cb: (value: T, key: string) => void): void;
	entries(): IterableIterator<[string, T]>;
	keys(): IterableIterator<string>;
	values(): IterableIterator<T>;
	size: number;
}

/**
 * Colyseus ArraySchema 的类型表示
 */
export interface SchemaArray<T> {
	length: number;
	[index: number]: T;
	push(...items: T[]): number;
	pop(): T | undefined;
	forEach(cb: (value: T, index: number) => void): void;
	at(index: number): T | undefined;
}

// ==================== 类型别名（便于导入）====================

// 简短别名，方便使用
export type Ship = ShipStateType;
export type Weapon = WeaponSlotType;
export type RoomState = GameRoomStateType;
export type Player = PlayerStateType;