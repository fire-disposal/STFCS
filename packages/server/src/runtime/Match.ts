/**
 * 单局游戏封装
 */

import { createLogger } from "../infra/simple-logger.js";
import { GameStateManager } from "../core/state/GameStateManager.js";
import { applyAction } from "../core/engine/applyAction.js";
import type { GameState, GameAction, GameEvent } from "../core/types/common.js";
import type { GamePhaseType } from "@vt/data";
import { Faction } from "@vt/data";

const logger = createLogger("match");

/** 对局配置 */
export interface MatchConfig {
  maxPlayers: number;
  mapWidth: number;
  mapHeight: number;
  turnTimeLimit?: number; // 回合时间限制（毫秒）
  saveOnExit: boolean;
}

const DEFAULT_CONFIG: MatchConfig = {
  maxPlayers: 8,
  mapWidth: 2000,
  mapHeight: 2000,
  turnTimeLimit: 5 * 60 * 1000, // 5分钟
  saveOnExit: true,
};

/** 单局游戏 */
export class Match {
  private config: MatchConfig;
  private stateManager: GameStateManager;
  private createdAt: number;
  private lastActivity: number;
  private isActiveFlag: boolean = true;
  private actionHistory: Array<{ action: GameAction; timestamp: number }> = [];
  private eventHistory: Array<{ event: GameEvent; timestamp: number }> = [];

  constructor(
    public readonly roomId: string,
    public readonly roomName: string,
    maxPlayers: number = 8,
    config: Partial<MatchConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config, maxPlayers };
    this.stateManager = new GameStateManager(roomId, roomName, maxPlayers);
    this.createdAt = Date.now();
    this.lastActivity = this.createdAt;
    
    logger.info("Match created", { 
      roomId, 
      roomName, 
      maxPlayers,
      config: this.config,
    });
  }

  /**
   * 获取游戏状态
   */
  getState(): GameState {
    return this.stateManager.getStateSnapshot();
  }

  /**
   * 获取游戏状态管理器
   */
  getStateManager(): GameStateManager {
    return this.stateManager;
  }

  /**
   * 处理Action
   */
  async processAction(action: GameAction): Promise<{ success: boolean; error?: string; events?: GameEvent[] }> {
    this.updateActivity();

    // 验证Action
    const validation = this.stateManager.validateAction(action.playerId, action.type);
    if (!validation.valid) {
      return validation.error ? { success: false, error: validation.error } : { success: false };
    }

    try {
      const currentState = this.stateManager.getState();
      const result = applyAction(currentState, action);

      // 更新状态
      // 注意：这里简化处理，实际应该通过状态管理器更新
      // 暂时直接使用applyAction的结果

      // 记录历史
      this.actionHistory.push({ action, timestamp: Date.now() });
      this.eventHistory.push(...result.events.map(event => ({ event, timestamp: Date.now() })));

      // 简化：不检查游戏结束，由前端或DM控制

      return { 
        success: true, 
        events: result.events,
      };
    } catch (error) {
      logger.error("Failed to process action", error, { roomId: this.roomId, action });
      return { success: false, error: String(error) };
    }
  }

  /**
   * 添加玩家
   */
  addPlayer(playerData: any): boolean {
    this.updateActivity();
    
    const currentPlayers = this.stateManager.getAllPlayers();
    if (currentPlayers.length >= this.config.maxPlayers) {
      logger.warn("Cannot add player: max players reached", { 
        roomId: this.roomId,
        current: currentPlayers.length,
        max: this.config.maxPlayers,
      });
      return false;
    }

    // 简化：直接创建玩家状态
    const playerState = {
      id: playerData.id,
      sessionId: playerData.sessionId,
      name: playerData.name,
      nickname: playerData.nickname,
      role: playerData.role || "PLAYER",
      faction: playerData.faction || Faction.PLAYER,
      ready: false,
      connected: true,
      pingMs: 0,
      avatar: playerData.avatar,
    };

    this.stateManager.addPlayer(playerState);
    logger.info("Player added to match", { roomId: this.roomId, playerId: playerData.id });
    return true;
  }

  /**
   * 移除玩家
   */
  removePlayer(playerId: string): boolean {
    this.updateActivity();
    
    const removed = this.stateManager.removePlayer(playerId);
    if (removed) {
      logger.info("Player removed from match", { roomId: this.roomId, playerId });
      
      // 简化：玩家离开不自动结束游戏
    }
    
    return removed;
  }

  /**
   * 获取玩家数量
   */
  getPlayerCount(): number {
    return this.stateManager.getAllPlayers().length;
  }

  /**
   * 获取舰船数量
   */
  getShipCount(): number {
    return this.stateManager.getShipTokens().length;
  }

  /**
   * 获取当前回合
   */
  getTurn(): number {
    const state = this.stateManager.getState();
    return state.turn;
  }

  /**
   * 获取当前阶段
   */
  getPhase(): GamePhaseType {
    const state = this.stateManager.getState();
    return state.phase;
  }

  /**
   * 获取创建时间
   */
  getCreatedAt(): number {
    return this.createdAt;
  }

  /**
   * 获取最后活动时间
   */
  getLastActivity(): number {
    return this.lastActivity;
  }

  /**
   * 检查是否活跃
   */
  isActive(): boolean {
    return this.isActiveFlag;
  }

  /**
   * 自动保存
   */
  async autoSave(): Promise<void> {
    if (!this.isActiveFlag) return;

    try {
      // 简化：记录日志
      logger.debug("Auto-saving match", { 
        roomId: this.roomId,
        playerCount: this.getPlayerCount(),
        shipCount: this.getShipCount(),
      });
      
      // 实际实现应该保存到数据库或文件
      // await saveMatchState(this.roomId, this.getState());
    } catch (error) {
      logger.error("Failed to auto-save match", error, { roomId: this.roomId });
    }
  }

  /**
   * 保存最终状态
   */
  async saveFinalState(): Promise<void> {
    if (!this.config.saveOnExit) return;

    try {
      const stats = {
        roomId: this.roomId,
        roomName: this.roomName,
        createdAt: this.createdAt,
        endedAt: Date.now(),
        duration: Date.now() - this.createdAt,
        totalTurns: this.getTurn(),
        playerCount: this.getPlayerCount(),
        shipCount: this.getShipCount(),
        actionCount: this.actionHistory.length,
        eventCount: this.eventHistory.length,
        winner: null, // 简化：不自动判定胜者
      };

      logger.info("Saved final match state", stats);
      
      // 实际实现应该保存到数据库或文件
      // await saveMatchFinalState(this.roomId, finalState, stats);
    } catch (error) {
      logger.error("Failed to save final match state", error, { roomId: this.roomId });
    }
  }

  /**
   * 获取对局统计
   */
  getMatchStats(): any {
    const state = this.stateManager.getState();
    
    return {
      roomId: this.roomId,
      roomName: this.roomName,
      phase: state.phase,
      turn: state.turn,
      activeFaction: state.activeFaction,
      playerCount: this.getPlayerCount(),
      shipCount: this.getShipCount(),
      // 简化：移除存活舰船计数
      createdAt: this.createdAt,
      lastActivity: this.lastActivity,
      isActive: this.isActiveFlag,
      actionHistoryCount: this.actionHistory.length,
      eventHistoryCount: this.eventHistory.length,
      mapSize: {
        width: this.config.mapWidth,
        height: this.config.mapHeight,
      },
    };
  }

  /**
   * 获取Action历史
   */
  getActionHistory(limit?: number): Array<{ action: GameAction; timestamp: number }> {
    if (limit && limit > 0) {
      return this.actionHistory.slice(-limit);
    }
    return [...this.actionHistory];
  }

  /**
   * 获取Event历史
   */
  getEventHistory(limit?: number): Array<{ event: GameEvent; timestamp: number }> {
    if (limit && limit > 0) {
      return this.eventHistory.slice(-limit);
    }
    return [...this.eventHistory];
  }

  /**
   * 更新活动时间
   */
  private updateActivity(): void {
    this.lastActivity = Date.now();
  }

  /**
   * 重置对局（用于测试）
   */
  reset(): void {
    this.stateManager = new GameStateManager(this.roomId, this.roomName, this.config.maxPlayers);
    this.actionHistory = [];
    this.eventHistory = [];
    this.isActiveFlag = true;
    this.lastActivity = Date.now();
    
    logger.info("Match reset", { roomId: this.roomId });
  }
}