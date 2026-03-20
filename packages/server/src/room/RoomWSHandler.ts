/**
 * WebSocket 消息处理器适配层
 *
 * 将新的 Room 框架与现有 WebSocket 基础设施集成
 */

import type { WebSocket } from 'ws';
import { RoomManager } from './RoomManager';
import { GameRoom } from './GameRoom';
import type {
  SyncMessage,
  StateUpdateMessage,
  EventMessage,
  OperationRequestMessage,
  OperationResponseMessage,
} from '@vt/shared/room';

// ==================== 类型定义 ====================

/** WebSocket 发送器 */
interface WSSender {
  sendTo: (clientId: string, message: unknown) => void;
}

/** 消息处理器选项 */
export interface RoomHandlerOptions {
  roomManager: RoomManager;
  wsServer: WSSender;
}

// ==================== RoomWSHandler ====================

/**
 * WebSocket 消息处理器
 *
 * 处理：
 * 1. 客户端连接/断开
 * 2. 操作请求
 * 3. 状态广播
 */
export class RoomWSHandler {
  private _roomManager: RoomManager;
  private _wsServer: WSSender;
  private _clientSockets: Map<string, WebSocket> = new Map();

  constructor(options: RoomHandlerOptions) {
    this._roomManager = options.roomManager;
    this._wsServer = options.wsServer;

    // 注册 GameRoom 类型
    this._roomManager.registerRoomType('game', GameRoom);
  }

  // ==================== 连接管理 ====================

  /**
   * 处理客户端连接
   */
  handleConnect(clientId: string, socket: WebSocket): void {
    this._clientSockets.set(clientId, socket);

    // 设置消息处理器
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this._handleMessage(clientId, message);
      } catch (error) {
        console.error(`[RoomWS] Failed to parse message from ${clientId}:`, error);
        this._sendError(clientId, 'PARSE_ERROR', 'Failed to parse message');
      }
    });

    socket.on('close', () => {
      this.handleDisconnect(clientId);
    });
  }

  /**
   * 处理客户端断开
   */
  handleDisconnect(clientId: string): void {
    this._clientSockets.delete(clientId);

    // 玩家离开房间
    const result = this._roomManager.leaveRoom(clientId);
    
    if (result.success && !result.roomEmpty) {
      const room = this._roomManager.getPlayerRoom(clientId);
      if (room) {
        // 广播玩家离开事件
        this._broadcastEvent(room.roomId, 'player.left', { playerId: clientId });
      }
    }
  }

  // ==================== 消息处理 ====================

  private _handleMessage(clientId: string, message: unknown): void {
    const msg = message as SyncMessage;

    switch (msg.type) {
      case 'OPERATION':
        this._handleOperation(clientId, msg as OperationRequestMessage);
        break;

      default:
        console.warn(`[RoomWS] Unknown message type: ${(msg as any).type}`);
    }
  }

  private async _handleOperation(
    clientId: string,
    message: OperationRequestMessage
  ): Promise<void> {
    const { operation, args, requestId } = message;
    const room = this._roomManager.getPlayerRoom(clientId);

    if (!room) {
      this._sendResponse(clientId, requestId, false, undefined, 'Not in a room');
      return;
    }

    try {
      const result = await room.execute(clientId, operation, ...args);

      // 发送响应
      this._sendResponse(clientId, requestId, result.success, result.result, result.error);

      // 广播状态更新
      if (result.broadcast) {
        this._broadcastState(room.roomId, result.broadcast, clientId);
      }

      // 广播事件
      if (result.events) {
        for (const event of result.events) {
          this._broadcastEvent(room.roomId, event.event, event.payload, clientId);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this._sendResponse(clientId, requestId, false, undefined, message);
    }
  }

  // ==================== 发送消息 ====================

  private _sendResponse(
    clientId: string,
    requestId: string,
    success: boolean,
    result?: unknown,
    error?: string
  ): void {
    const response: OperationResponseMessage = {
      type: 'OPERATION_RESPONSE',
      requestId,
      success,
      result,
      error,
      timestamp: Date.now(),
    };

    this._sendTo(clientId, response);
  }

  private _sendError(clientId: string, code: string, message: string): void {
    this._sendTo(clientId, {
      type: 'ERROR',
      code,
      message,
      timestamp: Date.now(),
    });
  }

  private _sendTo(clientId: string, message: unknown): void {
    const socket = this._clientSockets.get(clientId);
    if (socket && socket.readyState === 1) {
      socket.send(JSON.stringify(message));
    }
  }

  private _broadcastState(
    roomId: string,
    update: StateUpdateMessage,
    excludeClientId?: string
  ): void {
    const room = this._roomManager.getRoom(roomId);
    if (!room) return;

    for (const clientId of room.clientIds) {
      if (clientId !== excludeClientId) {
        this._sendTo(clientId, update);
      }
    }
  }

  private _broadcastEvent<T>(
    roomId: string,
    event: string,
    payload: T,
    excludeClientId?: string
  ): void {
    const room = this._roomManager.getRoom(roomId);
    if (!room) return;

    const message: EventMessage<T> = {
      type: 'EVENT',
      event,
      payload,
      timestamp: Date.now(),
    };

    for (const clientId of room.clientIds) {
      if (clientId !== excludeClientId) {
        this._sendTo(clientId, message);
      }
    }
  }

  // ==================== 房间操作 ====================

  /**
   * 创建房间
   */
  createRoom(roomId: string, creatorId: string, name?: string): GameRoom {
    const room = this._roomManager.createRoom(roomId, creatorId, { name }, 'game');
    
    // 添加创建者连接
    const socket = this._clientSockets.get(creatorId);
    if (socket) {
      room.addClient(creatorId, {
        sendTo: (id, msg) => this._sendTo(id, msg),
      });
    }

    return room as GameRoom;
  }

  /**
   * 加入房间
   */
  joinRoom(roomId: string, playerId: string, name: string): { success: boolean; error?: string } {
    const socket = this._clientSockets.get(playerId);
    if (!socket) {
      return { success: false, error: 'Client not connected' };
    }

    const result = this._roomManager.joinRoom(roomId, playerId, {
      sendTo: (id, msg) => this._sendTo(id, msg),
    });

    if (result.success && result.room) {
      // 执行加入操作
      result.room.execute(playerId, 'join', name);
      
      // 发送完整状态给新玩家
      this._sendTo(playerId, {
        type: 'STATE_UPDATE',
        version: result.room.version,
        diff: result.room.getSnapshot(),
        timestamp: Date.now(),
      });

      // 广播玩家加入事件
      this._broadcastEvent(roomId, 'player.joined', { playerId, name }, playerId);
    }

    return { success: !!result.room, error: result.error };
  }

  /**
   * 获取房间列表
   */
  getRoomList() {
    return this._roomManager.listRooms();
  }

  /**
   * 获取房间状态
   */
  getRoomState(roomId: string) {
    const room = this._roomManager.getRoom(roomId);
    return room?.getSnapshot();
  }
}