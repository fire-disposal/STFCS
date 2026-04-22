/**
 * 前端特有类型扩展
 * 
 * 这些类型扩展了 @vt/data 中的权威类型，用于前端特有的需求
 */

import { MovementPhase, type PlayerInfo } from "@vt/data";

export type MovementPhaseValue = MovementPhase | undefined;

export function getMovementPhaseDisplay(phase: MovementPhaseValue): string {
    return phase ?? "未开始";
}

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
    role: import("@vt/data").PlayerRoleValue | null;
    profile: PlayerInfo | null;
    ready: boolean;
    connected: boolean;
    connectionQuality: string;
}

export interface RoomState {
    id: string;
    name: string;
    maxPlayers: number;
    phase: import("@vt/data").GamePhaseValue;
    turn: number;
    players: Map<string, FrontendPlayerState>;
    ownerId: string | null;
    createdAt: number;
    isPrivate: boolean;
}

export interface GameState {
    ships: Map<string, import("@vt/data").TokenRuntime>;
    weapons: Map<string, any>;
    objects: Map<string, GameObject>;
    turn: number;
    phase: import("@vt/data").GamePhaseValue;
}

export interface GameObject {
    id: string;
    type: "ship" | "token" | "marker" | "terrain";
    position: import("@vt/data").Point;
    rotation: number;
    data: Record<string, unknown>;
}

export interface UIState {
    camera: {
        position: import("@vt/data").Point;
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

// 工具类型
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type UnwrapArray<T> = T extends Array<infer U> ? U : T;
export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;
export type DeepRequired<T> = T extends object ? { [P in keyof T]-?: DeepRequired<T[P]> } : T;