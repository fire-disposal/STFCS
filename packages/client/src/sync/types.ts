/**
 * 客户端类型定义
 *
 * 枚举值从 @vt/data 导入（运行时）
 * Schema 类型从 @vt/schema-types 导入（自动推导，100% 同步）
 */

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
	GamePhase,
	TurnPhase,
	MovePhase,
	MovePhaseUI,
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
	GamePhaseValue,
	TurnPhaseValue,
	MovePhaseValue,
	MovePhaseUIValue,
	FactionTurnPhaseValue,
	TokenTypeValue,
	TokenTurnStateValue,
	ClientCommandValue,
	Point,
	ShipHullSpec,
	WeaponSpec,
	WeaponMountSpec,
} from "@vt/data";

// ==================== Schema 类型（从 @vt/schema-types）====================

import type {
	ShipStateType,
	WeaponSlotType,
	TransformType,
	HullStateType,
	ArmorStateType,
	FluxStateType,
	ShieldStateType,
	GameRoomStateType,
	PlayerStateType,
	SchemaMap,
	SchemaArray,
} from "@vt/schema-types";

// 直接导出类型
export type {
	ShipStateType,
	WeaponSlotType,
	TransformType,
	HullStateType,
	ArmorStateType,
	FluxStateType,
	ShieldStateType,
	GameRoomStateType,
	PlayerStateType,
	SchemaMap,
	SchemaArray,
};

// 客户端使用的类型别名
export type ShipState = ShipStateType;
export type WeaponSlot = WeaponSlotType;
export type Transform = TransformType;
export type HullState = HullStateType;
export type ArmorState = ArmorStateType;
export type FluxState = FluxStateType;
export type ShieldState = ShieldStateType;
export type GameRoomState = GameRoomStateType;
export type PlayerState = PlayerStateType;

// ==================== 本地补充类型 ====================

import type { TokenTypeValue, FactionValue } from "@vt/data";

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