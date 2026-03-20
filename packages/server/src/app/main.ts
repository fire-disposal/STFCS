import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import path from "path";
import type { WSMessage } from "@vt/shared/ws";
import Fastify, { FastifyInstance, type FastifyError } from "fastify";
import { PlayerService } from "../application/player/PlayerService";
import { SelectionService } from "../application/selection/SelectionService";
import { ShipService } from "../application/ship/ShipService";
import { FactionService } from "../application/faction/FactionService";
import { FactionTurnService } from "../application/turn/FactionTurnService";
import { config } from "../config";
import { DomainEventAggregator } from "../infrastructure/events";
import { EventBus } from "@vt/shared/events";
import { MessageHandler } from "../infrastructure/ws/MessageHandler";
import { RoomManager } from "../infrastructure/ws/RoomManager";
import { WSServer } from "../infrastructure/ws/WSServer";

export interface ServerOptions {
	httpPort?: number;
	wsPort?: number;
	corsOrigins?: string[];
}

export class Application {
	private _fastify: FastifyInstance;
	private _wsServer?: WSServer;
	private _roomManager: RoomManager;
	private _messageHandler?: MessageHandler;
	private _playerService: PlayerService;
	private _selectionService: SelectionService;
	private _shipService: ShipService;
	private _factionService: FactionService;
	private _factionTurnService: FactionTurnService;
	private _domainEventAggregator?: DomainEventAggregator;
	private _eventBus?: EventBus;

	constructor(options: ServerOptions = {}) {
		this._fastify = Fastify({
			logger: {
				level: config.logLevel,
			},
		});

		this._roomManager = new RoomManager(config.maxPlayersPerRoom);
		this._playerService = new PlayerService();
		this._selectionService = new SelectionService();
		this._shipService = new ShipService();
		this._factionService = new FactionService();
		this._factionTurnService = new FactionTurnService(this._factionService);
		// _eventBusManager 将在 _initializeWS 中初始化（需要 wsServer）
	}

	async initialize(): Promise<void> {
		await this._setupCors();

		// Serve client static assets if present
		try {
			const publicDir = path.resolve(process.cwd(), "packages/server/dist/public");
			this._fastify.register(fastifyStatic, {
				root: publicDir,
				prefix: "/",
				index: "index.html",
			});

			// SPA fallback to index.html for client-side routing
			this._fastify.setNotFoundHandler((request, reply) => {
				reply.sendFile("index.html");
			});
		} catch (err) {
			this._fastify.log.info("No static client files found (skipping static serve)");
		}
		await this._setupHealthCheck();
		await this._setupErrorHandler();

		this._initializeServices();
		this._initializeWS();
		this._initializeEventBus();
	}

	async start(): Promise<void> {
		const httpPort = config.httpPort;
		await this._fastify.listen({ port: httpPort, host: "0.0.0.0" });
		this._fastify.log.info(`HTTP server listening on port ${httpPort}`);
	}

	async stop(): Promise<void> {
		if (this._domainEventAggregator) {
			this._domainEventAggregator.stop();
		}
		if (this._wsServer) {
			this._wsServer.close();
		}
		await this._fastify.close();
	}

	get fastify(): FastifyInstance {
		return this._fastify;
	}

	get wsServer(): WSServer | undefined {
		return this._wsServer;
	}

	get roomManager(): RoomManager {
		return this._roomManager;
	}

	get playerService(): PlayerService {
		return this._playerService;
	}

	get shipService(): ShipService {
		return this._shipService;
	}

	private async _setupCors(): Promise<void> {
		await this._fastify.register(fastifyCors, {
			origin: config.corsOrigins,
			methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
			allowedHeaders: ["Content-Type", "Authorization"],
			credentials: true,
		});
	}

	private async _setupHealthCheck(): Promise<void> {
		this._fastify.get("/health", async () => {
			return {
				status: "ok",
				timestamp: Date.now(),
				uptime: process.uptime(),
			};
		});
	}

	private async _setupErrorHandler(): Promise<void> {
		this._fastify.setErrorHandler((error: FastifyError, request, reply) => {
			this._fastify.log.error(error);

			reply.status(error.statusCode ?? 500).send({
				error: {
					code: error.name,
					message: error.message,
					statusCode: error.statusCode ?? 500,
				},
			});
		});
	}

	private _initializeServices(): void {
		this._playerService.setRoomManager(this._roomManager);
		this._selectionService.setRoomManager(this._roomManager);
		this._shipService.setRoomManager(this._roomManager);
		this._factionService.setRoomManager(this._roomManager);
		this._factionTurnService.setRoomManager(this._roomManager);
	}

	private _initializeWS(): void {
		this._wsServer = new WSServer({
			port: config.wsPort,
			onConnect: (clientId: string) => {
				this._fastify.log.info(`Client connected: ${clientId}`);
			},
			onDisconnect: (clientId: string) => {
				this._fastify.log.info(`Client disconnected: ${clientId}`);
				this._handleClientDisconnect(clientId);
			},
			onMessage: async (clientId: string, message: WSMessage) => {
				if (this._messageHandler) {
					await this._messageHandler.handleMessage(clientId, message);
				}
			},
		});

		this._roomManager.setWSServer(this._wsServer);
		this._playerService.setWSServer(this._wsServer);
		this._selectionService.setWSServer(this._wsServer);
		this._shipService.setWSServer(this._wsServer);
		this._factionService.setWSServer(this._wsServer);
		this._factionTurnService.setWSServer(this._wsServer);

		this._messageHandler = new MessageHandler({
			roomManager: this._roomManager,
			playerService: this._playerService,
			selectionService: this._selectionService,
			shipService: this._shipService,
			factionService: this._factionService,
			factionTurnService: this._factionTurnService,
			wsServer: this._wsServer,
		});

		this._fastify.log.info(`WebSocket server listening on port ${config.wsPort}`);
	}

	private _initializeEventBus(): void {
		// 创建全局事件总线
		this._eventBus = new EventBus();

		// 创建领域事件聚合器，订阅领域事件并广播到 WS
		if (this._wsServer) {
			this._domainEventAggregator = new DomainEventAggregator(
				this._eventBus,
				this._wsServer,
				this._roomManager as any, // 类型兼容性问题，暂时使用 as any
				{
					roomId: 'global', // 全局房间
					enableLogging: process.env.NODE_ENV === 'development',
				}
			);
			this._domainEventAggregator.start();
			this._fastify.log.info("Event bus initialized with DomainEventAggregator");
		}
	}

	private async _handleClientDisconnect(clientId: string): Promise<void> {
		const player = this._playerService.getPlayer(clientId);
		if (player) {
			const room = this._roomManager.getPlayerRoom(clientId);
			if (room) {
				await this._playerService.leave(clientId, room.id);
				// 清理玩家的选中状态
				this._selectionService.handlePlayerLeave(clientId, room.id);
				// 清理玩家的阵营数据
				this._factionService.removePlayer(room.id, clientId);
			}
		}
	}
}

export const createApplication = (options: ServerOptions = {}): Application => {
	return new Application(options);
};

export default Application;

// Server startup
const startServer = async () => {
	try {
		console.log("Starting STFCS server...");
		console.log("Environment:", process.env.NODE_ENV || "development");

		const app = createApplication();
		await app.initialize();
		await app.start();

		console.log("Server started successfully!");
		console.log(`HTTP server: http://localhost:${config.httpPort}`);
		console.log(`WebSocket server: ws://localhost:${config.wsPort}`);

		// Handle graceful shutdown
		const shutdown = async () => {
			console.log("Shutting down server...");
			await app.stop();
			process.exit(0);
		};

		process.on("SIGINT", shutdown);
		process.on("SIGTERM", shutdown);
	} catch (error) {
		console.error("Failed to start server:", error);
		process.exit(1);
	}
};

// Always start server when this file is imported/run
// This ensures the server starts when using tsx watch
startServer();
