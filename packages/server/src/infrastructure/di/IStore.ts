/**
 * 房间存储抽象接口
 *
 * 定义房间数据持久化的核心操作
 */

import type { RoomInfo } from './IRoomManager';

/**
 * 房间存储接口
 */
export interface IRoomStore {
  /**
   * 保存房间
   */
  save(room: RoomInfo): Promise<void>;
  
  /**
   * 获取房间
   */
  get(roomId: string): Promise<RoomInfo | null>;
  
  /**
   * 删除房间
   */
  delete(roomId: string): Promise<boolean>;
  
  /**
   * 获取所有房间
   */
  getAll(): Promise<RoomInfo[]>;
  
  /**
   * 检查房间是否存在
   */
  exists(roomId: string): Promise<boolean>;
  
  /**
   * 清空所有房间
   */
  clear(): Promise<void>;
}

/**
 * 内存房间存储实现（用于开发和测试）
 */
export class InMemoryRoomStore implements IRoomStore {
  private rooms: Map<string, RoomInfo> = new Map();
  
  async save(room: RoomInfo): Promise<void> {
    this.rooms.set(room.id, room);
  }
  
  async get(roomId: string): Promise<RoomInfo | null> {
    return this.rooms.get(roomId) || null;
  }
  
  async delete(roomId: string): Promise<boolean> {
    return this.rooms.delete(roomId);
  }
  
  async getAll(): Promise<RoomInfo[]> {
    return Array.from(this.rooms.values());
  }
  
  async exists(roomId: string): Promise<boolean> {
    return this.rooms.has(roomId);
  }
  
  async clear(): Promise<void> {
    this.rooms.clear();
  }
}
