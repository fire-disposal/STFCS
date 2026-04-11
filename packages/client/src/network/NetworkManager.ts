/**
 * 网络管理器
 *
 * 简化版 - 去除 OAuth 认证，直接使用用户名
 */

import { Client, Room } from "colyseus.js";
import type { GameRoomState } from "@vt/shared";
import { DEFAULT_WS_URL } from "@/config";

export interface RoomInfo {
  id: string;
  name: string;
  clients: number;
  maxClients: number;
  metadata?: Record<string, unknown>;
}

export interface User {
  username: string;
}

export class NetworkManager {
  private client: Client;
  private currentRoom: Room<GameRoomState> | null = null;
  public userName: string | null = null;
  private roomsCache: RoomInfo[] = [];
  private roomsListeners: Set<(rooms: RoomInfo[]) => void> = new Set();
  private roomsInterval: number | null = null;

  // 时序安全保护
  private isCreatingRoom: boolean = false;
  private isJoiningRoom: boolean = false;
  private isLeavingRoom: boolean = false;

  constructor(serverUrl: string) {
    this.client = new Client(serverUrl);
  }

  // ==================== 用户相关 ====================

  /**
   * 设置当前用户（简化版，不需要密码）
   */
  setUser(username: string): void {
    this.userName = username.trim() || 'Player';
    localStorage.setItem('stfcs_username', this.userName);
    console.log('[NetworkManager] User set:', this.userName);
  }

  /**
   * 从本地存储恢复用户名
   */
  restoreUser(): boolean {
    const username = localStorage.getItem('stfcs_username');
    if (username) {
      this.userName = username;
      return true;
    }
    return false;
  }

  /**
   * 登出
   */
  logout(): void {
    this.userName = null;
    localStorage.removeItem('stfcs_username');

    if (this.currentRoom) {
      this.currentRoom.leave();
      this.currentRoom = null;
    }
  }

  /**
   * 获取当前用户名
   */
  getUserName(): string | null {
    return this.userName;
  }

  /**
   * 检查是否已设置用户名
   */
  hasUser(): boolean {
    return this.userName !== null && this.userName.length > 0;
  }

  // ==================== 房间相关 ====================

  /**
   * 获取房间列表
   */
  async getRooms(): Promise<RoomInfo[]> {
    try {
      const httpUrl = DEFAULT_WS_URL.replace('ws://', 'http://').replace('wss://', 'https://');
      const response = await fetch(`${httpUrl}/matchmake`);

      if (!response.ok) {
        throw new Error('Failed to fetch rooms');
      }

      const data = await response.json();
      const battleRooms = data
        .filter((r: any) => r.name === 'battle')
        .map((r: any) => ({
          id: r.roomId,
          name: r.metadata?.name || `Room ${r.roomId.substring(0, 6)}`,
          clients: r.clients,
          maxClients: r.maxClients,
          metadata: r.metadata || {},
        }));

      this.roomsCache = battleRooms;
      this.notifyRoomsListeners();
      return battleRooms;
    } catch (error) {
      console.error('[NetworkManager] Failed to get rooms:', error);
      return [];
    }
  }

  /**
   * 开始定期更新房间列表
   */
  startRoomsPolling(intervalMs: number = 5000): void {
    this.stopRoomsPolling();
    this.getRooms();

    this.roomsInterval = window.setInterval(() => {
      this.getRooms();
    }, intervalMs);
  }

  /**
   * 停止定期更新房间列表
   */
  stopRoomsPolling(): void {
    if (this.roomsInterval !== null) {
      window.clearInterval(this.roomsInterval);
      this.roomsInterval = null;
    }
  }

  /**
   * 订阅房间列表更新
   */
  subscribeRooms(listener: (rooms: RoomInfo[]) => void): () => void {
    this.roomsListeners.add(listener);
    listener(this.roomsCache);
    return () => this.roomsListeners.delete(listener);
  }

  private notifyRoomsListeners(): void {
    this.roomsListeners.forEach(listener => listener(this.roomsCache));
  }

  /**
   * 创建房间
   */
  async createRoom(options: { roomName?: string; maxPlayers?: number } = {}): Promise<Room<GameRoomState>> {
    const playerName = this.userName || 'Player';

    console.log('[NetworkManager] Creating room...', {
      playerName,
      serverUrl: DEFAULT_WS_URL,
    });

    try {
      // 添加更详细的日志
      console.log('[NetworkManager] Calling client.create with room name: battle');

      // 检查是否有用户名
      if (!this.userName) {
        throw new Error('请先设置用户名');
      }

      const room = await this.client.create<GameRoomState>('battle', {
        playerName,
      });

      console.log('[NetworkManager] client.create returned:', room);
      console.log('[NetworkManager] room.roomId:', room?.roomId);
      console.log('[NetworkManager] room.name:', (room as any)?.name);

      if (!room?.roomId) {
        console.error('[NetworkManager] Server returned invalid room object:', room);
        throw new Error('服务器返回无效的房间对象');
      }

      this.currentRoom = room;
      console.log('[NetworkManager] Room created:', room.roomId);
      return room;
    } catch (error: unknown) {
      console.error('[NetworkManager] Failed to create room:', error);
      
      // 改进错误处理
      let errorMessage = '创建房间失败：未知错误';
      
      if (error instanceof Error) {
        errorMessage = `创建房间失败：${error.message || '未知错误'}`;
      } else if (typeof error === 'string') {
        errorMessage = `创建房间失败：${error}`;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = `创建房间失败：${String((error as Record<string, unknown>).message)}`;
      }

      console.error('[NetworkManager] Error details:', {
        message: errorMessage,
        errorType: typeof error,
        errorName: error instanceof Error ? error.name : 'Unknown',
      });
      
      throw new Error(errorMessage);
    }
  }

  /**
   * 加入房间
   */
  async joinRoom(roomId: string): Promise<Room<GameRoomState>> {
    console.log('[NetworkManager] Joining room:', roomId);

    try {
      const room = await this.client.joinById<GameRoomState>(roomId, {
        playerName: this.userName || 'Player',
      });

      if (!room?.roomId) {
        throw new Error('服务器返回无效的房间对象');
      }

      this.currentRoom = room;
      console.log('[NetworkManager] Joined room:', room.roomId);
      return room;
    } catch (error: any) {
      console.error('[NetworkManager] Failed to join room:', error);
      throw new Error(`加入房间失败：${error.message}`);
    }
  }

  /**
   * 加入或创建房间
   */
  async joinOrCreateRoom(): Promise<Room<GameRoomState>> {
    try {
      const room = await this.client.joinOrCreate<GameRoomState>('battle', {
        playerName: this.userName || 'Player',
      });

      this.currentRoom = room;
      console.log('[NetworkManager] Joined/created room:', room.roomId);
      return room;
    } catch (error: any) {
      console.error('[NetworkManager] Failed to join/create room:', error);
      throw new Error(`加入/创建房间失败：${error.message}`);
    }
  }

  /**
   * 离开房间
   */
  async leaveRoom(): Promise<void> {
    if (this.currentRoom) {
      await this.currentRoom.leave();
      this.currentRoom = null;
    }
  }

  /**
   * 获取当前房间
   */
  getCurrentRoom(): Room<GameRoomState> | null {
    return this.currentRoom;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    this.stopRoomsPolling();
    this.roomsListeners.clear();
    this.roomsCache = [];
  }
}
