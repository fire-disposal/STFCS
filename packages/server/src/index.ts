/**
 * 服务端入口 - 模块化组织
 */

import { createServer } from "http";
import { Server, ServerOptions } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import cors from "cors";
import express from "express";

// 房间
import { BattleRoom } from "./rooms/BattleRoom.js";
import { SaveRoom } from "./rooms/SaveRoom.js";
import { SystemRoom } from "./rooms/SystemRoom.js";

import { registerHttpRoutes } from "./http/registerRoutes.js";

// ==================== 配置 ====================

const PORT = process.env.PORT || process.env.WS_PORT || 2567;
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(",") || "*";

console.log(`[Server] Configuration: PORT=${PORT}, CORS=${CORS_ORIGINS}`);

// ==================== Express 设置 ====================

const app = express();
app.use(
	cors({
		origin: CORS_ORIGINS === "*" ? true : CORS_ORIGINS,
		credentials: true,
	})
);
app.use(express.json());
app.set("startedAt", Date.now());

registerHttpRoutes(app);

// ==================== HTTP 服务器 ====================

const server = createServer(app);

// ==================== Colyseus 设置 ====================

const colyseusOptions: ServerOptions = {
	transport: new WebSocketTransport({
		server,
		pingInterval: 3000,
	}),
	greet: false,
};

const gameServer = new Server(colyseusOptions);

// ==================== 房间注册 ====================

// 战斗房间 - 启用实时房间列表
gameServer.define("battle", BattleRoom).enableRealtimeListing();

// 存档管理房间
gameServer.define("system_save", SaveRoom);

// 系统房间 - 用于房间列表等系统功能
gameServer.define("system", SystemRoom);

console.log("[Server] Rooms registered: battle, system_save, system");

// ==================== 错误处理 ====================

process.on("uncaughtException", (error) => {
	console.error("[Server] Uncaught Exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
});

// ==================== 启动服务器 ====================

gameServer
	.listen(Number(PORT))
	.then(() => {
		console.log("");
		console.log("=========================================================");
		console.log("                    STFCS Server Ready                   ");
		console.log("=========================================================");
		console.log(`  WebSocket: ws://localhost:${PORT}`);
		console.log(`  Health:    http://localhost:${PORT}/health`);
		console.log(`  Monitor:   http://localhost:${PORT}/colyseus`);
		console.log("=========================================================");
		console.log("");
	})
	.catch((error) => {
		console.error("[Server] Failed to start:", error);
		process.exit(1);
	});
