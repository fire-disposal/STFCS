/**
 * 对象创建WebSocket处理器
 * 处理游戏中动态创建对象的请求
 */

import type { Connection } from "../connection.js";
import type { ConnectionManager } from "../connection.js";
import type { RoomManager } from "../../rooms/RoomManager.js";
import type { WSMessage } from "../protocol.js";
import { MsgType } from "../protocol.js";
import { SimpleObjectCreationService } from "../../../services/SimpleObjectCreationService";

export class ObjectCreationHandler {
  private connMgr: ConnectionManager;
  private roomMgr: RoomManager;
  private objectService: SimpleObjectCreationService;
  
  constructor(connMgr: ConnectionManager, roomMgr: RoomManager) {
    this.connMgr = connMgr;
    this.roomMgr = roomMgr;
    this.objectService = new SimpleObjectCreationService();
  }
  
  /**
   * 处理对象创建请求
   */
  handleObjectCreate = (conn: Connection, msg: WSMessage): void => {
    if (!conn.roomId) {
      this.sendError(conn, 'NOT_IN_ROOM', 'Not in any room', msg.id);
      return;
    }
    
    if (!conn.userId) {
      this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
      return;
    }
    
    const payload = msg.payload as {
      objectType?: string;
      data?: Record<string, unknown>;
      position?: { x: number; y: number };
      faction?: string;
      ownerId?: string;
      sourceId?: string; // 来源ID（玩家档案中的舰船/武器ID）
    };
    
    // 验证请求
    if (!payload.objectType || !payload.data) {
      this.sendError(conn, 'INVALID_REQUEST', 'Missing objectType or data', msg.id);
      return;
    }
    
    const validation = this.objectService.validateRequest({
      objectType: payload.objectType,
      data: payload.data
    });
    
    if (!validation.valid) {
      this.sendError(conn, 'INVALID_REQUEST', validation.error || 'Invalid request', msg.id);
      return;
    }
    
    // 获取房间和游戏状态
    const room = this.roomMgr.getRoom(conn.roomId);
    if (!room) {
      this.sendError(conn, 'ROOM_NOT_FOUND', 'Room not found', msg.id);
      return;
    }
    
    const stateManager = room.getStateManager();
    const gameState = stateManager.getState();
    
    // 获取玩家信息
    const player = stateManager.getPlayer(conn.id) || stateManager.getPlayer(conn.userId);
    if (!player) {
      this.sendError(conn, 'PLAYER_NOT_FOUND', 'Player not found', msg.id);
      return;
    }
    
    // 创建者信息
    const creator = {
      id: conn.userId,
      role: (player.role === 'DM' ? 'dm' : 'player') as 'dm' | 'player',
      name: player.name || conn.userId
    };
    
    // 处理对象创建
    let result;
    
    if (payload.sourceId && (payload.objectType === 'ship' || payload.objectType === 'weapon')) {
      // 从玩家档案创建
      // 注意：这里需要玩家档案服务，简化实现中暂时不支持
      this.sendError(conn, 'NOT_IMPLEMENTED', 'Creating from player profile not yet implemented', msg.id);
      return;
    } else {
      // 直接创建对象
      const request: {
        objectType: string;
        data: Record<string, unknown>;
        position?: { x: number; y: number };
        faction?: string;
        ownerId?: string;
      } = {
        objectType: payload.objectType,
        data: payload.data,
      };
      
      if (payload.position) request.position = payload.position;
      if (payload.faction) request.faction = payload.faction;
      if (payload.ownerId) request.ownerId = payload.ownerId;
      
      result = this.objectService.createObject(
        request,
        gameState,
        creator
      );
    }
    
    if (!result.success) {
      this.sendError(conn, 'CREATION_FAILED', result.error || 'Object creation failed', msg.id);
      return;
    }
    
    // 将对象添加到游戏状态
    // 这里需要根据对象类型调用不同的方法
    this.addObjectToGameState(room, result.object!, payload.objectType);
    
    // 发送成功响应
    const response: any = {
      type: MsgType.OBJECT_CREATE,
      payload: {
        success: true,
        objectId: result.objectId,
        object: result.object
      }
    };
    
    if (msg.id) {
      response.id = msg.id;
    }
    
    this.connMgr.send(conn.id, response);
    
    // 注意：这里应该广播对象创建事件给房间内所有玩家
    // 简化实现中，暂时不实现广播
  };
  
  /**
   * 处理从玩家档案创建对象的请求
   */
  handleCreateFromProfile = (conn: Connection, msg: WSMessage): void => {
    if (!conn.roomId) {
      this.sendError(conn, 'NOT_IN_ROOM', 'Not in any room', msg.id);
      return;
    }
    
    if (!conn.userId) {
      this.sendError(conn, 'UNAUTHORIZED', 'User not authenticated', msg.id);
      return;
    }
    
    const payload = msg.payload as {
      objectType?: 'ship' | 'weapon';
      sourceId?: string; // 玩家档案中的ID
      position?: { x: number; y: number };
      faction?: string;
    };
    
    if (!payload.objectType || !payload.sourceId) {
      this.sendError(conn, 'INVALID_REQUEST', 'Missing objectType or sourceId', msg.id);
      return;
    }
    
    // 获取房间和游戏状态
    const room = this.roomMgr.getRoom(conn.roomId);
    if (!room) {
      this.sendError(conn, 'ROOM_NOT_FOUND', 'Room not found', msg.id);
      return;
    }
    
    const stateManager = room.getStateManager();
    
    // 获取玩家信息
    const player = stateManager.getPlayer(conn.id) || stateManager.getPlayer(conn.userId);
    if (!player) {
      this.sendError(conn, 'PLAYER_NOT_FOUND', 'Player not found', msg.id);
      return;
    }
    
    // 注意：这里需要玩家档案服务来获取玩家档案
    // 简化实现中，我们假设有一个getPlayerProfile方法
    this.sendError(conn, 'NOT_IMPLEMENTED', 'Creating from player profile requires profile service integration', msg.id);
  };
  
  /**
   * 将对象添加到游戏状态
   */
  private addObjectToGameState(room: any, object: any, objectType: string): void {
    const stateManager = room.getStateManager();
    
    // 根据对象类型调用不同的方法
    switch (objectType) {
      case 'ship':
        // 添加舰船到游戏状态
        if (object.data?.shipJson) {
          stateManager.addShipWithComponents(
            object.data.shipJson,
            object.position || { x: 0, y: 0 },
            0, // heading
            object.faction,
            object.ownerId
          );
        }
        break;
        
      case 'weapon':
        // 武器通常作为舰船组件添加，单独武器需要特殊处理
        // 简化实现中，武器需要附加到舰船上
        break;
        
      case 'obstacle':
        // 添加障碍物
        // 需要实现障碍物添加逻辑
        break;
        
      default:
        // 自定义对象
        console.log(`Created custom object: ${object.$id} of type ${objectType}`);
    }
  }
  

  
  /**
   * 发送错误响应
   */
  private sendError(conn: Connection, code: string, message: string, requestId?: string): void {
    this.connMgr.sendError(conn.id, code, message, requestId);
  }
}