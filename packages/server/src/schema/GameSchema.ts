/**
 * 服务端 Schema
 */

import { MapSchema, Schema, type } from "@colyseus/schema";
import { GamePhase, PlayerRole, ConnectionQuality, Faction } from "@vt/data";
import type {
	GamePhaseValue,
	PlayerRoleValue,
	ConnectionQualityValue,
	FactionValue,
} from "@vt/data";
import { ShipState } from "./ShipStateSchema.js";

export class PlayerState extends Schema {
	@type("string") sessionId: string = "";
	@type("number") shortId: number = 0;
	@type("string") role: PlayerRoleValue = PlayerRole.PLAYER;
	@type("string") name: string = "";
	@type("string") nickname: string = "";
	// avatar 不通过 Schema 同步（大数据），改为消息发送
	avatar: string = ""; // 仅服务端内存存储，不标注 @type
	@type("boolean") isReady: boolean = false;
	@type("boolean") connected: boolean = true;
	@type("number") pingMs: number = -1;
	@type("number") jitterMs: number = 0;
	@type("string") connectionQuality: ConnectionQualityValue =
		ConnectionQuality.OFFLINE;
}

export class GameRoomState extends Schema {
	@type("string") currentPhase: GamePhaseValue = GamePhase.DEPLOYMENT;
	@type("number") turnCount: number = 1;
	@type({ map: PlayerState }) players = new MapSchema<PlayerState>();
	@type({ map: ShipState }) ships = new MapSchema<ShipState>();
	@type("string") activeFaction: FactionValue = Faction.PLAYER;
	@type("number") mapWidth: number = 2000;
	@type("number") mapHeight: number = 2000;
}