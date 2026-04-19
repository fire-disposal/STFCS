/**
 * @vt/schema-types
 *
 * 从 @vt/server Schema 类自动推导的类型定义
 * 供前端和其他包使用，零维护成本，100% 同步
 *
 * 使用方式：
 *   import type { GameRoomStateType, PlayerStateType } from '@vt/schema-types';
 *
 * 注意：Payload 类型（MoveTokenPayload 等）请直接从 @vt/server/commands/types 导入
 */

// ==================== Schema 实例类型（自动推导）====================

import type {
	GameRoomState,
	PlayerState,
	ShipRuntimeSlim,
} from "@vt/server";

export type GameRoomStateType = InstanceType<typeof GameRoomState>;
export type PlayerStateType = InstanceType<typeof PlayerState>;
export type ShipRuntimeSlimType = InstanceType<typeof ShipRuntimeSlim>;

// ==================== 从 Schema 字段提取的枚举类型 ====================

export type GamePhase = GameRoomStateType["currentPhase"];
export type PlayerRole = PlayerStateType["role"];
export type ConnectionQuality = PlayerStateType["connectionQuality"];

// ==================== Schema 容器类型（客户端辅助）====================

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

export interface SchemaArray<T> {
	length: number;
	[index: number]: T;
	push(...items: T[]): number;
	pop(): T | undefined;
	forEach(cb: (value: T, index: number) => void): void;
	at(index: number): T | undefined;
}

// ==================== Payload 类型（从服务器重新导出）====================

export type {
	CustomizeShipPayload,
	AddWeaponMountPayload,
	RemoveWeaponMountPayload,
	UpdateWeaponMountPayload,
	SetShipTexturePayload,
	CreateCustomWeaponPayload,
	UpdateCustomWeaponPayload,
} from "@vt/server";
