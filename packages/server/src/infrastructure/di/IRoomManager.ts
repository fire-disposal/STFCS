/**
 * 房间管理器抽象接口
 *
 * 定义房间管理的核心操作，解耦具体实现
 */

import type { PlayerInfo } from '@vt/shared/types';

/**
 * 房间信息
 */
export interface RoomInfo {
  id: string;
  name: string;
  maxPlayers: number;
  players: Map<string, PlayerInfo>;
  createdAt: number;
  isPrivate: boolean;
}

/**
 * 房间管理器接口
 */
export interface IRoomManager {
  /**
   * 创建房间
   */
  createRoom(roomId: string, options?: Partial<RoomInfo>): RoomInfo;
  
  /**
   * 获取房间
   */
  getRoom(roomId: string): RoomInfo | null;
  
  /**
   * 删除房间
   */
  deleteRoom(roomId: string): boolean;
  
  /**
   * 获取所有房间
   */
  getAllRooms(): RoomInfo[];
  
  /**
   * 添加玩家到房间
   */
  addPlayerToRoom(roomId: string, player: PlayerInfo): boolean;
  
  /**
   * 从房间移除玩家
   */
  removePlayerFromRoom(roomId: string, playerId: string): boolean;
  
  /**
   * 获取玩家所在房间
   */
  getPlayerRoom(playerId: string): RoomInfo | null;
  
  /**
   * 获取房间内的玩家列表
   */
  getRoomPlayers(roomId: string): PlayerInfo[];
  
  /**
   * 检查玩家是否在房间中
   */
  isPlayerInRoom(playerId: string, roomId: string): boolean;
  
  /**
   * 获取房间大小
   */
  getRoomSize(roomId: string): number;
  
  /**
   * 检查房间是否已满
   */
  isRoomFull(roomId: string): boolean;
}
