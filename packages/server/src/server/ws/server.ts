/**
 * 纯WebSocket服务器入口
 */

import { WebSocketServer, WebSocket } from "ws";
import { createLogger } from "../../infra/simple-logger.js";
import { ConnectionManager } from "./connection.js";
import type { IncomingMessage } from "http";

export interface WSServerOptions {
  port: number;
  pingInterval?: number;
  pingTimeout?: number;
  maxPayload?: number;
}

/** 纯WebSocket服务器 */
export class WSServer {
  private wss: WebSocketServer;
  private connectionManager: ConnectionManager;
  private logger = createLogger("ws-server");

  constructor(options: WSServerOptions) {
    const {
      port,
      pingInterval = 30000,
      pingTimeout = 10000,
      maxPayload = 10 * 1024 * 1024, // 10MB
    } = options;

    this.wss = new WebSocketServer({
      port,
      maxPayload,
    });
    
    this.logger.info(`Pure WebSocket server listening on port ${port}`);
    this.connectionManager = new ConnectionManager();

    this.setupEventHandlers();
    this.startHealthCheck(pingInterval, pingTimeout);
  }

  /** 设置事件处理器 */
  private setupEventHandlers(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error: Error) => {
      this.logger.error("WebSocket server error", error);
    });

    this.wss.on("close", () => {
      this.logger.info("WebSocket server closed");
    });
  }

  /** 处理新连接 */
  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientIp = req.socket.remoteAddress || "unknown";
    const connectionId = this.connectionManager.addConnection(ws, clientIp);

    this.logger.info(`New connection established`, {
      connectionId,
      clientIp,
      totalConnections: this.connectionManager.getConnectionCount(),
    });

    // 设置消息处理器
    ws.on("message", (data: Buffer) => {
      this.handleMessage(connectionId, data);
    });

    // 设置关闭处理器
    ws.on("close", (code: number, reason: Buffer) => {
      this.handleClose(connectionId, code, reason.toString());
    });

    // 设置错误处理器
    ws.on("error", (error: Error) => {
      this.handleError(connectionId, error);
    });

    // 发送欢迎消息
    this.sendWelcome(connectionId);
  }

  /** 处理消息 */
  private handleMessage(connectionId: string, data: Buffer): void {
    try {
      const message = JSON.parse(data.toString());
      this.connectionManager.handleMessage(connectionId, message);
    } catch (error) {
      this.logger.warn(`Failed to parse message from ${connectionId}`, { error: String(error) });
      this.connectionManager.sendError(connectionId, "INVALID_MESSAGE", "消息格式错误");
    }
  }

  /** 处理连接关闭 */
  private handleClose(connectionId: string, code: number, reason: string): void {
    this.connectionManager.removeConnection(connectionId);
    
    this.logger.info(`Connection closed`, {
      connectionId,
      code,
      reason: reason || "No reason",
      totalConnections: this.connectionManager.getConnectionCount(),
    });
  }

  /** 处理错误 */
  private handleError(connectionId: string, error: Error): void {
    this.logger.error(`Connection error`, error, {
      connectionId,
    });

    this.connectionManager.removeConnection(connectionId);
  }

  /** 发送欢迎消息 */
  private sendWelcome(connectionId: string): void {
    this.connectionManager.send(connectionId, {
      type: "WELCOME",
      payload: {
        connectionId,
        serverTime: Date.now(),
        protocolVersion: "1.0",
        features: ["rooms", "matchmaking", "chat"],
      },
    });
  }

  /** 启动健康检查 */
  private startHealthCheck(pingInterval: number, pingTimeout: number): void {
    setInterval(() => {
      this.connectionManager.healthCheck(pingTimeout);
    }, pingInterval);
  }

  /** 广播消息到所有连接 */
  broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  /** 获取连接统计 */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    rooms: number;
  } {
    return {
      totalConnections: this.connectionManager.getConnectionCount(),
      activeConnections: this.connectionManager.getActiveConnectionCount(),
      rooms: this.connectionManager.getRoomCount(),
    };
  }

  /** 关闭服务器 */
  close(): Promise<void> {
    return new Promise((resolve) => {
      // 关闭所有连接
      this.wss.clients.forEach((client) => {
        client.close(1000, "Server shutdown");
      });

      // 关闭服务器
      this.wss.close(() => {
        this.logger.info("WebSocket server shutdown complete");
        resolve();
      });
    });
  }
}