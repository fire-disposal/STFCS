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
export type { FireResult, DamageResult, ConfigureResult } from "./commands/game/index.js";

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
export { 
    PlayerService, 
    type OnlineProfile, 
    SaveService, 
    saveService, 
    ProfileService, 
    profileService,
    PersistenceManager,
    persistence 
} from "./services/index.js";

// 服务器启动代码
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import express from "express";
import { BattleRoom } from "./rooms/BattleRoom.js";
import { SaveRoom } from "./rooms/SaveRoom.js";
import { SystemRoom } from "./rooms/SystemRoom.js";
import { registerHttpRoutes } from "./http/registerRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 2567;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || "*";

const app = express();
app.use(cors({ origin: CORS_ORIGINS === "*" ? true : CORS_ORIGINS, credentials: true }));
app.use(express.json());
app.set("startedAt", Date.now());

// 注册 API 路由
registerHttpRoutes(app);

// 单容器部署：托管前端静态文件
// 注意：在 Docker 中我们将 client/dist 复制到 server/public
const publicPath = path.resolve(__dirname, "public");
app.use(express.static(publicPath));

// 处理 SPA 路由，确保刷新页面不 404
app.get("*", (req, res, next) => {
	// 如果是 API 或 Colyseus 请求，跳过
	if (req.url.startsWith("/matchmake") || req.url.startsWith("/health")) {
		return next();
	}
	res.sendFile(path.join(publicPath, "index.html"), (err) => {
		if (err) {
			// 如果 index.html 不存在（例如 Node 直接运行时），交给后续处理
			next();
		}
	});
});

const server = createServer(app);
const gameServer = new Server({
	transport: new WebSocketTransport({
		server,
		pingInterval: 3000,
		// 允许大消息（头像 Base64 数据，前端压缩后约 15-50KB，预留 512KB）
		maxPayload: 512 * 1024,
	}),
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