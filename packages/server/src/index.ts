/**
 * 服务端入口
 */

// Schema 类导出
export {
	GameRoomState,
	PlayerState,
	ChatMessage,
	ShipState,
	WeaponSlot,
	Transform,
	HullState,
	ArmorState,
	FluxStateSchema,
	ShieldState,
} from "./schema/index.js";

// 类型导出（不含 Payload，Payload 在 commands/types）
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
	CameraState,
	PlayerCamera,
	SchemaMap,
	SchemaArray,
	MovementPlan,
	MovementValidation,
	FactionTurnState,
	TokenInfo,
	AttackPreviewResult,
	CombatResult,
	WeaponSave,
	ShipSave,
	ChatMessageSave,
	GameSave,
	SaveMetadata,
	SaveSummary,
} from "./schema/types.js";

// 枚举常量导出
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
} from "./schema/types.js";

// Payload 类型导出
export type {
	ChatPayload,
	MoveTokenPayload,
	ToggleShieldPayload,
	FireWeaponPayload,
	VentFluxPayload,
	ClearOverloadPayload,
	SetArmorPayload,
	AdvanceMovePhasePayload,
	AssignShipPayload,
	ToggleReadyPayload,
	NextPhasePayload,
	CreateObjectPayload,
	NetPingPayload,
	NetPongPayload,
} from "./commands/types.js";

// 服务器启动代码
import { createServer } from "http";
import { Server, ServerOptions } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import express from "express";
import { BattleRoom } from "./rooms/BattleRoom.js";
import { SaveRoom } from "./rooms/SaveRoom.js";
import { SystemRoom } from "./rooms/SystemRoom.js";
import { registerHttpRoutes } from "./http/registerRoutes.js";

const PORT = process.env.PORT || 2567;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGINS === "*" ? true : CORS_ORIGINS, credentials: true }));
app.use(express.json());
app.set("startedAt", Date.now());
registerHttpRoutes(app);

const server = createServer(app);
const gameServer = new Server({
	transport: new WebSocketTransport({ server, pingInterval: 3000 }),
	greet: false,
});

gameServer.define("battle", BattleRoom).enableRealtimeListing();
gameServer.define("system_save", SaveRoom);
gameServer.define("system", SystemRoom);

process.on("uncaughtException", (e) => console.error("[Server] Uncaught:", e));
process.on("unhandledRejection", (r) => console.error("[Server] Unhandled:", r));

gameServer.listen(Number(PORT)).then(() => {
	console.log(`STFCS Server Ready - ws://localhost:${PORT}`);
}).catch((e) => {
	console.error("[Server] Failed:", e);
	process.exit(1);
});