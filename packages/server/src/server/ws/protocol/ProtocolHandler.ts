/**
 * 协议处理器
 * 处理WebSocket协议消息的路由和处理
 */

import type { WebSocket } from "ws";
import { createLogger } from "../../../infra/simple-logger.js";
import type { ConnectionManager } from "../connection.js";
import type { RoomManager } from "../../rooms/RoomManager.js";

import type {
  Message,
  RequestMessage,
  ResponseMessage,
  ErrorMessage,
  createMessage,
  createErrorMessage,
  parseMessage,
  serializeMessage,
  PROTOCOL_VERSION,
} from "../protocol.js";

import { GameCommandHandler } from "./GameCommandHandler.js";
import { RoomProtocolHandler } from "./RoomProtocolHandler.js";


/**
 * 协议处理器配置
 */
export interface ProtocolHandlerConfig {
  /** 连接管理器 */
  connectionManager: ConnectionManager;
  /** 房间管理器 */
  roomManager: RoomManager;
  /** 心跳间隔（毫秒） */
  heartbeatInterval?: number;
  /** 心跳超时（毫秒） */
  heartbeatTimeout?: number;
}

/**
 * 会话状态
 */
export interface SessionState {
  /** 会话ID */
  sessionId: string;
  /** 最后活动时间 */
  lastActivity: number;
  /** 心跳序列号 */
  heartbeatSequence: number;
  /** 最后心跳时间 */
  lastHeartbeat: number;
  /** 会话元数据 */
  metadata: Record<string, any>;
}

/**
 * 协议处理器
 */
export class ProtocolHandler {
  private connectionManager: ConnectionManager;
  private roomManager: RoomManager;
  private logger = createLogger("protocol-handler");
  
  private sessions = new Map<string, SessionState>();
  private gameCommandHandler: GameCommandHandler;
  private roomProtocolHandler: RoomProtocolHandler;
  
  private heartbeatInterval: number;
  private heartbeatTimeout: number;
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(config: ProtocolHandlerConfig) {
    this.connectionManager = config.connectionManager;
    this.roomManager = config.roomManager;
    this.heartbeatInterval = config.heartbeatInterval || 30000;
    this.heartbeatTimeout = config.heartbeatTimeout || 60000;
    
    this.gameCommandHandler = new GameCommandHandler(this.connectionManager, this.roomManager);
    this.roomProtocolHandler = new RoomProtocolHandler(this.roomManager);
    
    this.startHeartbeatCheck();
  }

  // ==================== 会话管理 ====================

  /**
   * 创建新会话
   */
  createSession(connectionId: string): SessionState {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const session: SessionState = {
      sessionId,
      lastActivity: now,
      heartbeatSequence: 0,
      lastHeartbeat: now,
      metadata: {},
    };
    
    this.sessions.set(connectionId, session);
    this.logger.debug("Session created", { connectionId, sessionId });
    
    return session;
  }

  /**
   * 获取会话
   */
  getSession(connectionId: string): SessionState | undefined {
    return this.sessions.get(connectionId);
  }

  /**
   * 更新会话活动
   */
  updateSessionActivity(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * 更新会话心跳
   */
  updateSessionHeartbeat(connectionId: string, sequence: number): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      session.lastHeartbeat = Date.now();
      session.heartbeatSequence = sequence;
    }
  }

  /**
   * 删除会话
   */
  deleteSession(connectionId: string): void {
    const session = this.sessions.get(connectionId);
    if (session) {
      this.logger.debug("Session deleted", { connectionId, sessionId: session.sessionId });
      this.sessions.delete(connectionId);
    }
  }

  // ==================== 消息处理 ====================

  /**
   * 处理消息
   */
  async handleMessage(connectionId: string, data: Buffer): Promise<void> {
    this.updateSessionActivity(connectionId);
    
    const connection = this.connectionManager.getConnection(connectionId);
    if (!connection) {
      this.logger.warn("Message from unknown connection", { connectionId });
      return;
    }

    // 解析消息
    const message = parseMessage(data.toString());
    if (!message) {
      this.sendError(connectionId, "PARSE_ERROR", "消息解析失败");
      return;
    }

    // 验证协议版本
    if (message.version !== PROTOCOL_VERSION) {
      this.sendError(
        connectionId,
        "VERSION_MISMATCH",
        `协议版本不匹配，客户端: ${message.version}, 服务端: ${PROTOCOL_VERSION}`,
        (message as RequestMessage).id
      );
      return;
    }

    // 处理消息
    try {
      await this.routeMessage(connectionId, message);
    } catch (error) {
      this.logger.error("Error handling message", error, {
        connectionId,
        messageType: message.type,
      });
      
      this.sendError(
        connectionId,
        "INTERNAL_ERROR",
        "处理消息时发生错误",
        (message as RequestMessage).id
      );
    }
  }

  /**
   * 路由消息
   */
  private async routeMessage(connectionId: string, message: Message): Promise<void> {
    
    switch (message.type) {
      // 连接层消息
      case "connect":
        await this.handleConnect(connectionId, message);
        break;
      case "heartbeat":
        await this.handleHeartbeat(connectionId, message);
        break;
      
      // 认证层消息（在无鉴权系统中已移除）
      // case "authenticate":
      //   await this.handleAuthenticate(connectionId, message);
      //   break;
      
      // 房间层消息
      case "list_rooms":
      case "create_room":
      case "join_room":
      case "leave_room":
        await this.roomProtocolHandler.handleMessage(connectionId, message);
        break;
      
      // 游戏命令消息
      case "game_command":
        // 在无鉴权系统中，从消息中提取用户名和房间ID
        const payload = (message as any).payload;
        if (!payload || !payload.username) {
          this.sendError(
            connectionId,
            "USERNAME_REQUIRED",
            "用户名是必需的",
            (message as RequestMessage).id
          );
          return;
        }
        
        // 需要从房间管理器获取用户所在的房间ID
        // 这里简化处理，假设payload中包含roomId
        const roomId = payload.roomId;
        if (!roomId) {
          this.sendError(
            connectionId,
            "ROOM_ID_REQUIRED",
            "房间ID是必需的",
            (message as RequestMessage).id
          );
          return;
        }
        
        await this.gameCommandHandler.handleCommand(
          payload.username,
          roomId,
          message
        );
        break;
      
      // 数据同步消息
      case "data_sync_request":
        await this.handleDataSyncRequest(connectionId, message);
        break;
      
      default:
        this.sendError(
          connectionId,
          "UNKNOWN_MESSAGE_TYPE",
          `未知的消息类型: ${message.type}`,
          (message as RequestMessage).id
        );
    }
  }

  // ==================== 连接层消息处理 ====================

  /**
   * 处理连接消息
   */
  private async handleConnect(connectionId: string, message: any): Promise<void> {
    const { payload } = message;
    
    // 简化：直接处理连接消息，不进行验证

    // 创建会话
    const session = this.createSession(connectionId);
    
    // 发送连接确认
    const response = createMessage("connected", {
      serverId: "stfcs-server",
      serverVersion: "1.0.0",
      sessionId: session.sessionId,
      protocolVersion: PROTOCOL_VERSION,
      serverTime: Date.now(),
      features: [
        "rooms",
        "game_commands",
        "data_sync",
        "heartbeat",
        "schema_v2",
      ],
    }, message.id);
    
    this.sendMessage(connectionId, response);
    
    this.logger.info("Client connected", {
      connectionId,
      sessionId: session.sessionId,
      clientId: payload.clientId,
      clientVersion: payload.clientVersion,
    });
  }

  /**
   * 处理心跳消息
   */
  private async handleHeartbeat(connectionId: string, message: any): Promise<void> {
    const { payload } = message;
    
    // 简化：直接处理心跳消息，不进行验证

    // 更新会话心跳
    this.updateSessionHeartbeat(connectionId, payload.sequence);
    
    // 发送心跳响应
    const now = Date.now();
    const latency = now - payload.clientTime;
    
    const response = createMessage("heartbeat_response", {
      clientTime: payload.clientTime,
      serverTime: now,
      latency,
      sequence: payload.sequence,
    }, message.id);
    
    this.sendMessage(connectionId, response);
  }

  // ==================== 认证层消息处理 ====================
  // 在无鉴权系统中，认证层已被移除
  // 用户只需提供用户名即可加入游戏

  // ==================== 数据同步处理 ====================

  /**
   * 处理数据同步请求
   */
  private async handleDataSyncRequest(connectionId: string, message: any): Promise<void> {
    const { payload } = message;
    
    // 简化：直接处理数据同步请求，不进行验证

    // TODO: 实现实际的数据同步逻辑
    // 这里返回空数据，实际应该从data包加载
    
    const response = createMessage("data_sync_response", {
      dataType: payload.dataType,
      data: {
        ships: [],
        weapons: [],
        presets: [],
      },
      timestamp: Date.now(),
      syncId: `sync_${Date.now()}`,
    }, message.id);
    
    this.sendMessage(connectionId, response);
  }

  // ==================== 消息发送 ====================

  /**
   * 发送消息
   */
  sendMessage(connectionId: string, message: Message): void {
    try {
      const data = serializeMessage(message);
      const connection = this.connectionManager.getConnection(connectionId);
      
      if (connection && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(data);
      }
    } catch (error) {
      this.logger.error("Failed to send message", error, {
        connectionId,
        messageType: message.type,
      });
    }
  }

  /**
   * 发送错误消息
   */
  sendError(connectionId: string, code: string, message: string, requestId?: string): void {
    const errorMessage = createErrorMessage(code, message, undefined, requestId);
    this.sendMessage(connectionId, errorMessage);
  }

  /**
   * 广播消息到房间
   */
  broadcastToRoom(roomId: string, message: Message): void {
    for (const [connectionId, session] of this.sessions.entries()) {
      if (session.roomId === roomId) {
        this.sendMessage(connectionId, message);
      }
    }
  }

  // ==================== 心跳检查 ====================

  /**
   * 启动心跳检查
   */
  private startHeartbeatCheck(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();
    }, this.heartbeatInterval);
  }

  /**
   * 检查心跳
   */
  private checkHeartbeats(): void {
    const now = Date.now();
    const timeoutConnections: string[] = [];

    for (const [connectionId, session] of this.sessions.entries()) {
      if (now - session.lastHeartbeat > this.heartbeatTimeout) {
        timeoutConnections.push(connectionId);
      }
    }

    // 关闭超时连接
    for (const connectionId of timeoutConnections) {
      this.logger.warn("Closing timeout connection", { connectionId });
      const connection = this.connectionManager.getConnection(connectionId);
      if (connection) {
        connection.ws.close(1001, "Heartbeat timeout");
      }
      this.deleteSession(connectionId);
    }
  }

  // ==================== 清理 ====================

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
    
    this.sessions.clear();
    this.logger.info("Protocol handler cleaned up");
  }
}