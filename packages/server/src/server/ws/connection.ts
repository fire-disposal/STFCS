/**
 * 简化的 WebSocket 连接管理器
 *
 * 职责：连接管理 + 消息路由
 */

import type { WebSocket } from "ws";
import { createLogger } from "../../infra/simple-logger.js";
import { parseMsg, serializeMsg, MsgType, errMsg } from "./protocol.js";
import type { WSMessage } from "./protocol.js";

/** 连接状态 */
export interface Connection {
	ws: WebSocket;
	id: string;
	ip: string;
	playerName: string;
	roomId: string | undefined;
	userId: string | undefined;
	lastActivity: number;
}

/** 消息处理器 */
export interface MessageHandler {
	(connection: Connection, message: WSMessage): void | Promise<void>;
}

/** 连接管理器 */
export class ConnectionManager {
	private connections = new Map<string, Connection>();
	private handlers = new Map<string, MessageHandler>();
	private logger = createLogger("connection");

	// ==================== 连接管理 ====================

	addConnection(ws: WebSocket, ip: string, playerName: string): string {
		const id = `conn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		const conn: Connection = {
			ws,
			id,
			ip,
			playerName,
			roomId: undefined,
			userId: undefined,
			lastActivity: Date.now(),
		};
		this.connections.set(id, conn);
		this.logger.info(`Connected: ${playerName} (${id})`);
		return id;
	}

	removeConnection(id: string): void {
		const conn = this.connections.get(id);
		if (conn) {
			this.connections.delete(id);
			this.logger.info(`Disconnected: ${conn.playerName} (${id})`);
		}
	}

	getConnection(id: string): Connection | undefined {
		return this.connections.get(id);
	}

	getAllConnections(): Connection[] {
		return Array.from(this.connections.values());
	}

	getRoomConnections(roomId: string): Connection[] {
		return this.getAllConnections().filter((c) => c.roomId === roomId);
	}

	// ==================== 消息路由 ====================

	registerHandler(type: string, handler: MessageHandler): void {
		this.handlers.set(type, handler);
	}

	registerHandlers(types: string[], handler: MessageHandler): void {
		for (const type of types) {
			this.handlers.set(type, handler);
		}
	}

	handleMessage(id: string, data: string | Buffer): void {
		const conn = this.connections.get(id);
		if (!conn) return;

		conn.lastActivity = Date.now();

		const message = parseMsg(data.toString());
		if (!message) {
			this.sendError(id, "PARSE_ERROR", "Invalid message format");
			return;
		}

		// 心跳直接处理
		if (message.type === MsgType.HEARTBEAT) {
			this.handleHeartbeat(conn, message);
			return;
		}

		const handler = this.handlers.get(message.type);
		if (!handler) {
			this.sendError(id, "UNKNOWN_TYPE", `Unknown message type: ${message.type}`, message.id);
			return;
		}

		try {
			const result = handler(conn, message);
			if (result instanceof Promise) {
				result.catch((err) => {
					this.logger.error(`Handler error [${message.type}]:`, err);
					this.sendError(id, "HANDLER_ERROR", "Internal error", message.id);
				});
			}
		} catch (err) {
			this.logger.error(`Sync handler error [${message.type}]:`, err);
			this.sendError(id, "HANDLER_ERROR", "Internal error", message.id);
		}
	}

	// ==================== 发送工具 ====================

	send(id: string, message: WSMessage): boolean {
		const conn = this.connections.get(id);
		if (!conn || conn.ws.readyState !== 1) return false;
		try {
			conn.ws.send(serializeMsg(message));
			return true;
		} catch {
			return false;
		}
	}

	sendError(id: string, code: string, message: string, requestId?: string): boolean {
		return this.send(id, errMsg(code, message, requestId));
	}

	broadcast(message: WSMessage, excludeId?: string): void {
		const data = serializeMsg(message);
		for (const [id, conn] of this.connections) {
			if (excludeId && id === excludeId) continue;
			if (conn.ws.readyState === 1) {
				try {
					conn.ws.send(data);
				} catch {
					// ignore
				}
			}
		}
	}

	broadcastToRoom(roomId: string, message: WSMessage, excludeId?: string): void {
		for (const [id, conn] of this.connections) {
			if (conn.roomId !== roomId) continue;
			if (excludeId && id === excludeId) continue;
			if (conn.ws.readyState === 1) {
				try {
					conn.ws.send(serializeMsg(message));
				} catch {
					// ignore
				}
			}
		}
	}

	// ==================== 私有方法 ====================

	private handleHeartbeat(conn: Connection, message: WSMessage): void {
		const payload = message.payload as { clientTime?: number; sequence?: number };
		this.send(conn.id, {
			type: MsgType.HEARTBEAT_ACK,
			payload: {
				clientTime: payload.clientTime || Date.now(),
				serverTime: Date.now(),
				latency: Date.now() - (payload.clientTime || Date.now()),
				sequence: payload.sequence || 0,
			},
		});
	}
}
