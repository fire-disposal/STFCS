/**
 * 服务端 Schema 定义（优化版）
 *
 * 使用嵌套对象结构提供更好的可读性和性能
 * Colyseus Schema 类必须使用装饰器
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";

import { DAMAGE_MODIFIERS, GAME_CONFIG } from "@vt/data";
import {
	ClientCommand,
	ConnectionQuality,
	Faction,
	GamePhaseType,
	PlayerRole,
	WeaponState,
} from "@vt/types";

import {
	ArmorState,
	FluxState,
	HullState,
	ShieldState,
	ShipStateOptimized,
	Transform,
	WeaponSlot,
} from "./ShipStateSchema.js";

export {
	ArraySchema,
	Transform,
	HullState,
	ArmorState,
	FluxState,
	ShieldState,
	ShipStateOptimized as ShipState,
	WeaponSlot,
};

export const WeaponStateConst = WeaponState;
export const ClientCommandConst = ClientCommand;
export const FactionConst = Faction;
export const PlayerRoleConst = PlayerRole;
export const ConnectionQualityConst = ConnectionQuality;
export const GamePhaseConst = GamePhaseType;
export const GAME_CONFIG_CONST = GAME_CONFIG;

export {
	WeaponState,
	ClientCommand,
	Faction,
	PlayerRole,
	ConnectionQuality,
	GamePhaseType as GamePhase,
	GAME_CONFIG,
	DAMAGE_MODIFIERS,
};

export type GamePhaseValue = (typeof GamePhaseType)[keyof typeof GamePhaseType];

export class PlayerState extends Schema {
	@type("string") sessionId: string = "";
	@type("number") shortId: number = 0;
	@type("string") role: string = "PLAYER";
	@type("string") name: string = "";
	@type("string") nickname: string = "";
	@type("string") avatar: string = "👤";
	@type("boolean") isReady: boolean = false;
	@type("boolean") connected: boolean = true;
	@type("number") pingMs: number = -1;
	@type("number") jitterMs: number = 0;
	@type("string") connectionQuality: string = "OFFLINE";
}

export class ChatMessage extends Schema {
	@type("string") id: string = "";
	@type("string") senderId: string = "";
	@type("string") senderName: string = "";
	@type("string") content: string = "";
	@type("number") timestamp: number = 0;
	@type("string") type: "chat" | "system" | "combat" = "chat";
}

export class GameRoomState extends Schema {
	@type("string") currentPhase: string = "DEPLOYMENT";
	@type("number") turnCount: number = 1;
	@type({ map: PlayerState }) players = new MapSchema<PlayerState>();
	@type({ map: ShipStateOptimized }) ships = new MapSchema<ShipStateOptimized>();
	@type("string") activeFaction: string = "PLAYER";
	@type("number") mapWidth: number = 2000;
	@type("number") mapHeight: number = 2000;

	@type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
}
