/**
 * 房间协议处理器
 * 处理房间创建、加入、存档等逻辑
 */

import { createLogger } from "../../../infra/simple-logger.js";
import type { RoomManager } from "../../rooms/RoomManager.js";
import type { Message, RequestMessage } from "../protocol.js";
import { gameRuntime } from "../../../runtime/index.js";


const logger = createLogger("room-protocol");

/** 房间协议处理器配置 */
export interface RoomProtocolHandlerConfig {
  /** 最大房间数 */
  maxRooms?: number;
  /** 房间清理超时（毫秒） */
  roomCleanupTimeout?: number;
  /** 最大玩家数 */
  maxPlayersPerRoom?: number;
}

const DEFAULT_CONFIG: RoomProtocolHandlerConfig = {
  maxRooms: 100,
  roomCleanupTimeout: 5 * 60 * 1000, // 5分钟
  maxPlayersPerRoom: 8,
};

/** 用户房间状态 */
interface UserRoomState {
  userId: string;
  ownedRoomId?: string | undefined; // 用户拥有的房间ID
  joinedRoomId?: string | undefined; // 用户加入的房间ID
  lastActivity: number;
}

/** 房间存档 */
interface RoomSave {
  id: string;
  roomId: string;
  creatorId: string;
  name: string;
  description?: string;
  createdAt: number;
  data: any; // 房间状态数据
  metadata?: Record<string, any>;
}

/** 房间协议处理器 */
export class RoomProtocolHandler {
  private roomManager: RoomManager;
  private config: RoomProtocolHandlerConfig;
  
  private userStates: Map<string, UserRoomState> = new Map();
  private roomSaves: Map<string, RoomSave[]> = new Map(); // key: userId, value: 存档列表
  private cleanupTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    roomManager: RoomManager,
    config: Partial<RoomProtocolHandlerConfig> = {}
  ) {
    this.roomManager = roomManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    logger.info("Room protocol handler initialized", { config: this.config });
  }

  /**
   * 处理房间相关消息
   */
  async handleMessage(connectionId: string, message: Message): Promise<void> {
    // 在无鉴权系统中，直接从消息中获取用户名
    // 对于需要用户名的消息，payload 中必须包含 username 字段
    const userId = this.extractUserId(connectionId, message);
    
    if (!userId) {
      this.sendError(
        connectionId,
        "USERNAME_REQUIRED",
        "用户名是必需的",
        (message as RequestMessage).id
      );
      return;
    }

    switch (message.type) {
      case "list_rooms":
        await this.handleListRooms(connectionId, message, userId);
        break;
      case "create_room":
        await this.handleCreateRoom(connectionId, message, userId);
        break;
      case "join_room":
        await this.handleJoinRoom(connectionId, message, userId);
        break;
      case "leave_room":
        await this.handleLeaveRoom(connectionId, message, userId);
        break;
      case "delete_room":
        await this.handleDeleteRoom(connectionId, message, userId);
        break;
      case "save_room":
        await this.handleSaveRoom(connectionId, message, userId);
        break;
      case "load_save":
        await this.handleLoadSave(connectionId, message, userId);
        break;
      case "list_saves":
        await this.handleListSaves(connectionId, message, userId);
        break;
      case "delete_save":
        await this.handleDeleteSave(connectionId, message, userId);
        break;
      default:
        this.sendError(
          connectionId,
          "UNKNOWN_MESSAGE_TYPE",
          `未知的房间消息类型: ${message.type}`,
          (message as RequestMessage).id
        );
    }
  }

  /**
   * 处理列出房间请求
   */
  private async handleListRooms(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {

    // 获取所有房间
    const rooms = this.roomManager.getAllRooms();
    const userState = this.getUserState(userId);
    
    const roomList = rooms.map(room => ({
      id: room.id,
      name: room.name,
      creatorId: room.creatorId,
      playerCount: room.playerCount,
      maxPlayers: room.maxPlayers,
      gameState: room.gameState,
      createdAt: room.createdAt,
      isOwned: room.creatorId === userId,
      isJoined: userState?.joinedRoomId === room.id,
    }));

    // 发送响应
    this.sendResponse(connectionId, "rooms_listed", {
      rooms: roomList,
      total: roomList.length,
      timestamp: Date.now(),
    }, message.id);
  }

  /**
   * 处理创建房间请求
   */
  private async handleCreateRoom(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    const { payload } = message;
    
    // 简化：直接处理消息，不进行验证

    // 检查用户是否已有房间
    const userState = this.getUserState(userId);
    if (userState?.ownedRoomId) {
      this.sendError(connectionId, "ALREADY_HAS_ROOM", "您已经拥有一个房间", message.id);
      return;
    }

    // 检查房间数量限制
    const totalRooms = this.roomManager.getAllRooms().length;
    if (totalRooms >= this.config.maxRooms!) {
      this.sendError(connectionId, "MAX_ROOMS_REACHED", "服务器房间数量已达上限", message.id);
      return;
    }

    // 创建房间
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const roomName = payload.name || `${userId}的房间`;
    const maxPlayers = Math.min(payload.maxPlayers || 8, this.config.maxPlayersPerRoom!);
    
    try {
      const room = this.roomManager.createRoom({
        roomName,
        maxPlayers,
        creatorSessionId: userId,
      });

      if (!room) {
        this.sendError(connectionId, "CREATE_ROOM_FAILED", "创建房间失败", message.id);
        return;
      }

      // 创建对应的游戏对局
      gameRuntime.createMatch(roomId, roomName, maxPlayers);

      // 更新用户状态
      this.updateUserState(userId, {
        ownedRoomId: roomId,
        lastActivity: Date.now(),
      });

      // 发送响应
      this.sendResponse(connectionId, "room_created", {
        roomId,
        roomName,
        creatorId: userId,
        maxPlayers,
        matchId: roomId, // 对局ID与房间ID相同
        createdAt: room.createdAt,
      }, message.id);

      logger.info("Room created", {
        userId,
        roomId,
        roomName,
        maxPlayers,
      });
    } catch (error) {
      logger.error("Failed to create room", error, { userId });
      this.sendError(connectionId, "CREATE_ROOM_FAILED", "创建房间失败", message.id);
    }
  }

  /**
   * 处理加入房间请求
   */
  private async handleJoinRoom(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    const { payload } = message;
    
    // 简化：直接处理消息，不进行验证

    const roomId = payload.roomId;
    const room = this.roomManager.getRoom(roomId);
    
    if (!room) {
      this.sendError(connectionId, "ROOM_NOT_FOUND", "房间不存在", message.id);
      return;
    }

    // 检查房间是否已满
    if (room.getPlayerCount() >= room.maxPlayers) {
      this.sendError(connectionId, "ROOM_FULL", "房间已满", message.id);
      return;
    }

    // 获取用户当前状态
    const userState = this.getUserState(userId);
    
    // 如果用户已经在其他房间，先离开
    if (userState?.joinedRoomId && userState.joinedRoomId !== roomId) {
      await this.leaveRoomInternal(userId, userState.joinedRoomId);
    }

    // 在无鉴权系统中，从payload中获取玩家显示名称
    const playerName = payload.displayName || userId;
    
    // 加入房间
    const joinResult = room.addPlayer({
      id: userId,
      sessionId: connectionId, // 使用连接ID作为会话ID
      name: playerName,
      nickname: playerName,
      faction: payload.faction,
      role: payload.role || "PLAYER",
    });

    if (!joinResult) {
      this.sendError(connectionId, "JOIN_FAILED", "加入房间失败", message.id);
      return;
    }

    // 加入对局
    const match = gameRuntime.getMatch(roomId);
    if (match) {
      match.addPlayer({
        id: userId,
        sessionId: connectionId, // 使用连接ID作为会话ID
        name: playerName,
        nickname: playerName,
        faction: payload.faction,
        role: payload.role || "PLAYER",
      });
    }

    // 更新用户状态
    this.updateUserState(userId, {
      joinedRoomId: roomId,
      lastActivity: Date.now(),
    });

    // 取消房间清理定时器（如果有）
    this.cancelRoomCleanup(roomId);

    // 发送响应
    this.sendResponse(connectionId, "room_joined", {
      roomId,
      roomName: room.name,
      playerCount: room.getPlayerCount(),
      maxPlayers: room.maxPlayers,
      players: room.getPlayers().map(p => ({
        id: p.id,
        name: p.name,
        faction: p.faction,
        role: p.role,
        ready: p.ready,
      })),
      gameState: room.gameState,
    }, message.id);

    // 广播房间更新
    this.broadcastRoomUpdate(roomId, "player_joined", {
      playerId: userId,
      playerName: playerName,
      playerCount: room.getPlayerCount(),
    });

    logger.info("Player joined room", {
      userId,
      playerName,
      roomId,
      playerCount: room.getPlayerCount(),
    });
  }

  /**
   * 处理离开房间请求
   */
  private async handleLeaveRoom(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    // 简化：直接处理消息，不进行验证

    const userState = this.getUserState(userId);
    if (!userState?.joinedRoomId) {
      this.sendError(connectionId, "NOT_IN_ROOM", "您不在任何房间中", message.id);
      return;
    }

    const roomId = userState.joinedRoomId;
    await this.leaveRoomInternal(userId, roomId);

    // 发送响应
    this.sendResponse(connectionId, "room_left", {
      roomId,
      timestamp: Date.now(),
    }, message.id);
  }

  /**
   * 内部离开房间逻辑
   */
  private async leaveRoomInternal(userId: string, roomId: string): Promise<void> {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // 从房间移除玩家
    room.removePlayer(userId);

    // 从对局移除玩家
    const match = gameRuntime.getMatch(roomId);
    if (match) {
      match.removePlayer(userId);
    }

    // 更新用户状态
    this.updateUserState(userId, {
      joinedRoomId: undefined,
      lastActivity: Date.now(),
    });

    // 广播房间更新
    this.broadcastRoomUpdate(roomId, "player_left", {
      playerId: userId,
      playerCount: room.getPlayerCount(),
    });

    // 如果房间没有玩家了，启动清理定时器
    if (room.getPlayerCount() === 0) {
      this.scheduleRoomCleanup(roomId);
    }

    logger.info("Player left room", {
      userId,
      roomId,
      remainingPlayers: room.getPlayerCount(),
    });
  }

  /**
   * 处理删除房间请求
   */
  private async handleDeleteRoom(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    const { payload } = message;
    
    const roomId = payload.roomId;
    const room = this.roomManager.getRoom(roomId);
    
    if (!room) {
      this.sendError(connectionId, "ROOM_NOT_FOUND", "房间不存在", message.id);
      return;
    }

    // 检查权限：只有房主可以删除房间
    if (room.creatorId !== userId) {
      this.sendError(connectionId, "PERMISSION_DENIED", "只有房主可以删除房间", message.id);
      return;
    }

    // 删除房间
    await this.deleteRoomInternal(roomId, userId);

    // 发送响应
    this.sendResponse(connectionId, "room_deleted", {
      roomId,
      timestamp: Date.now(),
    }, message.id);
  }

  /**
   * 内部删除房间逻辑
   */
  private async deleteRoomInternal(roomId: string, userId: string): Promise<void> {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // 移除所有玩家
    const players = room.getPlayers();
    for (const player of players) {
      this.updateUserState(player.id, {
        joinedRoomId: undefined,
        lastActivity: Date.now(),
      });
    }

    // 移除对局
    gameRuntime.removeMatch(roomId);

    // 移除房间
    this.roomManager.removeRoom(roomId);

    // 更新房主状态
    this.updateUserState(userId, {
      ownedRoomId: undefined,
      lastActivity: Date.now(),
    });

    // 取消清理定时器
    this.cancelRoomCleanup(roomId);

    logger.info("Room deleted", {
      roomId,
      creatorId: userId,
      playerCount: players.length,
    });
  }

  /**
   * 处理保存房间请求
   */
  private async handleSaveRoom(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    const { payload } = message;

    const userState = this.getUserState(userId);
    if (!userState?.joinedRoomId) {
      this.sendError(connectionId, "NOT_IN_ROOM", "您不在任何房间中", message.id);
      return;
    }

    const roomId = userState.joinedRoomId;
    const room = this.roomManager.getRoom(roomId);
    
    if (!room) {
      this.sendError(connectionId, "ROOM_NOT_FOUND", "房间不存在", message.id);
      return;
    }

    // 检查权限：只有房主可以保存房间
    if (room.creatorId !== userId) {
      this.sendError(connectionId, "PERMISSION_DENIED", "只有房主可以保存房间", message.id);
      return;
    }

    // 获取房间状态
    const match = gameRuntime.getMatch(roomId);
    if (!match) {
      this.sendError(connectionId, "NO_MATCH", "房间没有对局", message.id);
      return;
    }

    const roomState = match.getState();
    
    // 创建存档
    const saveId = `save_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const save: RoomSave = {
      id: saveId,
      roomId,
      creatorId: userId,
      name: payload.name || `存档_${new Date().toLocaleString()}`,
      description: payload.description,
      createdAt: Date.now(),
      data: {
        roomState,
        players: room.getPlayers().map(p => ({
          id: p.id,
          name: p.name,
          faction: p.faction,
          role: p.role,
        })),
        metadata: payload.metadata || {},
      },
      metadata: {
        turn: match.getTurn(),
        phase: match.getPhase(),
        playerCount: room.getPlayerCount(),
        shipCount: match.getShipCount(),
      },
    };

    // 保存存档
    const userSaves = this.roomSaves.get(userId) || [];
    userSaves.push(save);
    this.roomSaves.set(userId, userSaves);

    // 发送响应
    this.sendResponse(connectionId, "room_saved", {
      saveId,
      name: save.name,
      description: save.description,
      createdAt: save.createdAt,
      metadata: save.metadata,
    }, message.id);

    logger.info("Room saved", {
      userId,
      roomId,
      saveId,
      saveName: save.name,
    });
  }

  /**
   * 处理加载存档请求
   */
  private async handleLoadSave(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    const { payload } = message;
    
    const userState = this.getUserState(userId);
    if (!userState?.joinedRoomId) {
      this.sendError(connectionId, "NOT_IN_ROOM", "您不在任何房间中", message.id);
      return;
    }

    const roomId = userState.joinedRoomId;
    const room = this.roomManager.getRoom(roomId);
    
    if (!room) {
      this.sendError(connectionId, "ROOM_NOT_FOUND", "房间不存在", message.id);
      return;
    }

    // 检查权限：只有房主可以加载存档
    if (room.creatorId !== userId) {
      this.sendError(connectionId, "PERMISSION_DENIED", "只有房主可以加载存档", message.id);
      return;
    }

    // 获取存档
    const saveId = payload.saveId;
    const userSaves = this.roomSaves.get(userId) || [];
    const save = userSaves.find(s => s.id === saveId);
    
    if (!save) {
      this.sendError(connectionId, "SAVE_NOT_FOUND", "存档不存在", message.id);
      return;
    }

    // 检查存档是否属于当前房间
    if (save.roomId !== roomId) {
      this.sendError(connectionId, "SAVE_MISMATCH", "存档不属于当前房间", message.id);
      return;
    }

    // TODO: 实现实际的存档加载逻辑
    // 这里需要将存档数据应用到房间和对局状态
    
    // 发送响应
    this.sendResponse(connectionId, "save_loaded", {
      saveId,
      name: save.name,
      description: save.description,
      metadata: save.metadata,
      loadedAt: Date.now(),
    }, message.id);

    // 广播存档加载通知
    this.broadcastRoomUpdate(roomId, "save_loaded", {
      saveId,
      saveName: save.name,
      loadedBy: userId,
    });

    logger.info("Save loaded", {
      userId,
      roomId,
      saveId,
      saveName: save.name,
    });
  }

  /**
   * 处理列出存档请求
   */
  private async handleListSaves(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    const { payload } = message;
    

    const userSaves = this.roomSaves.get(userId) || [];
    const roomId = payload.roomId;
    
    // 如果指定了房间ID，只返回该房间的存档
    const filteredSaves = roomId 
      ? userSaves.filter(save => save.roomId === roomId)
      : userSaves;

    const saveList = filteredSaves.map(save => ({
      id: save.id,
      name: save.name,
      description: save.description,
      roomId: save.roomId,
      createdAt: save.createdAt,
      metadata: save.metadata,
      dataSize: JSON.stringify(save.data).length,
    }));

    // 发送响应
    this.sendResponse(connectionId, "saves_listed", {
      saves: saveList,
      total: saveList.length,
      timestamp: Date.now(),
    }, message.id);
  }

  /**
   * 处理删除存档请求
   */
  private async handleDeleteSave(
    connectionId: string,
    message: any,
    userId: string
  ): Promise<void> {
    const { payload } = message;
    

    const saveId = payload.saveId;
    const userSaves = this.roomSaves.get(userId) || [];
    const saveIndex = userSaves.findIndex(save => save.id === saveId);
    
    if (saveIndex === -1) {
      this.sendError(connectionId, "SAVE_NOT_FOUND", "存档不存在", message.id);
      return;
    }

    // 删除存档
    const deletedSave = userSaves.splice(saveIndex, 1)[0];
    if (!deletedSave) {
      this.sendError(connectionId, "SAVE_NOT_FOUND", "存档不存在", message.id);
      return;
    }
    this.roomSaves.set(userId, userSaves);

    // 发送响应
    this.sendResponse(connectionId, "save_deleted", {
      saveId,
      name: deletedSave.name,
      deletedAt: Date.now(),
    }, message.id);

    logger.info("Save deleted", {
      userId,
      saveId,
      saveName: deletedSave.name,
    });
  }

  /**
   * 从消息中提取用户ID
   */
  private extractUserId(connectionId: string, message: Message): string | null {
    // 对于需要用户名的消息类型，从payload中获取username
    const messageTypesRequiringUsername = [
      "create_room", "join_room", "leave_room", "delete_room",
      "save_room", "load_save", "list_saves", "delete_save"
    ];
    
    if (messageTypesRequiringUsername.includes(message.type)) {
      const payload = (message as any).payload;
      if (payload && payload.username && typeof payload.username === "string") {
        return payload.username;
      }
      return null;
    }
    
    // 对于不需要用户名的消息（如list_rooms），使用连接ID作为临时用户ID
    return `user_${connectionId}`;
  }

  /**
   * 获取用户状态
   */
  private getUserState(userId: string): UserRoomState | undefined {
    return this.userStates.get(userId);
  }

  /**
   * 更新用户状态
   */
  private updateUserState(userId: string, updates: Partial<UserRoomState>): void {
    const currentState = this.userStates.get(userId) || {
      userId,
      lastActivity: Date.now(),
    };
    
    this.userStates.set(userId, {
      ...currentState,
      ...updates,
      lastActivity: Date.now(),
    });
  }

  /**
   * 安排房间清理
   */
  private scheduleRoomCleanup(roomId: string): void {
    // 取消现有的定时器
    this.cancelRoomCleanup(roomId);

    // 设置新的定时器
    const timer = setTimeout(() => {
      this.cleanupEmptyRoom(roomId);
    }, this.config.roomCleanupTimeout!);

    this.cleanupTimers.set(roomId, timer);

    logger.debug("Room cleanup scheduled", {
      roomId,
      timeout: this.config.roomCleanupTimeout,
    });
  }

  /**
   * 取消房间清理
   */
  private cancelRoomCleanup(roomId: string): void {
    const timer = this.cleanupTimers.get(roomId);
    if (timer) {
      clearTimeout(timer);
      this.cleanupTimers.delete(roomId);
      
      logger.debug("Room cleanup cancelled", { roomId });
    }
  }

  /**
   * 清理空房间
   */
  private cleanupEmptyRoom(roomId: string): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.cleanupTimers.delete(roomId);
      return;
    }

    // 再次检查房间是否为空
    if (room.getPlayerCount() === 0) {
      logger.info("Cleaning up empty room", { roomId, roomName: room.name });
      
      // 删除房间
      this.roomManager.removeRoom(roomId);
      
      // 移除对局
      gameRuntime.removeMatch(roomId);
      
      // 更新房主状态
      if (room.creatorId) {
        this.updateUserState(room.creatorId, {
          ownedRoomId: undefined,
        });
      }
      
      this.cleanupTimers.delete(roomId);
    }
  }

  /**
   * 广播房间更新
   */
  private broadcastRoomUpdate(roomId: string, type: string, payload: any): void {
    const room = this.roomManager.getRoom(roomId);
    if (!room) return;

    // 这里应该通过连接管理器广播消息
    // 简化实现：记录日志
    logger.debug("Room update broadcast", {
      roomId,
      type,
      payload,
    });
  }

  /**
   * 发送响应
   */
  private sendResponse(
    connectionId: string,
    type: string,
    payload: any,
    requestId?: string
  ): void {
    // 这里应该通过连接管理器发送消息
    // 简化实现：记录日志
    logger.debug("Sending response", {
      connectionId,
      type,
      requestId,
      payload,
    });
  }

  /**
   * 发送错误
   */
  private sendError(
    connectionId: string,
    code: string,
    message: string,
    requestId?: string
  ): void {
    // 这里应该通过连接管理器发送错误消息
    // 简化实现：记录日志
    logger.warn("Sending error", {
      connectionId,
      code,
      message,
      requestId,
    });
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    // 清理所有定时器
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
    
    this.userStates.clear();
    this.roomSaves.clear();
    
    logger.info("Room protocol handler cleaned up");
  }
}