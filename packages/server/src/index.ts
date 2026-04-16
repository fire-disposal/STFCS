/**
 * 服务端入口
 */

// Schema 类导出
export {
	GameRoomState,
	PlayerState,
	ShipState,
	WeaponSlot,
	Transform,
	HullState,
	ArmorState,
	FluxStateSchema,
	ShieldState,
} from "./schema/index.js";

// 枚举常量导出（从 @vt/data）
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
	FactionTurnPhase,
	TokenType,
	TokenTurnState,
	ClientCommand,
} from "@vt/data";

// 类型导出（从 @vt/data）
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
	FactionTurnPhaseValue,
	TokenTypeValue,
	TokenTurnStateValue,
	ClientCommandValue,
	Point,
	ShipHullSpec,
	WeaponSpec,
	WeaponMountSpec,
} from "@vt/data";

// 服务端独有类型导出（从 ./schema/types）
export type {
	MovementPlan,
	WeaponSave,
	ShipSave,
	GameSave,
	SaveMetadata,
	SaveSummary,
	// 玩家档案类型
	VariantConfig,
	CustomVariant,
	PlayerProfile,
	PlayerSettings,
	ProfileSummary,
	// DTO 类型
	ErrorDTO,
	RoleDTO,
	IdentityDTO,
	GameSavedDTO,
	GameLoadedDTO,
	PhaseChangeDTO,
	RoomKickedDTO,
	ShipCreatedDTO,
	RoomMetadata,
	RoomListItemDTO,
	HealthStatusDTO,
	NetPongPayload,
} from "./schema/types.js";

// 命令结果类型导出
export type { FireResult, DamageResult, ConfigureResult } from "./commands/handlers/index.js";

// Schema 容器类型（本地定义，避免循环依赖）
export interface SchemaMap<T> {
	get(key: string): T | undefined;
	set(key: string, value: T): void;
	has(key: string): boolean;
	delete(key: string): boolean;
	clear(): void;
	forEach(cb: (value: T, key: string) => void): void;
	entries(): IterableIterator<[string, T]>;
	keys(): IterableIterator<string>;
	values(): IterableIterator<T>;
	size: number;
}

export interface SchemaArray<T> {
	length: number;
	[index: number]: T;
	push(...items: T[]): number;
	pop(): T | undefined;
	forEach(cb: (value: T, index: number) => void): void;
	at(index: number): T | undefined;
}

// Payload 类型导出（客户端请求）
export type {
	MoveTokenPayload,
	ToggleShieldPayload,
	FireWeaponPayload,
	VentFluxPayload,
	ConfigureWeaponPayload,
	ConfigureVariantPayload,
	WeaponLoadoutEntry,
	SaveVariantPayload,
	LoadVariantPayload,
	DeleteVariantPayload,
	ClearOverloadPayload,
	SetArmorPayload,
	RepairWeaponPayload,
	AdvanceMovePhasePayload,
	AssignShipPayload,
	ToggleReadyPayload,
	NextPhasePayload,
	CreateObjectPayload,
	NetPingPayload,
	SaveGamePayload,
	LoadGamePayload,
	DeleteSavePayload,
	ListSavesPayload,
	KickPlayerPayload,
	UpdateProfilePayload,
} from "./commands/types.js";

// 服务层导出
export { PlayerService, type OnlineProfile } from "./services/index.js";
export { GameService } from "./services/index.js";
export { SaveService, saveService } from "./services/index.js";
export { ProfileService, profileService } from "./services/ProfileService.js";

// 服务器启动代码
import { createServer } from "http";
import { Server } from "@colyseus/core";
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