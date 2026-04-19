/**
 * 简化的 WebSocket 服务器入口
 */

import { WebSocketServer, WebSocket } from "ws";
import { createLogger } from "../../infra/simple-logger.js";
import { ConnectionManager } from "./connection.js";
import { RoomManager } from "../rooms/RoomManager.js";
import { MessageRouter } from "./protocol/MessageRouter.js";
import { MemoryStorage } from "../../storage/MemoryStorage.js";
import { PlayerProfileService } from "../../services/PlayerProfileService.js";
import type { IncomingMessage } from "http";
import { MsgType } from "./protocol.js";

export interface WSServerOptions {
	port: number;
	maxPayload?: number;
}

/** 纯 WebSocket 服务器 */
export class WSServer {
  private wss: WebSocketServer;
  private connMgr: ConnectionManager;
  private roomMgr: RoomManager;
  private storage: MemoryStorage;
  private profileService: PlayerProfileService;
  private router: MessageRouter;
  private logger = createLogger("ws-server");

  constructor(options: WSServerOptions) {
    const { port, maxPayload = 10 * 1024 * 1024 } = options;

    this.wss = new WebSocketServer({ port, maxPayload });
    this.logger.info(`WebSocket server on port ${port}`);

    // 初始化存储和服务
    this.storage = new MemoryStorage();
    this.profileService = new PlayerProfileService(this.storage);
    
    this.connMgr = new ConnectionManager();
    this.roomMgr = new RoomManager(this.connMgr);
    this.router = new MessageRouter(this.connMgr, this.roomMgr, this.profileService);

    this.setupHandlers();
  }

	/** 设置事件处理器 */
	private setupHandlers(): void {
		this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
			this.handleConnection(ws, req);
		});

		this.wss.on("error", (err: Error) => {
			this.logger.error("WS server error:", err);
		});
	}

	/** 处理新连接 */
	private handleConnection(ws: WebSocket, req: IncomingMessage): void {
		const ip = req.socket.remoteAddress || "unknown";
		const playerName = `Player_${Math.random().toString(36).slice(2, 6)}`;
		const id = this.connMgr.addConnection(ws, ip, playerName);

		this.logger.info(`Connected: ${playerName} (${id})`);

		// 发送欢迎消息
		this.connMgr.send(id, {
			type: MsgType.CONNECTED,
			payload: {
				serverVersion: "1.0.0",
				sessionId: id,
				serverTime: Date.now(),
			},
		});

		// 消息处理
		ws.on("message", (data: Buffer) => {
			const conn = this.connMgr.getConnection(id);
			if (!conn) return;

			// 使用 connection manager 解析
			this.connMgr.handleMessage(id, data);
		});

		// 关闭处理
		ws.on("close", (_code: number, _reason: Buffer) => {
			this.connMgr.removeConnection(id);
		});

		ws.on("error", (_err: Error) => {
			this.connMgr.removeConnection(id);
		});
	}

	/** 启动服务器并设置路由 */
	start(): void {
		this.connMgr.handleMessage = (id: string, data: string | Buffer) => {
			const conn = this.connMgr.getConnection(id);
			if (!conn) return;

			conn.lastActivity = Date.now();

			const { parseMsg, MsgType } = require("./protocol.js");
			const message = parseMsg(data.toString());
			if (!message) {
				this.connMgr.sendError(id, "PARSE_ERROR", "Invalid message format");
				return;
			}

			if (message.type === MsgType.HEARTBEAT) {
				this.connMgr.send(id, {
					type: MsgType.HEARTBEAT_ACK,
					payload: {
						clientTime: (message.payload as { clientTime?: number }).clientTime || Date.now(),
						serverTime: Date.now(),
						latency: 0,
						sequence: (message.payload as { sequence?: number }).sequence || 0,
					},
				});
				return;
			}

			// 使用 router 路由消息
			this.router.route(conn, message);
		};
	}

	/** 广播消息 */
	broadcast(message: unknown): void {
		const data = JSON.stringify(message);
		for (const client of this.wss.clients) {
			if (client.readyState === WebSocket.OPEN) {
				client.send(data);
			}
		}
	}

	/** 获取统计 */
	getStats(): {
		totalConnections: number;
		totalRooms: number;
	} {
		return {
			totalConnections: this.connMgr.getAllConnections().length,
			totalRooms: this.roomMgr.getAllRooms().length,
		};
	}

	/** 关闭服务器 */
	close(): Promise<void> {
		return new Promise((resolve) => {
			for (const client of this.wss.clients) {
				client.close(1000, "Server shutdown");
			}
			this.wss.close(() => {
				this.logger.info("Server shutdown");
				resolve();
			});
		});
	}
}
