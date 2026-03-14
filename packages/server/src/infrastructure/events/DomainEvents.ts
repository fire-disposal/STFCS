/**
 * 领域事件类型定义
 * 所有 Domain 层发布的事件都在这里定义
 */

import type { Point } from "../../types/geometry";
import type { ShipMovementPhase } from "../../domain/ship/types";
import type { FluxOverloadState } from "@vt/shared/types";

// ====== 舰船事件 ======

export interface ShipMovedEvent {
	type: "SHIP_MOVED";
	shipId: string;
	previousPosition: Point;
	newPosition: Point;
	previousHeading: number;
	newHeading: number;
	phase: ShipMovementPhase;
	timestamp: number;
}

export interface ShieldToggledEvent {
	type: "SHIELD_TOGGLED";
	shipId: string;
	isActive: boolean;
	timestamp: number;
}

export interface ShieldMaintenanceEvent {
	type: "SHIELD_MAINTENANCE";
	shipId: string;
	fluxCost: number;
	timestamp: number;
}

export interface FluxOverloadedEvent {
	type: "FLUX_OVERLOADED";
	shipId: string;
	fluxLevel: number;
	capacity: number;
	timestamp: number;
}

export interface FluxVentingEvent {
	type: "FLUX_VENTING";
	shipId: string;
	timestamp: number;
}

export interface FluxStateUpdatedEvent {
	type: "FLUX_STATE_UPDATED";
	shipId: string;
	fluxState: FluxOverloadState;
	currentFlux: number;
	softFlux: number;
	hardFlux: number;
	timestamp: number;
}

// ====== 玩家事件 ======

export interface PlayerJoinedEvent {
	type: "PLAYER_JOINED";
	playerId: string;
	playerName: string;
	roomId: string;
	timestamp: number;
}

export interface PlayerLeftEvent {
	type: "PLAYER_LEFT";
	playerId: string;
	roomId: string;
	reason?: string;
	timestamp: number;
}

export interface PlayerDMModeChangedEvent {
	type: "PLAYER_DM_MODE_CHANGED";
	playerId: string;
	playerName: string;
	isDMMode: boolean;
	timestamp: number;
}

// ====== 选中事件 ======

export interface ObjectSelectedEvent {
	type: "OBJECT_SELECTED";
	tokenId: string;
	playerId: string;
	playerName: string;
	roomId: string;
	forceOverride: boolean;
	timestamp: number;
}

export interface ObjectDeselectedEvent {
	type: "OBJECT_DESELECTED";
	tokenId: string;
	playerId: string;
	roomId: string;
	reason: "manual" | "override" | "released";
	timestamp: number;
}

// ====== 战斗事件 ======

export interface WeaponFiredEvent {
	type: "WEAPON_FIRED";
	sourceShipId: string;
	targetShipId: string;
	weaponId: string;
	mountId: string;
	timestamp: number;
}

export interface DamageDealtEvent {
	type: "DAMAGE_DEALT";
	sourceShipId: string;
	targetShipId: string;
	damage: number;
	shieldAbsorbed: number;
	armorReduced: number;
	hullDamage: number;
	softFluxGenerated: number;
	hardFluxGenerated: number;
	timestamp: number;
}

// ====== 地图/Token 事件 ======

export interface TokenPlacedEvent {
	type: "TOKEN_PLACED";
	tokenId: string;
	ownerId: string;
	position: Point;
	heading: number;
	tokenType: string;
	roomId: string;
	timestamp: number;
}

export interface TokenMovedEvent {
	type: "TOKEN_MOVED";
	tokenId: string;
	ownerId: string;
	previousPosition: Point;
	newPosition: Point;
	previousHeading: number;
	newHeading: number;
	roomId: string;
	timestamp: number;
}

export interface TokenRemovedEvent {
	type: "TOKEN_REMOVED";
	tokenId: string;
	roomId: string;
	reason: string;
	timestamp: number;
}

// ====== 联合类型 ======

export type DomainEvent =
	| ShipMovedEvent
	| ShieldToggledEvent
	| ShieldMaintenanceEvent
	| FluxOverloadedEvent
	| FluxVentingEvent
	| FluxStateUpdatedEvent
	| PlayerJoinedEvent
	| PlayerLeftEvent
	| PlayerDMModeChangedEvent
	| ObjectSelectedEvent
	| ObjectDeselectedEvent
	| WeaponFiredEvent
	| DamageDealtEvent
	| TokenPlacedEvent
	| TokenMovedEvent
	| TokenRemovedEvent;

export type DomainEventType = DomainEvent["type"];

// ====== 事件工具函数 ======

export function createShipEvent<T extends DomainEvent["type"]>(
	type: T,
	data: Omit<Extract<DomainEvent, { type: T }>, "type" | "timestamp">
): Extract<DomainEvent, { type: T }> {
	return {
		...data,
		type,
		timestamp: Date.now(),
	} as Extract<DomainEvent, { type: T }>;
}
