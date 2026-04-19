/**
 * 房间管理器
 */

import { createLogger } from "../../infra/simple-logger.js";
import { Room } from "./Room.js";
import type { ConnectionManager } from "../ws/connection.js";
import type { GameState } from "../../core/types/common.js";

export interface RoomManagerOptions {
  maxRooms?: number;
  roomCleanupDelay?: number;
  roomInactivityTimeout?: number;
}

/** 房间管理器 */
export class RoomManager {
  private rooms = new Map<string, Room>();
  private connectionManager: ConnectionManager;
  private logger = createLogger("room-manager");
  
  private options: Required<RoomManagerOptions>;

  constructor(
    connectionManager: ConnectionManager,
    options: RoomManagerOptions = {}
  ) {
    this.connectionManager = connectionManager;
    
    this.options = {
      maxRooms: 100,
      roomCleanupDelay: 30000, // 30秒
      roomInactivityTimeout: 300000, // 5分钟
      ...options,
    };

    this.startCleanupCycle();
  }

  // ==================== 房间创建和管理 ====================

  /** 创建新房间 */
  createRoom(options: {
    roomName: string;
    maxPlayers?: number;
    mapWidth?: number;
    mapHeight?: number;
    creatorSessionId?: string;
  }): Room | null {
    if (this.rooms.size >= this.options.maxRooms) {
      this.logger.warn("Maximum rooms limit reached", { maxRooms: this.options.maxRooms });
      return null;
    }

    const room = new Room(this.connectionManager, options);
    this.rooms.set(room.id, room);

    this.logger.info("Room created", {
      roomId: room.id,
      roomName: options.roomName,
      totalRooms: this.rooms.size,
    });

    return room;
  }

  /** 获取房间 */
  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  /** 移除房间 */
  removeRoom(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room) return false;

    room.cleanup();
    this.rooms.delete(roomId);

    this.logger.info("Room removed", {
      roomId,
      totalRooms: this.rooms.size,
    });

    return true;
  }

  /** 玩家加入房间 */
  joinRoom(
    roomId: string,
    connectionId: string,
    playerId: string,
    playerName: string
  ): boolean {
    const room = this.getRoom(roomId);
    if (!room) {
      this.logger.warn("Room not found", { roomId, playerId });
      return false;
    }

    return room.joinPlayer(connectionId, playerId, playerName);
  }

  /** 玩家离开房间 */
  leaveRoom(roomId: string, playerId: string): boolean {
    const room = this.getRoom(roomId);
    if (!room) return false;

    return room.leavePlayer(playerId);
  }

  /** 处理玩家消息 */
  handlePlayerMessage(roomId: string, playerId: string, message: any): void {
    const room = this.getRoom(roomId);
    if (!room) return;

    room.handlePlayerMessage(playerId, message);
  }

  // ==================== 房间查询 ====================

  /** 获取所有房间列表 */
  getAllRooms(): Array<{
    id: string;
    name: string;
    creatorId: string;
    playerCount: number;
    maxPlayers: number;
    gameState: GameState;
    phase: string;
    createdAt: number;
  }> {
    const rooms: Array<{
      id: string;
      name: string;
      creatorId: string;
      playerCount: number;
      maxPlayers: number;
      gameState: GameState;
      phase: string;
      createdAt: number;
    }> = [];

    for (const room of this.rooms.values()) {
      rooms.push({
        id: room.id,
        name: room.name,
        creatorId: room.creatorId,
        playerCount: room.getPlayerCount(),
        maxPlayers: room.maxPlayers,
        gameState: room.gameState,
        phase: room.getInfo().phase,
        createdAt: room.createdAt,
      });
    }

    return rooms;
  }

  /** 获取活跃房间（有玩家的房间） */
  getActiveRooms(): Array<{
    id: string;
    name: string;
    playerCount: number;
    maxPlayers: number;
    phase: string;
  }> {
    return this.getAllRooms().filter(room => room.playerCount > 0);
  }

  /** 搜索房间 */
  searchRooms(criteria: {
    name?: string;
    minPlayers?: number;
    maxPlayers?: number;
    phase?: string;
  }): Array<{
    id: string;
    name: string;
    playerCount: number;
    maxPlayers: number;
    phase: string;
  }> {
    return this.getAllRooms().filter(room => {
      if (criteria.name && !room.name.toLowerCase().includes(criteria.name.toLowerCase())) {
        return false;
      }
      if (criteria.minPlayers !== undefined && room.playerCount < criteria.minPlayers) {
        return false;
      }
      if (criteria.maxPlayers !== undefined && room.playerCount > criteria.maxPlayers) {
        return false;
      }
      if (criteria.phase && room.phase !== criteria.phase) {
        return false;
      }
      return true;
    });
  }

  /** 获取房间统计 */
  getStats(): {
    totalRooms: number;
    activeRooms: number;
    totalPlayers: number;
    maxRooms: number;
  } {
    let totalPlayers = 0;
    let activeRooms = 0;

    for (const room of this.rooms.values()) {
      const playerCount = room.getPlayerCount();
      totalPlayers += playerCount;
      if (playerCount > 0) {
        activeRooms++;
      }
    }

    return {
      totalRooms: this.rooms.size,
      activeRooms,
      totalPlayers,
      maxRooms: this.options.maxRooms,
    };
  }

  // ==================== 清理和维护 ====================

  /** 启动清理周期 */
  private startCleanupCycle(): void {
    setInterval(() => {
      this.cleanupInactiveRooms();
    }, this.options.roomCleanupDelay);
  }

  /** 清理不活跃房间 */
  private cleanupInactiveRooms(): void {
    const now = Date.now();
    const roomsToRemove: string[] = [];

    for (const [roomId, room] of this.rooms.entries()) {
      const info = room.getInfo();
      const timeSinceCreation = now - info.createdAt;
      
      // 移除空房间（创建时间超过5分钟且没有玩家）
      if (room.getPlayerCount() === 0 && timeSinceCreation > this.options.roomInactivityTimeout) {
        roomsToRemove.push(roomId);
      }
    }

    // 移除房间
    for (const roomId of roomsToRemove) {
      this.removeRoom(roomId);
    }

    if (roomsToRemove.length > 0) {
      this.logger.info("Cleaned up inactive rooms", {
        count: roomsToRemove.length,
        totalRooms: this.rooms.size,
      });
    }
  }

  /** 强制清理所有房间（用于测试和关闭） */
  cleanupAllRooms(): void {
    const roomIds = Array.from(this.rooms.keys());
    
    for (const roomId of roomIds) {
      this.removeRoom(roomId);
    }

    this.logger.info("All rooms cleaned up");
  }

  // ==================== 事件处理 ====================

  /** 处理连接断开 */
  handleConnectionDisconnected(connectionId: string): void {
    // 查找该连接对应的玩家和房间
    for (const room of this.rooms.values()) {
      // 这里需要实现根据connectionId查找玩家的逻辑
      // 简化实现：遍历所有房间，检查是否有玩家的连接ID匹配
      const players = room.getPlayers();
      for (const player of players) {
        // 假设玩家对象中有connectionId字段
        if ((player as any).connectionId === connectionId) {
          room.leavePlayer(player.id);
          break;
        }
      }
    }
  }
}