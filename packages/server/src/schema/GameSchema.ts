/**
 * 服务端 Schema
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import {
	GamePhase,
	PlayerRole,
	ConnectionQuality,
	ChatMessageType,
	Faction,
} from "./types.js";
import type {
	GamePhaseValue,
	PlayerRoleValue,
	ConnectionQualityValue,
	ChatMessageTypeValue,
	FactionValue,
} from "./types.js";
import {
	ShipState,
	WeaponSlot,
	Transform,
	HullState,
	ArmorState,
	FluxStateSchema,
	ShieldState,
} from "./ShipStateSchema.js";

;

export class PlayerState extends Schema {
	@type("string") sessionId: string = "";
	@type("number") shortId: number = 0;
	@type("string") role: PlayerRoleValue = PlayerRole.PLAYER;
	@type("string") name: string = "";
	@type("string") nickname: string = "";
	@type("string") avatar: string = "👤";
	@type("boolean") isReady: boolean = false;
	@type("boolean") connected: boolean = true;
	@type("number") pingMs: number = -1;
	@type("number") jitterMs: number = 0;
	@type("string") connectionQuality: ConnectionQualityValue = ConnectionQuality.OFFLINE;
}

export class ChatMessage extends Schema {
	@type("string") id: string = "";
	@type("string") senderId: string = "";
	@type("string") senderName: string = "";
	@type("string") content: string = "";
	@type("number") timestamp: number = 0;
	@type("string") type: ChatMessageTypeValue = ChatMessageType.CHAT;

	constructor(init?: Partial<ChatMessage>) {
		super();
		if (init) Object.assign(this, init);
	}
}

export class GameRoomState extends Schema {
	@type("string") currentPhase: GamePhaseValue = GamePhase.DEPLOYMENT;
	@type("number") turnCount: number = 1;
	@type({ map: PlayerState }) players = new MapSchema<PlayerState>();
	@type({ map: ShipState }) ships = new MapSchema<ShipState>();
	@type("string") activeFaction: FactionValue = Faction.PLAYER;
	@type("number") mapWidth: number = 2000;
	@type("number") mapHeight: number = 2000;
	@type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
}