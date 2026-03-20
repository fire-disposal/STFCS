/**
 * 房间管理器
 *
 * 负责：
 * 1. 房间创建/销毁
 * 2. 玩家-房间映射
 * 3. 房间列表维护
 */

import type { RoomState, RoomPhase } from '@vt/shared/room';
import { Room, type WSSender } from './Room';

// ==================== 类型定义 ====================

/** 房间信息（用于列表展示） */
export interface RoomInfo {
  id: string;
  name: string;
  ownerId: string;
  phase: RoomPhase;
  playerCount: number;
  maxPlayers: number;
  isPrivate: boolean;
  createdAt: number;
}

/** 房间创建选项 */
export interface CreateRoomOptions {
  name?: string;
  maxPlayers?: number;
  isPrivate?: boolean;
  password?: string;
}

/** 房间类构造器 */
export interface RoomConstructor {
  new (roomId: string, creatorId: string, name?: string): Room;
  roomType: string;
  maxPlayers: number;
}

// ==================== RoomManager ====================

/**
 * 房间管理器
 */
export class RoomManager {
  private _rooms: Map<string, Room> = new Map();
  private _playerRooms: Map<string, string> = new Map();
  private _roomPasswords: Map<string, string> = new Map();
  private _roomConstructors: Map<string, RoomConstructor> = new Map();
  private _defaultMaxPlayers: number;

  constructor(defaultMaxPlayers: number = 8) {
    this._defaultMaxPlayers = defaultMaxPlayers;
  }

  // ==================== 房间类注册 ====================

  /**
   * 注册房间类型
   */
  registerRoomType(type: string, constructor: RoomConstructor): void {
    this._roomConstructors.set(type, constructor);
  }

  /**
   * 获取房间类型
   */
  getRoomType(type: string): RoomConstructor | undefined {
    return this._roomConstructors.get(type);
  }

  // ==================== 房间生命周期 ====================

  /**
   * 创建房间
   */
  createRoom(
    roomId: string,
    creatorId: string,
    options: CreateRoomOptions = {},
    roomType: string = 'default'
  ): Room {
    // 检查是否已存在
    if (this._rooms.has(roomId)) {
      return this._rooms.get(roomId)!;
    }

    // 获取房间构造器
    const RoomClass = this._roomConstructors.get(roomType);
    if (!RoomClass) {
      throw new Error(`Unknown room type: ${roomType}`);
    }

    // 创建房间实例
    const room = new RoomClass(roomId, creatorId, options.name);
    this._rooms.set(roomId, room);

    // 保存密码（如果有）
    if (options.isPrivate && options.password) {
      this._roomPasswords.set(roomId, options.password);
    }

    // 映射玩家到房间
    this._playerRooms.set(creatorId, roomId);

    return room;
  }

  /**
   * 获取房间
   */
  getRoom(roomId: string): Room | undefined {
    return this._rooms.get(roomId);
  }

  /**
   * 获取玩家所在房间
   */
  getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this._playerRooms.get(playerId);
    if (!roomId) return undefined;
    return this._rooms.get(roomId);
  }

  /**
   * 获取玩家房间 ID
   */
  getPlayerRoomId(playerId: string): string | undefined {
    return this._playerRooms.get(playerId);
  }

  /**
   * 删除房间
   */
  deleteRoom(roomId: string): boolean {
    const room = this._rooms.get(roomId);
    if (!room) return false;

    // 清理玩家映射
    for (const clientId of room.clientIds) {
      this._playerRooms.delete(clientId);
    }

    // 清理密码
    this._roomPasswords.delete(roomId);

    // 删除房间
    return this._rooms.delete(roomId);
  }

  // ==================== 玩家管理 ====================

  /**
   * 玩家加入房间
   */
  joinRoom(
    roomId: string,
    playerId: string,
    sender: WSSender,
    password?: string
  ): { success: boolean; room?: Room; error?: string } {
    const room = this._rooms.get(roomId);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // 检查密码
    const roomPassword = this._roomPasswords.get(roomId);
    if (roomPassword && roomPassword !== password) {
      return { success: false, error: 'Wrong password' };
    }

    // 检查玩家是否已在其他房间
    const currentRoomId = this._playerRooms.get(playerId);
    if (currentRoomId && currentRoomId !== roomId) {
      return { success: false, error: 'Player already in another room' };
    }

    // 添加客户端
    room.addClient(playerId, sender);
    this._playerRooms.set(playerId, roomId);

    return { success: true, room };
  }

  /**
   * 玩家离开房间
   */
  leaveRoom(playerId: string): { success: boolean; roomEmpty?: boolean } {
    const roomId = this._playerRooms.get(playerId);
    if (!roomId) return { success: false };

    const room = this._rooms.get(roomId);
    if (!room) return { success: false };

    // 移除客户端
    room.removeClient(playerId);
    this._playerRooms.delete(playerId);

    // 检查房间是否为空
    if (room.clientIds.length === 0) {
      this.deleteRoom(roomId);
      return { success: true, roomEmpty: true };
    }

    return { success: true, roomEmpty: false };
  }

  // ==================== 房间列表 ====================

  /**
   * 获取房间列表
   */
  listRooms(): RoomInfo[] {
    const rooms: RoomInfo[] = [];
    
    for (const [roomId, room] of this._rooms) {
      const state = room.state;
      rooms.push({
        id: roomId,
        name: state.meta.name,
        ownerId: state.meta.ownerId,
        phase: state.meta.phase,
        playerCount: room.playerCount,
        maxPlayers: this._defaultMaxPlayers,
        isPrivate: this._roomPasswords.has(roomId),
        createdAt: state.meta.createdAt,
      });
    }

    return rooms;
  }

  /**
   * 获取房间数量
   */
  getRoomCount(): number {
    return this._rooms.size;
  }

  /**
   * 获取在线玩家数量
   */
  getPlayerCount(): number {
    return this._playerRooms.size;
  }
}