/**
 * STFCS Socket.IO 服务器入口
 */

import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createLogger } from "./infra/simple-logger.js";
import { RoomManager } from "./server/rooms/RoomManager.js";
import { setupSocketIO } from "./server/socketio/handler.js";

const logger = createLogger("server");

interface ServerConfig {
	port: number;
	corsOrigin?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
	port: 3001,
	corsOrigin: "*",
};

export class STFCServer {
	private config: ServerConfig;
	private httpServer: ReturnType<typeof createServer> | null = null;
	private io: IOServer | null = null;
	private roomManager: RoomManager;
	private isShuttingDown = false;

	constructor(config: Partial<ServerConfig> = {}) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.roomManager = new RoomManager();
	}

	async start(): Promise<void> {
		try {
			this.httpServer = createServer();
			this.io = new IOServer(this.httpServer, {
				cors: { origin: this.config.corsOrigin },
				maxHttpBufferSize: 10 * 1024 * 1024, // 10MB
			});

			setupSocketIO(this.io, this.roomManager);

			this.httpServer.listen(this.config.port, () => {
				logger.info("STFCS Socket.IO server started", {
					port: this.config.port,
					env: process.env["NODE_ENV"] || "development",
				});
			});

			this.setupGracefulShutdown();
		} catch (error) {
			logger.error("Failed to start server", error);
			throw error;
		}
	}

	private setupGracefulShutdown(): void {
		const shutdown = async (signal: string) => {
			if (this.isShuttingDown) return;
			this.isShuttingDown = true;
			logger.info(`Received ${signal}, shutting down`);

			try {
				this.io?.close();
				this.httpServer?.close();
				this.roomManager.cleanupAllRooms();
				logger.info("Graceful shutdown completed");
				process.exit(0);
			} catch (error) {
				logger.error("Error during shutdown", error);
				process.exit(1);
			}
		};

		process.on("SIGTERM", () => shutdown("SIGTERM"));
		process.on("SIGINT", () => shutdown("SIGINT"));
		process.on("uncaughtException", (error) => {
			logger.error("Uncaught exception", error);
			shutdown("UNCAUGHT_EXCEPTION");
		});
	}

	getRoomManager(): RoomManager {
		return this.roomManager;
	}

	getStats() {
		return {
			rooms: this.roomManager.getStats(),
		};
	}
}

// 直接运行时启动（兼容 Windows/Unix 路径差异）
const isDirectRun = (() => {
	const entryPath = process.argv[1];
	if (!entryPath) return false;

	return resolve(fileURLToPath(import.meta.url)) === resolve(entryPath);
})();

if (isDirectRun) {
	const server = new STFCServer();
	server.start().catch((error) => {
		logger.error("Failed to start server", error);
		process.exit(1);
	});
}

// ==================== 导出 ====================
export { createLogger } from "./infra/simple-logger.js";
export { RoomManager, Room, type RoomTransportCallbacks } from "./server/rooms/index.js";
export { GameStateManager } from "./core/state/GameStateManager.js";
export { gameRuntime, GameRuntime } from "./runtime/index.js";
export { Match } from "./runtime/index.js";
export { TurnManager } from "./runtime/index.js";
export { shipDataManager, weaponDataManager, componentDataManager, modifierSystem } from "./data/index.js";
export { actionHandler, ActionHandler } from "./server/handlers/index.js";
export { broadcaster } from "./server/broadcast/index.js";
