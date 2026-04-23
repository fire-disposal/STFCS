/**
 * STFCS Socket.IO 服务器入口
 */

import { createServer } from "http";
import type { IncomingMessage, ServerResponse } from "http";
import { Server as IOServer } from "socket.io";
import { extname, resolve } from "path";
import { fileURLToPath } from "url";
import { readFile } from "fs/promises";
import { createLogger } from "./infra/simple-logger.js";
import { RoomManager } from "./server/rooms/RoomManager.js";
import { setupSocketIO } from "./server/socketio/handlers.js";
import { assetService } from "./services/AssetService.js";

const logger = createLogger("server");

interface ServerConfig {
	port: number;
	corsOrigin?: string;
}

const DEFAULT_CONFIG: ServerConfig = {
	port: 3001,
	corsOrigin: "*",
};

const PUBLIC_DIR = resolve(fileURLToPath(new URL(".", import.meta.url)), "public");

const MIME_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".ttf": "font/ttf",
};

function getContentType(path: string): string {
	return MIME_TYPES[extname(path).toLowerCase()] ?? "application/octet-stream";
}

function safePublicPath(urlPath: string): string {
	const decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
	const normalized = decoded === "/" ? "/index.html" : decoded;
	const filePath = resolve(PUBLIC_DIR, `.${normalized}`);
	if (!filePath.startsWith(PUBLIC_DIR)) {
		return resolve(PUBLIC_DIR, "index.html");
	}
	return filePath;
}

async function sendFile(res: ServerResponse, path: string): Promise<boolean> {
	try {
		const body = await readFile(path);
		res.statusCode = 200;
		res.setHeader("Content-Type", getContentType(path));
		res.end(body);
		return true;
	} catch {
		return false;
	}
}

async function handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
	const reqUrl = req.url ?? "/";

	if (reqUrl === "/health") {
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json");
		res.end(JSON.stringify({ ok: true }));
		return;
	}

	if (reqUrl.startsWith("/socket.io/")) {
		return;
	}

	const requestedPath = safePublicPath(reqUrl);
	if (await sendFile(res, requestedPath)) {
		return;
	}

	if (await sendFile(res, resolve(PUBLIC_DIR, "index.html"))) {
		return;
	}

	res.statusCode = 404;
	res.end("Not Found");
}

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
			await assetService.initialize();

			this.httpServer = createServer((req, res) => {
				void handleHttpRequest(req, res);
			});
			this.io = new IOServer(this.httpServer, {
				cors: { origin: this.config.corsOrigin },
				maxHttpBufferSize: 10 * 1024 * 1024,
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

function parsePort(raw: string | undefined, fallback: number): number {
	if (!raw) return fallback;
	const parsed = Number.parseInt(raw, 10);
	if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
		return fallback;
	}
	return parsed;
}

// 直接运行时启动（兼容 Windows/Unix 路径差异）
const isDirectRun = (() => {
	const entryPath = process.argv[1];
	if (!entryPath) return false;

	return resolve(fileURLToPath(import.meta.url)) === resolve(entryPath);
})();

if (isDirectRun) {
	const directRunConfig: Partial<ServerConfig> = {
		port: parsePort(process.env["PORT"], DEFAULT_CONFIG.port),
	};
	const corsOrigins = process.env["CORS_ORIGINS"];
	if (corsOrigins) {
		directRunConfig.corsOrigin = corsOrigins;
	}

	const server = new STFCServer(directRunConfig);
	server.start().catch((error) => {
		logger.error("Failed to start server", error);
		process.exit(1);
	});
}

// ==================== 导出 ====================
export { createLogger } from "./infra/simple-logger.js";
export { RoomManager, Room, type RoomTransportCallbacks } from "./server/rooms/index.js";
export { MutativeStateManager } from "./core/state/index.js";

export {
	PresetService,
	ShipBuildService,
	WeaponService,
	ComponentService,
	componentService,
	ModifierService,
	modifierService,
	AssetService,
	PlayerInfoService,
	PlayerProfileService,
	SimpleObjectCreationService,
} from "./services/index.js";

export { setupSocketIO, createRpcRegistry, type RpcContext } from "./server/socketio/index.js";
