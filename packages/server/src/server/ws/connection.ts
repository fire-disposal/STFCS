/**
 * 连接管理器
 */

import { WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../infra/simple-logger.js";
import { RoomManager } from "../rooms/RoomManager.js";

export interface Connection {
  id: string;
  ws: WebSocket;
  ip: string;
  connectedAt: number;
  lastActivity: number;
  roomId?: string;
  userId?: string;
  metadata: Record<string, any>;
}

export interface Message {
  type: string;
  payload: any;
  requestId?: string;
}

/** 连接管理器 */
export class ConnectionManager {
  private connections = new Map<string, Connection>();
  private roomManager: RoomManager;
  private logger = createLogger("connection-manager");

  constructor() {
    this.roomManager = new RoomManager(this);
  }

  /** 添加新连接 */
  addConnection(ws: WebSocket, ip: string): string {
    const connectionId = uuidv4();
    const now = Date.now();

    const connection: Connection = {
      id: connectionId,
      ws,
      ip,
      connectedAt: now,
      lastActivity: now,
      metadata: {},
    };

    this.connections.set(connectionId, connection);
    return connectionId;
  }

  /** 移除连接 */
  removeConnection(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // 清理资源
      if (connection.roomId && connection.userId) {
        // 通知房间管理器玩家离开
        this.roomManager.leaveRoom(connection.roomId, connection.userId);
        this.logger.debug(`Player left room`, {
          connectionId,
          roomId: connection.roomId,
          userId: connection.userId,
        });
      }
    }

    return this.connections.delete(connectionId);
  }

  /** 获取连接 */
  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  /** 更新连接活动时间 */
  updateActivity(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = Date.now();
    }
  }

  /** 加入房间 */
  joinRoom(connectionId: string, roomId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) return false;

    connection.roomId = roomId;
    
    this.logger.debug(`Connection joined room`, {
      connectionId,
      roomId,
    });

    return true;
  }

  /** 离开房间 */
  leaveRoom(connectionId: string): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.roomId) return false;

    const roomId = connection.roomId;
    delete connection.roomId;
    
    this.logger.debug(`Connection left room`, {
      connectionId,
      userId: connection.userId,
      roomId,
    });

    return true;
  }

  /** 处理消息 */
  handleMessage(connectionId: string, data: Buffer): void {
    this.updateActivity(connectionId);

    const connection = this.connections.get(connectionId);
    if (!connection) {
      this.logger.warn(`Message from unknown connection`, { connectionId });
      return;
    }

    // 解析消息
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (error) {
      this.logger.warn(`Failed to parse message`, error, {
        connectionId,
      });
      this.sendError(connectionId, "PARSE_ERROR", "消息解析失败");
      return;
    }

    // 验证消息格式
    if (!message || typeof message !== "object" || !message.type || typeof message.type !== "string") {
      this.sendError(connectionId, "INVALID_MESSAGE", "消息格式错误");
      return;
    }

    // 处理消息
    try {
      this.routeMessage(connection, message);
    } catch (error) {
      this.logger.error(`Error handling message`, error, {
        connectionId,
        messageType: message.type,
      });
      
      this.sendError(connectionId, "INTERNAL_ERROR", "处理消息时发生错误");
    }
  }

  /** 路由消息 */
  private routeMessage(connection: Connection, message: Message): void {
    const { type, payload, requestId } = message;

    switch (type) {
      case "AUTHENTICATE":
        this.handleAuthenticate(connection, payload, requestId);
        break;
      case "JOIN_ROOM":
        this.handleJoinRoom(connection, payload, requestId);
        break;
      case "LEAVE_ROOM":
        this.handleLeaveRoom(connection, payload, requestId);
        break;
      case "PING":
        this.handlePing(connection, requestId);
        break;
      default:
        // 其他消息转发到房间处理器
        if (connection.roomId) {
          this.forwardToRoom(connection, message);
        } else {
          this.sendError(connection.id, "NOT_IN_ROOM", "未加入任何房间");
        }
    }
  }

  /** 处理认证 */
  private handleAuthenticate(
    connection: Connection,
    payload: any,
    requestId?: string
  ): void {
    const { token, userId } = payload || {};

    if (!token || !userId) {
      this.sendError(connection.id, "INVALID_AUTH", "认证信息不完整", requestId);
      return;
    }

    // 简化认证：验证token格式
    if (typeof token !== "string" || token.length < 10) {
      this.sendError(connection.id, "INVALID_TOKEN", "无效的token", requestId);
      return;
    }

    // 认证成功
    connection.userId = userId;
    connection.metadata['authenticatedAt'] = Date.now();
    connection.metadata['userId'] = userId;

    this.send(connection.id, {
      type: "AUTHENTICATED",
      payload: { userId, authenticatedAt: Date.now() },
      ...(requestId && { requestId }),
    });
  }

  /** 处理加入房间 */
  private handleJoinRoom(
    connection: Connection,
    payload: any,
    requestId?: string
  ): void {
    const { roomId, playerName, username } = payload || {};
    if (!roomId || typeof roomId !== "string") {
      this.sendError(connection.id, "INVALID_ROOM", "房间ID无效", requestId);
      return;
    }

    if (!username || typeof username !== "string") {
      this.sendError(connection.id, "USERNAME_REQUIRED", "用户名是必需的", requestId);
      return;
    }

    // 离开当前房间（如果已加入）
    if (connection.roomId) {
      this.leaveRoom(connection.id);
    }

    // 通过房间管理器加入房间
    const success = this.roomManager.joinRoom(
      roomId,
      connection.id,
      username,
      playerName || username
    );
    
    if (!success) {
      this.sendError(connection.id, "JOIN_FAILED", "加入房间失败", requestId);
      return;
    }

    // 更新连接的房间信息
    connection.roomId = roomId;

    this.send(connection.id, {
      type: "ROOM_JOINED",
      payload: { 
        roomId, 
        joinedAt: Date.now(),
        playerName: playerName || connection.userId,
      },
      ...(requestId && { requestId }),
    });
  }

  /** 处理离开房间 */
  private handleLeaveRoom(
    connection: Connection,
    payload: any,
    requestId?: string
  ): void {
    if (!connection.roomId) {
      this.sendError(connection.id, "NOT_IN_ROOM", "未加入任何房间", requestId);
      return;
    }

    const success = this.leaveRoom(connection.id);
    if (!success) {
      this.sendError(connection.id, "LEAVE_FAILED", "离开房间失败", requestId);
      return;
    }

    this.send(connection.id, {
      type: "ROOM_LEFT",
      payload: { leftAt: Date.now() },
      ...(requestId && { requestId }),
    });
  }

  /** 处理ping */
  private handlePing(connection: Connection, requestId?: string): void {
    this.send(connection.id, {
      type: "PONG",
      payload: { serverTime: Date.now() },
      ...(requestId && { requestId }),
    });
  }

  /** 转发消息到房间 */
  private forwardToRoom(connection: Connection, message: Message): void {
    if (!connection.roomId || !connection.userId) {
      this.sendError(connection.id, "NOT_IN_ROOM", "未加入任何房间", message.requestId);
      return;
    }

    // 将消息转发到房间管理器
    this.roomManager.handlePlayerMessage(connection.roomId, connection.userId, message);
  }

  /** 发送消息 */
  send(connectionId: string, message: Message): void {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      const data = JSON.stringify(message);
      connection.ws.send(data);
    } catch (error) {
      this.logger.error(`Failed to send message`, error, {
        connectionId,
      });
    }
  }

  /** 发送错误消息 */
  sendError(
    connectionId: string,
    code: string,
    message: string,
    requestId?: string
  ): void {
    this.send(connectionId, {
      type: "ERROR",
      payload: { code, message },
      ...(requestId && { requestId }),
    });
  }

  /** 广播消息到房间 */
  broadcastToRoom(roomId: string, message: Message): void {
    for (const connection of this.connections.values()) {
      if (connection.roomId === roomId && connection.ws.readyState === WebSocket.OPEN) {
        this.send(connection.id, message);
      }
    }
  }

  /** 健康检查 */
  healthCheck(timeout: number): void {
    const now = Date.now();
    const timeoutConnections: string[] = [];

    for (const [connectionId, connection] of this.connections.entries()) {
      if (now - connection.lastActivity > timeout) {
        timeoutConnections.push(connectionId);
      }
    }

    // 关闭超时连接
    for (const connectionId of timeoutConnections) {
      this.logger.warn(`Closing timeout connection`, { connectionId });
      const connection = this.connections.get(connectionId);
      if (connection) {
        connection.ws.close(1001, "Connection timeout");
      }
      this.removeConnection(connectionId);
    }
  }

  /** 获取所有连接 */
  getAllConnections(): Map<string, Connection> {
    return this.connections;
  }

  /** 获取连接统计 */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /** 获取活跃连接数 */
  getActiveConnectionCount(): number {
    let count = 0;
    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        count++;
      }
    }
    return count;
  }

  /** 获取房间数（简化实现） */
  getRoomCount(): number {
    const rooms = new Set<string>();
    for (const connection of this.connections.values()) {
      if (connection.roomId) {
        rooms.add(connection.roomId);
      }
    }
    return rooms.size;
  }
}