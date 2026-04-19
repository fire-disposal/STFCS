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
	WeaponState,
	WeaponSlotSize,
	ArmorQuadrant,
	// ARMOR_QUADRANTS, // TODO: not exported from data
	// ShieldType, // TODO: not exported from data
	// FluxState, // TODO: not exported from data
	HullSize,
	ShipClass,
	Faction,
	PlayerRole,
	ConnectionQuality,
	GamePhase,
	// TurnPhase, // TODO: not exported from data
	// MovePhase, // TODO: not exported from data
	// MovePhaseUI, // TODO: not exported from data
	// FactionTurnPhase, // TODO: not exported from data
	// TokenType, // TODO: not exported from data
	// TokenTurnState, // TODO: not exported from data
	// ClientCommand, // TODO: not exported from data
} from "@vt/data";

export type {
	// DamageTypeValue, // TODO: not exported from data
	// WeaponCategoryValue, // TODO: not exported from data
	// WeaponStateValue, // TODO: not exported from data
	// WeaponSlotSizeValue, // TODO: not exported from data
	// ArmorQuadrantValue, // TODO: not exported from data
	// ShieldTypeValue, // TODO: not exported from data
	// FluxStateValue, // TODO: not exported from data
	// HullSizeValue, // TODO: not exported from data
	// ShipClassValue, // TODO: not exported from data
	// FactionValue, // TODO: not exported from data
	// PlayerRoleValue, // TODO: not exported from data
	// ConnectionQualityValue, // TODO: not exported from data
	// GamePhaseValue, // TODO: not exported from data
	// TurnPhaseValue, // TODO: not exported from data
	// MovePhaseValue, // TODO: not exported from data
	// MovePhaseUIValue, // TODO: not exported from data
	// FactionTurnPhaseValue, // TODO: not exported from data
	// TokenTypeValue, // TODO: not exported from data
	// TokenTurnStateValue, // TODO: not exported from data
	// ClientCommandValue, // TODO: not exported from data
	Point,
	// ShipHullSpec, // TODO: not exported from data
	WeaponSpec,
	// WeaponMountSpec, // TODO: not exported from data
} from "@vt/data";

// ==================== Schema 类型（从 @vt/schema-types）====================

import type {
	GameRoomStateType,
	PlayerStateType,
	SchemaMap,
	SchemaArray,
} from "@vt/schema-types";

// 直接导出类型
export type {
	GameRoomStateType,
	PlayerStateType,
	SchemaMap,
	SchemaArray,
};

// 客户端使用的类型别名
export type GameRoomState = GameRoomStateType;
export type PlayerState = PlayerStateType;

// ==================== 本地补充类型 ====================

// import type { TokenTypeValue, FactionValue } from "@vt/data";

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
	type: string; // TokenTypeValue; // TODO: not exported
	x: number;
	y: number;
	heading: number;
	name: string;
	faction?: string; // FactionValue; // TODO: not exported
	ownerId: string;
}