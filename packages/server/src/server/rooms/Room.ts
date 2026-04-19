/**
 * 游戏房间
 */

import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../infra/simple-logger.js";
import { GameStateManager } from "../../core/state/GameStateManager.js";
import type { ConnectionManager } from "../ws/connection.js";
// 简化类型定义
type FactionType = any;

export interface RoomOptions {
  roomName: string;
  maxPlayers?: number;
  mapWidth?: number;
  mapHeight?: number;
  creatorSessionId?: string;
}

/** 游戏房间 */
export class Room {
  readonly id: string;
  readonly createdAt: number;
  
  private stateManager: GameStateManager;
  private connectionManager: ConnectionManager;
  private logger;
  
  private options: Required<RoomOptions>;
  private playerConnections = new Map<string, string>(); // playerId -> connectionId
  private isActive = true;

  constructor(
    connectionManager: ConnectionManager,
    options: RoomOptions
  ) {
    this.id = `room_${uuidv4().substring(0, 8)}`;
    this.createdAt = Date.now();
    this.connectionManager = connectionManager;
    
    this.options = {
      maxPlayers: 8,
      mapWidth: 2000,
      mapHeight: 2000,
      creatorSessionId: "",
      ...options,
    };

    this.logger = createLogger(`room-${this.id}`);
    
    // 初始化游戏状态
    this.stateManager = new GameStateManager(
      this.id,
      this.options.roomName,
      this.options.maxPlayers
    );

    this.logger.info("Room created", {
      roomName: this.options.roomName,
      maxPlayers: this.options.maxPlayers,
      creator: this.options.creatorSessionId,
    });
  }

  // ==================== 玩家管理 ====================

  /** 玩家加入房间 */
  joinPlayer(connectionId: string, playerId: string, playerName: string): boolean {
    if (!this.isActive) {
      this.logger.warn("Room is not active, cannot join");
      return false;
    }

    if (this.playerConnections.size >= this.options.maxPlayers) {
      this.logger.warn("Room is full", { playerId, playerName });
      return false;
    }

    // 检查玩家是否已在房间中
    if (this.playerConnections.has(playerId)) {
      this.logger.warn("Player already in room", { playerId });
      return false;
    }

    // 添加玩家到状态管理器
    this.stateManager.addPlayer({
      id: playerId,
      sessionId: connectionId,
      name: playerName,
      role: "PLAYER",
      faction: "PLAYER",
      ready: false,
      connected: true,
      pingMs: 0,
    });

    // 记录连接
    this.playerConnections.set(playerId, connectionId);

    this.logger.info("Player joined", {
      playerId,
      playerName,
      connectionId,
      totalPlayers: this.playerConnections.size,
    });

    // 广播玩家加入消息
    this.broadcast({
      type: "PLAYER_JOINED",
      payload: {
        playerId,
        playerName,
        joinedAt: Date.now(),
        totalPlayers: this.playerConnections.size,
      },
    });

    return true;
  }

  /** 玩家离开房间 */
  leavePlayer(playerId: string): boolean {
    if (!this.playerConnections.has(playerId)) {
      return false;
    }

    // 从状态管理器移除玩家
    this.stateManager.removePlayer(playerId);
    
    // 移除连接记录
    this.playerConnections.delete(playerId);

    this.logger.info("Player left", {
      playerId,
      totalPlayers: this.playerConnections.size,
    });

    // 广播玩家离开消息
    this.broadcast({
      type: "PLAYER_LEFT",
      payload: {
        playerId,
        leftAt: Date.now(),
        totalPlayers: this.playerConnections.size,
      },
    });

    // 检查房间是否为空
    if (this.playerConnections.size === 0) {
      this.scheduleCleanup();
    }

    return true;
  }

  /** 玩家准备状态切换 */
  togglePlayerReady(playerId: string): boolean {
    const player = this.stateManager.getPlayer(playerId);
    if (!player) return false;

    const newReadyState = !player.ready;
    this.stateManager.updatePlayer(playerId, { ready: newReadyState });

    this.logger.debug("Player ready state changed", {
      playerId,
      ready: newReadyState,
    });

    // 广播准备状态变化
    this.broadcast({
      type: "PLAYER_READY_CHANGED",
      payload: {
        playerId,
        ready: newReadyState,
      },
    });

    // 检查是否所有玩家都准备好了
    this.checkAllPlayersReady();

    return true;
  }

  /** 检查是否所有玩家都准备好了 */
  private checkAllPlayersReady(): void {
    const allPlayers = this.stateManager.getAllPlayers();
    const allReady = allPlayers.length > 0 && allPlayers.every(p => p.ready);

    if (allReady && this.stateManager.getState().phase === "DEPLOYMENT") {
      this.startGame();
    }
  }

  // ==================== 游戏流程管理 ====================

  /** 开始游戏 */
  startGame(): void {
    this.stateManager.setPhase("DEPLOYMENT");
    
    this.logger.info("Game started");
    
    this.broadcast({
      type: "GAME_STARTED",
      payload: {
        startedAt: Date.now(),
        turn: 1,
        activeFaction: "PLAYER",
      },
    });
  }

  /** 下一回合 */
  nextTurn(): void {
    this.stateManager.nextTurn();
    
    const state = this.stateManager.getState();
    
    this.logger.debug("Next turn", {
      turn: state.turn,
      activeFaction: state.activeFaction,
    });
    
    this.broadcast({
      type: "TURN_CHANGED",
      payload: {
        turn: state.turn,
        activeFaction: state.activeFaction,
        changedAt: Date.now(),
      },
    });
  }

  /** 切换行动阵营 */
  switchActiveFaction(faction: FactionType): void {
    this.stateManager.setActiveFaction(faction);
    
    this.logger.debug("Active faction changed", { faction });
    
    this.broadcast({
      type: "ACTIVE_FACTION_CHANGED",
      payload: {
        faction,
        changedAt: Date.now(),
      },
    });
  }

  // ==================== 消息处理 ====================

  /** 处理玩家消息 */
  handlePlayerMessage(playerId: string, message: any): void {
    if (!this.isActive) return;

    const { type, payload, requestId } = message;

    try {
      switch (type) {
        case "TOGGLE_READY":
          this.handleToggleReady(playerId, payload, requestId);
          break;
        case "START_GAME":
          this.handleStartGame(playerId, payload, requestId);
          break;
        case "NEXT_TURN":
          this.handleNextTurn(playerId, payload, requestId);
          break;
        case "GAME_COMMAND":
          this.handleGameCommand(playerId, payload, requestId);
          break;
        default:
          this.sendError(playerId, "UNKNOWN_COMMAND", "未知命令", requestId);
      }
    } catch (error) {
      this.logger.error("Error handling player message", error, {
        playerId,
        messageType: type,
      });
      
      this.sendError(playerId, "COMMAND_ERROR", "命令处理失败", requestId);
    }
  }

  /** 处理准备状态切换 */
  private handleToggleReady(playerId: string, _payload: any, requestId?: string): void {
    const success = this.togglePlayerReady(playerId);
    
    if (success) {
      this.send(playerId, {
        type: "TOGGLE_READY_SUCCESS",
        payload: { ready: this.stateManager.getPlayer(playerId)?.ready },
        requestId,
      });
    } else {
      this.sendError(playerId, "TOGGLE_READY_FAILED", "切换准备状态失败", requestId);
    }
  }

  /** 处理开始游戏 */
  private handleStartGame(playerId: string, _payload: any, requestId?: string): void {
    // 检查权限（简化：任何玩家都可以开始）
    const state = this.stateManager.getState();
    if (state.phase !== "DEPLOYMENT") {
      this.sendError(playerId, "GAME_ALREADY_STARTED", "游戏已开始", requestId);
      return;
    }

    this.startGame();
    
    this.send(playerId, {
      type: "START_GAME_SUCCESS",
      payload: { startedAt: Date.now() },
      requestId,
    });
  }

  /** 处理下一回合 */
  private handleNextTurn(playerId: string, _payload: any, requestId?: string): void {
    const player = this.stateManager.getPlayer(playerId);
    const state = this.stateManager.getState();
    
    // 检查权限：只有当前行动阵营的玩家可以结束回合
    if (player?.faction !== state.activeFaction) {
      this.sendError(playerId, "NOT_YOUR_TURN", "不是你的回合", requestId);
      return;
    }

    this.nextTurn();
    
    this.send(playerId, {
      type: "NEXT_TURN_SUCCESS",
      payload: { turn: state.turn + 1 },
      requestId,
    });
  }

  /** 处理游戏命令 */
  private handleGameCommand(playerId: string, payload: any, requestId?: string): void {
    // 这里应该根据命令类型调用相应的处理器
    // 简化实现：直接转发到所有玩家
    this.broadcast({
      type: "GAME_COMMAND_EXECUTED",
      payload: {
        playerId,
        command: payload,
        executedAt: Date.now(),
      },
      requestId,
    });
  }

  // ==================== 消息发送 ====================

  /** 发送消息给玩家 */
  send(playerId: string, message: any): void {
    const connectionId = this.playerConnections.get(playerId);
    if (connectionId) {
      this.connectionManager.send(connectionId, message);
    }
  }

  /** 发送错误消息 */
  sendError(playerId: string, code: string, message: string, requestId?: string): void {
    this.send(playerId, {
      type: "ERROR",
      payload: { code, message },
      requestId,
    });
  }

  /** 广播消息给所有玩家 */
  broadcast(message: any): void {
    for (const [, connectionId] of this.playerConnections.entries()) {
      this.connectionManager.send(connectionId, message);
    }
  }

  /** 广播消息给特定阵营 */
  broadcastToFaction(faction: string, message: any): void {
    const players = this.stateManager.getAllPlayers();
    for (const player of players) {
      if (player.faction === faction) {
        const connectionId = this.playerConnections.get(player.id);
        if (connectionId) {
          this.connectionManager.send(connectionId, message);
        }
      }
    }
  }

  /** 发送消息给特定玩家 */
  sendToPlayer(playerId: string, message: any): void {
    this.send(playerId, message);
  }

  /** 广播消息给除特定玩家外的所有人 */
  broadcastExcept(excludePlayerId: string, message: any): void {
    for (const [playerId, connectionId] of this.playerConnections.entries()) {
      if (playerId !== excludePlayerId) {
        this.connectionManager.send(connectionId, message);
      }
    }
  }

  /** 广播消息给观察者 */
  broadcastToSpectators(message: any): void {
    const players = this.stateManager.getAllPlayers();
    for (const player of players) {
      if (player.role === "OBSERVER") {
        const connectionId = this.playerConnections.get(player.id);
        if (connectionId) {
          this.connectionManager.send(connectionId, message);
        }
      }
    }
  }

  /** 广播消息给玩家（非观察者） */
  broadcastToPlayers(message: any): void {
    const players = this.stateManager.getAllPlayers();
    for (const player of players) {
      if (player.role !== "OBSERVER") {
        const connectionId = this.playerConnections.get(player.id);
        if (connectionId) {
          this.connectionManager.send(connectionId, message);
        }
      }
    }
  }

  // ==================== 房间管理 ====================

  /** 获取房间信息 */
  getInfo(): any {
    const state = this.stateManager.getState();
    
    return {
      id: this.id,
      name: this.options.roomName,
      createdAt: this.createdAt,
      phase: state.phase,
      turn: state.turn,
      activeFaction: state.activeFaction,
      playerCount: this.playerConnections.size,
      maxPlayers: this.options.maxPlayers,
      mapSize: {
        width: this.options.mapWidth,
        height: this.options.mapHeight,
      },
      creator: this.options.creatorSessionId,
    };
  }

  /** 获取玩家列表 */
  getPlayers(): any[] {
    return this.stateManager.getAllPlayers().map(player => ({
      id: player.id,
      name: player.name,
      role: player.role,
      faction: player.faction,
      ready: player.ready,
      connected: player.connected,
      pingMs: player.pingMs,
    }));
  }

  /** 获取游戏状态 */
  getGameState(): any {
    return this.stateManager.getStateSnapshot();
  }

  /** 安排清理 */
  private scheduleCleanup(delay: number = 30000): void {
    setTimeout(() => {
      if (this.playerConnections.size === 0) {
        this.cleanup();
      }
    }, delay);
  }

  /** 清理房间 */
  cleanup(): void {
    if (!this.isActive) return;

    this.isActive = false;
    
    this.logger.info("Room cleaning up");
    
    // 通知所有玩家房间关闭
    this.broadcast({
      type: "ROOM_CLOSED",
      payload: {
        reason: "empty",
        closedAt: Date.now(),
      },
    });

    // 清理资源
    this.playerConnections.clear();
    
    this.logger.info("Room cleaned up");
  }

  /** 检查房间是否活跃 */
  isRoomActive(): boolean {
    return this.isActive;
  }

  /** 获取活跃玩家数 */
  getPlayerCount(): number {
    return this.playerConnections.size;
  }

  /** 添加玩家 */
  addPlayer(playerState: any): boolean {
    return this.joinPlayer(playerState.sessionId, playerState.id, playerState.name);
  }

  /** 移除玩家 */
  removePlayer(playerId: string): boolean {
    return this.leavePlayer(playerId);
  }

  /** 根据会话ID获取玩家 */
  getPlayerBySessionId(sessionId: string): any {
    // 遍历所有玩家连接，找到匹配的会话ID
    for (const [playerId, connectionId] of this.playerConnections.entries()) {
      if (connectionId === sessionId) {
        return this.stateManager.getPlayer(playerId);
      }
    }
    return null;
  }

  /** 获取房间名称 */
  get name(): string {
    return this.options.roomName;
  }

  /** 获取创建者ID */
  get creatorId(): string {
    return this.options.creatorSessionId;
  }

  /** 获取最大玩家数 */
  get maxPlayers(): number {
    return this.options.maxPlayers;
  }

  /** 获取是否私有 */
  get isPrivate(): boolean {
    return false; // 简化实现，暂时不支持私有房间
  }

  /** 获取密码 */
  get password(): string | undefined {
    return undefined; // 简化实现，暂时不支持密码
  }

  /** 获取游戏状态 */
  get gameState(): any {
    return this.getGameState();
  }

  /** 获取所有舰船Token */
  getShipTokens(): import("../../core/state/Token.js").ShipTokenState[] {
    return this.stateManager.getShipTokens();
  }

  /** 获取指定舰船 */
  getShipToken(shipId: string): import("../../core/state/Token.js").ShipTokenState | undefined {
    return this.stateManager.getShipToken(shipId);
  }

  /** 更新舰船Token runtime */
  updateShipTokenRuntime(
    shipId: string,
    runtimeUpdates: Record<string, unknown>
  ): boolean {
    const token = this.stateManager.getShipToken(shipId);
    if (!token) return false;

    const updatedToken = {
      ...token,
      runtime: {
        ...token.runtime,
        ...runtimeUpdates,
      },
    };
    this.stateManager.updateShipToken(shipId, updatedToken);

    return true;
  }

  /** 获取状态管理器 */
  getStateManager(): import("../../core/state/GameStateManager.js").GameStateManager {
    return this.stateManager;
  }
}