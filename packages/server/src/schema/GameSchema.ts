/**
 * 服务端 Schema
 */

import { ArraySchema, MapSchema, Schema, type } from "@colyseus/schema";
import { ChatMessageType, ConnectionQuality, Faction, GamePhase, PlayerRole } from "@vt/types";
import type * as VT from "@vt/types";
import { ShipState } from "./ShipStateSchema.js";

export {
	ShipState,
	WeaponSlot,
	Transform,
	HullState,
	ArmorState,
	FluxState,
	ShieldState,
} from "./ShipStateSchema.js";

export class PlayerState extends Schema implements VT.PlayerState {
	@type("string") sessionId: string = "";
	@type("number") shortId: number = 0;
	@type("string") role: VT.PlayerRoleValue = PlayerRole.PLAYER;
	@type("string") name: string = "";
	@type("string") nickname: string = "";
	@type("string") avatar: string = "👤";
	@type("boolean") isReady: boolean = false;
	@type("boolean") connected: boolean = true;
	@type("number") pingMs: number = -1;
	@type("number") jitterMs: number = 0;
	@type("string") connectionQuality: VT.ConnectionQualityValue =
		ConnectionQuality.OFFLINE;
}

export class ChatMessage extends Schema implements VT.ChatMessage {
	@type("string") id: string = "";
	@type("string") senderId: string = "";
	@type("string") senderName: string = "";
	@type("string") content: string = "";
	@type("number") timestamp: number = 0;
	@type("string") type: VT.ChatMessageTypeValue = ChatMessageType.CHAT;

	constructor(init?: Partial<VT.ChatMessage>) {
		super();
		if (init) Object.assign(this, init);
	}
}

export class GameRoomState extends Schema implements VT.GameRoomState {
	@type("string") currentPhase: VT.GamePhaseValue = GamePhase.DEPLOYMENT;
	@type("number") turnCount: number = 1;
	@type({ map: PlayerState }) players = new MapSchema<PlayerState>();
	@type({ map: ShipState }) ships = new MapSchema<ShipState>();
	@type("string") activeFaction: VT.FactionValue = Faction.PLAYER;
	@type("number") mapWidth: number = 2000;
	@type("number") mapHeight: number = 2000;
	@type([ChatMessage]) chatMessages = new ArraySchema<ChatMessage>();
}
