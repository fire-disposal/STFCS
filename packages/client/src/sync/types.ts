/**
 * 客户端类型定义
 *
 * 枚举值从 @vt/data 导入（运行时）
 * Schema 类型从 @vt/server 用 import type（纯类型，不触发构建）
 */

// ==================== 内部导入（供本文件使用）====================

import type { TokenTypeValue, FactionValue } from "@vt/data";

// ==================== 枚举常量（从 @vt/data）====================

export {
	DamageType,
	WeaponCategory,
	MountType,
	WeaponState,
	WeaponSlotSize,
	ArmorQuadrant,
	ARMOR_QUADRANTS,
	ShieldType,
	FluxState,
	HullSize,
	ShipClass,
	Faction,
	PlayerRole,
	ConnectionQuality,
	ChatMessageType,
	GamePhase,
	TurnPhase,
	MovePhase,
	FactionTurnPhase,
	TokenType,
	TokenTurnState,
	ClientCommand,
} from "@vt/data";

export type {
	DamageTypeValue,
	WeaponCategoryValue,
	MountTypeValue,
	WeaponStateValue,
	WeaponSlotSizeValue,
	ArmorQuadrantValue,
	ShieldTypeValue,
	FluxStateValue,
	HullSizeValue,
	ShipClassValue,
	FactionValue,
	PlayerRoleValue,
	ConnectionQualityValue,
	ChatMessageTypeValue,
	GamePhaseValue,
	TurnPhaseValue,
	MovePhaseValue,
	FactionTurnPhaseValue,
	TokenTypeValue,
	TokenTurnStateValue,
	ClientCommandValue,
	Point,
	ShipHullSpec,
	WeaponSpec,
	WeaponMountSpec,
} from "@vt/data";

// ==================== Schema 类型（纯类型导入）====================

import type { ShipState as ShipStateSchema } from "@vt/server";
import type { WeaponSlot as WeaponSlotSchema } from "@vt/server";
import type { GameRoomState as GameRoomStateSchema } from "@vt/server";
import type { PlayerState as PlayerStateSchema } from "@vt/server";
import type { ChatMessage as ChatMessageSchema } from "@vt/server";
import type { Transform as TransformSchema } from "@vt/server";
import type { HullState as HullStateSchema } from "@vt/server";
import type { ArmorState as ArmorStateSchema } from "@vt/server";
import type { FluxStateSchema as FluxStateSchemaType } from "@vt/server";
import type { ShieldState as ShieldStateSchema } from "@vt/server";

// 导出 Schema 类型（客户端实际使用的是 Colyseus Schema 实例）
export type ShipState = ShipStateSchema;
export type WeaponSlot = WeaponSlotSchema;
export type GameRoomState = GameRoomStateSchema;
export type PlayerState = PlayerStateSchema;
export type ChatMessage = ChatMessageSchema;
export type Transform = TransformSchema;
export type HullState = HullStateSchema;
export type ArmorState = ArmorStateSchema;
export type FluxStateSchema = FluxStateSchemaType;
export type ShieldState = ShieldStateSchema;

// ==================== 本地补充类型 ====================

export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	viewRotation?: number;
	followingShipId?: string | null;
}

export interface PlayerCamera extends CameraState {
	playerId: string;
}

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

// 本地聊天消息（客户端显示用，非 Schema）
export interface LocalChatMessage {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: "chat" | "system" | "combat";
}

// Token 信息（客户端本地使用）
export interface TokenInfo {
	id: string;
	type: TokenTypeValue;
	x: number;
	y: number;
	heading: number;
	name: string;
	faction?: FactionValue;
	ownerId: string;
}