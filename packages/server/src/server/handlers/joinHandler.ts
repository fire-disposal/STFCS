/**
 * 加入游戏处理器
 */

import { createLogger } from "../../infra/simple-logger.js";
import { gameRuntime } from "../../runtime/index.js";
import { RoomManager } from "../rooms/RoomManager.js";
import type { PlayerState } from "../../core/types/common.js";
import type { FactionType, PlayerRoleValue } from "@vt/data";
import { Faction, PlayerRole } from "@vt/data";

const logger = createLogger("join-handler");

/** 加入处理器配置 */
export interface JoinHandlerConfig {
  maxPlayersPerRoom: number;
  allowSpectators: boolean;
  autoAssignFaction: boolean;
  reconnectTimeout: number; // 重连超时时间（毫秒）
}

const DEFAULT_CONFIG: JoinHandlerConfig = {
  maxPlayersPerRoom: 8,
  allowSpectators: true,
  autoAssignFaction: true,
  reconnectTimeout: 30 * 1000, // 30秒
};

/** 加入处理器 */
export class JoinHandler {
  private config: JoinHandlerConfig;
  private roomManager: RoomManager;
  private playerSessions: Map<string, { roomId: string; lastSeen: number }> = new Map();

  constructor(
    roomManager: RoomManager,
    config: Partial<JoinHandlerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.roomManager = roomManager;
    
    // 启动清理定时器
    setInterval(() => this.cleanupExpiredSessions(), 60 * 1000);
  }

  /**
   * 处理加入请求
   */
  async handleJoin(
    roomId: string,
    playerData: {
      id: string;
      sessionId: string;
      name: string;
      nickname?: string;
      faction?: string;
      role?: string;
      avatar?: string;
    }
  ): Promise<{ success: boolean; error?: string; playerState?: PlayerState }> {
    // 检查房间是否存在
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      return {
        success: false,
        error: `Room ${roomId} not found`,
      };
    }

    // 检查重连
    const reconnectResult = this.tryReconnect(playerData.sessionId, roomId);
    if (reconnectResult.success) {
      return reconnectResult;
    }

    // 检查房间是否已满
    const match = gameRuntime.getMatch(roomId);
    if (match && match.getPlayerCount() >= this.config.maxPlayersPerRoom) {
      return {
        success: false,
        error: "Room is full",
      };
    }

    // 验证玩家数据
    const validation = this.validatePlayerData(playerData);
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
      };
    }

    // 分配阵营（如果需要）
    const faction = this.determineFaction(playerData.faction, roomId);

    // 创建玩家状态
    const playerState: PlayerState = {
      id: playerData.id,
      sessionId: playerData.sessionId,
      name: playerData.name,
      nickname: playerData.nickname,
      role: (playerData.role as PlayerRoleValue) || PlayerRole.PLAYER,
      faction: faction as FactionType,
      ready: false,
      connected: true,
      pingMs: 0,
      avatar: playerData.avatar,
    };

    try {
      // 加入房间
      const joinSuccess = room.addPlayer(playerState);
      if (!joinSuccess) {
        return {
          success: false,
          error: "Failed to join room",
        };
      }

      // 加入对局
      if (match) {
        const matchSuccess = match.addPlayer(playerData);
        if (!matchSuccess) {
          room.removePlayer(playerData.id);
          return {
            success: false,
            error: "Failed to join match",
          };
        }
      }

      // 记录会话
      this.playerSessions.set(playerData.sessionId, {
        roomId,
        lastSeen: Date.now(),
      });

      logger.info("Player joined", {
        roomId,
        playerId: playerData.id,
        sessionId: playerData.sessionId,
        faction: playerState.faction,
        role: playerState.role,
      });

      return {
        success: true,
        playerState,
      };
    } catch (error) {
      logger.error("Failed to handle join", error, { roomId, playerData });
      return {
        success: false,
        error: "Internal server error",
      };
    }
  }

  /**
   * 处理离开请求
   */
  async handleLeave(
    roomId: string,
    playerId: string,
    sessionId: string
  ): Promise<{ success: boolean; error?: string }> {
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      return {
        success: false,
        error: `Room ${roomId} not found`,
      };
    }

    // 从房间移除玩家
    const removed = room.removePlayer(playerId);
    if (!removed) {
      return {
        success: false,
        error: "Player not found in room",
      };
    }

    // 从对局移除玩家
    const match = gameRuntime.getMatch(roomId);
    if (match) {
      match.removePlayer(playerId);
    }

    // 清理会话
    this.playerSessions.delete(sessionId);

    logger.info("Player left", { roomId, playerId, sessionId });

    return { success: true };
  }

  /**
   * 处理重连
   */
  async handleReconnect(
    sessionId: string
  ): Promise<{ success: boolean; error?: string; roomId?: string; playerState?: PlayerState }> {
    const session = this.playerSessions.get(sessionId);
    if (!session) {
      return {
        success: false,
        error: "Session not found",
      };
    }

    const { roomId } = session;
    const room = this.roomManager.getRoom(roomId);
    if (!room) {
      this.playerSessions.delete(sessionId);
      return {
        success: false,
        error: "Room not found",
      };
    }

    // 获取玩家状态
    const playerState = room.getPlayerBySessionId(sessionId);
    if (!playerState) {
      this.playerSessions.delete(sessionId);
      return {
        success: false,
        error: "Player not found in room",
      };
    }

    // 更新连接状态
    playerState.connected = true;
    session.lastSeen = Date.now();

    logger.info("Player reconnected", {
      roomId,
      playerId: playerState.id,
      sessionId,
    });

    return {
      success: true,
      roomId,
      playerState,
    };
  }

  /**
   * 尝试重连
   */
  private tryReconnect(
    sessionId: string,
    requestedRoomId: string
  ): { success: boolean; error?: string; playerState?: PlayerState } {
    const session = this.playerSessions.get(sessionId);
    if (!session) {
      return { success: false };
    }

    // 检查是否请求了正确的房间
    if (session.roomId !== requestedRoomId) {
      return {
        success: false,
        error: `Session is associated with room ${session.roomId}, not ${requestedRoomId}`,
      };
    }

    // 检查会话是否过期
    const now = Date.now();
    if (now - session.lastSeen > this.config.reconnectTimeout) {
      this.playerSessions.delete(sessionId);
      return { success: false };
    }

    // 获取房间和玩家状态
    const room = this.roomManager.getRoom(session.roomId);
    if (!room) {
      this.playerSessions.delete(sessionId);
      return { success: false };
    }

    const playerState = room.getPlayerBySessionId(sessionId);
    if (!playerState) {
      this.playerSessions.delete(sessionId);
      return { success: false };
    }

    // 更新连接状态
    playerState.connected = true;
    session.lastSeen = now;

    logger.info("Player reconnected automatically", {
      roomId: session.roomId,
      sessionId,
    });

    return {
      success: true,
      playerState,
    };
  }

  /**
   * 确定阵营
   */
  private determineFaction(
    requestedFaction: string | undefined,
    roomId: string
  ): string {
    if (requestedFaction && this.isValidFaction(requestedFaction)) {
      return requestedFaction;
    }

    if (!this.config.autoAssignFaction) {
      return Faction.PLAYER; // 默认阵营
    }

    // 自动分配：平衡双方阵营
    const match = gameRuntime.getMatch(roomId);
    if (!match) {
      return Faction.PLAYER;
    }

    const stateManager = match.getStateManager();
    const playerCount = stateManager.getShipsByFaction(FactionValue.PLAYER).length;
    const enemyCount = stateManager.getShipsByFaction(FactionValue.ENEMY).length;

    return playerCount <= enemyCount ? FactionValue.PLAYER : FactionValue.ENEMY;
  }

  /**
   * 验证玩家数据
   */
  private validatePlayerData(playerData: any): { valid: boolean; error?: string } {
    if (!playerData.id || typeof playerData.id !== "string") {
      return { valid: false, error: "Player ID is required" };
    }

    if (!playerData.sessionId || typeof playerData.sessionId !== "string") {
      return { valid: false, error: "Session ID is required" };
    }

    if (!playerData.name || typeof playerData.name !== "string") {
      return { valid: false, error: "Player name is required" };
    }

    if (playerData.name.length > 50) {
      return { valid: false, error: "Player name too long (max 50 characters)" };
    }

    if (playerData.faction && !this.isValidFaction(playerData.faction)) {
      return { valid: false, error: `Invalid faction: ${playerData.faction}` };
    }

    if (playerData.role && !this.isValidRole(playerData.role)) {
      return { valid: false, error: `Invalid role: ${playerData.role}` };
    }

    return { valid: true };
  }

  /**
   * 检查是否为有效阵营
   */
  private isValidFaction(faction: string): boolean {
    return Object.values(Faction).includes(faction as FactionType);
  }

  /**
   * 检查是否为有效角色
   */
  private isValidRole(role: string): boolean {
    return Object.values(PlayerRole).includes(role as PlayerRoleValue);
  }

  /**
   * 清理过期会话
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, session] of this.playerSessions.entries()) {
      if (now - session.lastSeen > this.config.reconnectTimeout * 2) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      this.playerSessions.delete(sessionId);
    }

    if (expiredSessions.length > 0) {
      logger.debug("Cleaned up expired sessions", { count: expiredSessions.length });
    }
  }

  /**
   * 更新玩家活动时间
   */
  updatePlayerActivity(sessionId: string): void {
    const session = this.playerSessions.get(sessionId);
    if (session) {
      session.lastSeen = Date.now();
    }
  }

  /**
   * 获取处理器统计
   */
  getStats(): any {
    return {
      config: this.config,
      activeSessions: this.playerSessions.size,
      rooms: this.roomManager.getStats(),
    };
  }
}

// 导出工厂函数
export function createJoinHandler(
  roomManager: RoomManager,
  config?: Partial<JoinHandlerConfig>
): JoinHandler {
  return new JoinHandler(roomManager, config);
}