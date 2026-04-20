/**
 * 前端类型定义
 *
 * 从 @vt/data 导入类型定义
 * 定义前端特有的类型
 */

import {
	DamageType,
	WeaponSlotSize,
	WeaponTag,
	HullSize,
	ShipClass,
	WeaponState,
	ArmorQuadrant,
	GamePhase,
	Faction,
	PlayerRole,
	MovementPhase,
	FluxState,
	ShieldType,
} from "@vt/data";

import type {
	Point,
	ShipJSON,
	ShipSpec,
	ShipRuntime,
	ShieldSpec,
	MountSpec,
	WeaponJSON,
	WeaponSpec,
	GamePhaseValue,
	FactionValue,
	PlayerRoleValue,
} from "@vt/data";

export {
	DamageType,
	WeaponSlotSize,
	WeaponTag,
	HullSize,
	ShipClass,
	WeaponState,
	ArmorQuadrant,
	GamePhase,
	Faction,
	PlayerRole,
	MovementPhase,
	FluxState,
	ShieldType,
};

export type {
	Point,
	ShipJSON,
	ShipSpec,
	ShipRuntime,
	ShieldSpec,
	MountSpec,
	WeaponJSON,
	WeaponSpec,
	GamePhaseValue,
	FactionValue,
	PlayerRoleValue,
};

export type MovementPhaseValue = "A" | "B" | "C" | "DONE" | "NONE";

export const MovePhaseUI = {
	PHASE_A: "A" as const,
	PHASE_B: "B" as const,
	PHASE_C: "C" as const,
	DONE: "DONE" as const,
	NONE: "NONE" as const,
};

export type MovePhaseUIValue = (typeof MovePhaseUI)[keyof typeof MovePhaseUI];

export interface AppState {
	connection: ConnectionState;
	player: FrontendPlayerState;
	room: RoomState | null;
	game: GameState;
	ui: UIState;
}

export interface ConnectionState {
	status: "disconnected" | "connecting" | "connected" | "reconnecting";
	latency: number;
	serverTimeOffset: number;
	lastHeartbeat: number;
	connectionId: string | null;
}

export interface FrontendPlayerState {
	id: string | null;
	sessionId: string | null;
	name: string | null;
	role: PlayerRoleValue | null;
	profile: PlayerProfile | null;
	ready: boolean;
	connected: boolean;
	connectionQuality: string;
}

export interface PlayerProfile {
	nickname?: string;
	avatar?: string;
	preferences?: Record<string, unknown>;
}

export interface RoomState {
	id: string;
	name: string;
	maxPlayers: number;
	phase: GamePhaseValue;
	turn: number;
	players: Map<string, FrontendPlayerState>;
	ownerId: string | null;
	createdAt: number;
	isPrivate: boolean;
}

export interface GameState {
	ships: Map<string, ShipRuntime>;
	weapons: Map<string, any>;
	objects: Map<string, GameObject>;
	turn: number;
	phase: GamePhaseValue;
}

export interface GameObject {
	id: string;
	type: "ship" | "token" | "marker" | "terrain";
	position: Point;
	rotation: number;
	data: Record<string, unknown>;
}

export interface UIState {
	camera: {
		position: Point;
		zoom: number;
		rotation: number;
	};
	selection: {
		shipId: string | null;
		weaponId: string | null;
		targetId: string | null;
	};
	panels: {
		leftPanel: boolean;
		rightPanel: boolean;
		bottomPanel: boolean;
		chatPanel: boolean;
	};
	display: {
		showGrid: boolean;
		showLabels: boolean;
		showEffects: boolean;
		showWeaponArcs: boolean;
		showMovementRange: boolean;
		showBackground: boolean;
	};
	tool: "select" | "move" | "rotate" | "attack" | "measure";
}

export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type UnwrapArray<T> = T extends Array<infer U> ? U : T;
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
export type DeepRequired<T> = T extends object ? { [P in keyof T]-?: DeepRequired<T[P]> } : T;