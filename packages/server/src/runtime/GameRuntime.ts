/**
 * 游戏运行时管理 - 管理所有对局
 */

import { createLogger } from "../infra/simple-logger.js";
import { Match } from "./Match.js";
import { TurnManager } from "./TurnManager.js";
import type { GameState } from "../core/types/common.js";

const logger = createLogger("runtime");

/** 游戏运行时配置 */
export interface GameRuntimeConfig {
  maxMatches: number;
  matchTimeout: number; // 对局超时时间（毫秒）
  cleanupInterval: number; // 清理间隔（毫秒）
  autoSaveInterval: number; // 自动保存间隔（毫秒）
}

const DEFAULT_CONFIG: GameRuntimeConfig = {
  maxMatches: 100,
  matchTimeout: 30 * 60 * 1000, // 30分钟
  cleanupInterval: 60 * 1000, // 1分钟
  autoSaveInterval: 5 * 60 * 1000, // 5分钟
};

/** 游戏运行时管理器 */
export class GameRuntime {
  private config: GameRuntimeConfig;
  private matches: Map<string, Match> = new Map();
  private turnManagers: Map<string, TurnManager> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<GameRuntimeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startCleanupCycle();
    this.startAutoSaveCycle();
  }

  /**
   * 创建新对局
   */
  createMatch(roomId: string, roomName: string, maxPlayers: number = 8): Match {
    if (this.matches.size >= this.config.maxMatches) {
      throw new Error("Maximum number of matches reached");
    }

    if (this.matches.has(roomId)) {
      throw new Error(`Match with roomId ${roomId} already exists`);
    }

    const match = new Match(roomId, roomName, maxPlayers);
    this.matches.set(roomId, match);

    // 创建对应的回合管理器
    const turnManager = new TurnManager(match);
    this.turnManagers.set(roomId, turnManager);

    logger.info("Created new match", { roomId, roomName, maxPlayers });
    return match;
  }

  /**
   * 获取对局
   */
  getMatch(roomId: string): Match | null {
    return this.matches.get(roomId) || null;
  }

  /**
   * 移除对局
   */
  removeMatch(roomId: string): boolean {
    const match = this.matches.get(roomId);
    if (!match) return false;

    // 清理回合管理器
    this.turnManagers.delete(roomId);

    // 保存最终状态
    match.saveFinalState().catch(error => {
      logger.error("Failed to save final match state", error, { roomId });
    });

    // 移除对局
    this.matches.delete(roomId);

    logger.info("Removed match", { roomId });
    return true;
  }

  /**
   * 获取对局状态
   */
  getMatchState(roomId: string): GameState | null {
    const match = this.getMatch(roomId);
    return match ? match.getState() : null;
  }

  /**
   * 获取所有活跃对局
   */
  getAllMatches(): Match[] {
    return Array.from(this.matches.values());
  }

  /**
   * 获取活跃对局数量
   */
  getActiveMatchCount(): number {
    return this.matches.size;
  }

  /**
   * 获取对局统计
   */
  getMatchStats(roomId: string): any {
    const match = this.getMatch(roomId);
    if (!match) return null;

    const turnManager = this.turnManagers.get(roomId);
    
    return {
      roomId,
      playerCount: match.getPlayerCount(),
      shipCount: match.getShipCount(),
      turn: match.getTurn(),
      phase: match.getPhase(),
      turnManagerStats: turnManager?.getStats() || null,
      createdAt: match.getCreatedAt(),
      lastActivity: match.getLastActivity(),
      isActive: match.isActive(),
    };
  }

  /**
   * 获取所有对局统计
   */
  getAllMatchStats(): any[] {
    return Array.from(this.matches.keys()).map(roomId => 
      this.getMatchStats(roomId)
    ).filter(Boolean);
  }

  /**
   * 处理对局Action
   */
  async processAction(roomId: string, action: any): Promise<{ success: boolean; error?: string; events?: any[] }> {
    const match = this.getMatch(roomId);
    if (!match) {
      return { success: false, error: "Match not found" };
    }

    try {
      const result = await match.processAction(action);
      return result;
    } catch (error) {
      logger.error("Failed to process action", error, { roomId, action });
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取回合管理器
   */
  getTurnManager(roomId: string): TurnManager | null {
    return this.turnManagers.get(roomId) || null;
  }

  /**
   * 开始清理周期
   */
  private startCleanupCycle(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupInactiveMatches();
    }, this.config.cleanupInterval);

    logger.info("Started cleanup cycle", { interval: this.config.cleanupInterval });
  }

  /**
   * 清理非活跃对局
   */
  private cleanupInactiveMatches(): void {
    const now = Date.now();
    const inactiveMatches: string[] = [];

    for (const [roomId, match] of this.matches.entries()) {
      const lastActivity = match.getLastActivity();
      const timeSinceActivity = now - lastActivity;

      if (timeSinceActivity > this.config.matchTimeout && !match.isActive()) {
        inactiveMatches.push(roomId);
      }
    }

    for (const roomId of inactiveMatches) {
      logger.info("Cleaning up inactive match", { roomId });
      this.removeMatch(roomId);
    }

    if (inactiveMatches.length > 0) {
      logger.info("Cleaned up inactive matches", { count: inactiveMatches.length });
    }
  }

  /**
   * 开始自动保存周期
   */
  private startAutoSaveCycle(): void {
    this.autoSaveTimer = setInterval(() => {
      this.autoSaveMatches();
    }, this.config.autoSaveInterval);

    logger.info("Started auto-save cycle", { interval: this.config.autoSaveInterval });
  }

  /**
   * 自动保存对局
   */
  private async autoSaveMatches(): Promise<void> {
    const savePromises: Promise<void>[] = [];

    for (const [roomId, match] of this.matches.entries()) {
      if (match.isActive()) {
        savePromises.push(
          match.autoSave().catch(error => {
            logger.error("Failed to auto-save match", error, { roomId });
          })
        );
      }
    }

    await Promise.all(savePromises);
    logger.debug("Auto-save completed", { matchCount: savePromises.length });
  }

  /**
   * 优雅关闭
   */
  async shutdown(): Promise<void> {
    logger.info("Shutting down game runtime");

    // 停止定时器
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }

    // 保存所有活跃对局
    const savePromises: Promise<void>[] = [];
    
    for (const [roomId, match] of this.matches.entries()) {
      if (match.isActive()) {
        savePromises.push(
          match.saveFinalState().catch(error => {
            logger.error("Failed to save match during shutdown", error, { roomId });
          })
        );
      }
    }

    await Promise.all(savePromises);
    logger.info("Game runtime shutdown completed", { savedMatches: savePromises.length });
  }

  /**
   * 获取运行时统计
   */
  getRuntimeStats(): any {
    return {
      totalMatches: this.matches.size,
      activeMatches: this.getAllMatches().filter(m => m.isActive()).length,
      maxMatches: this.config.maxMatches,
      matchTimeout: this.config.matchTimeout,
      cleanupInterval: this.config.cleanupInterval,
      autoSaveInterval: this.config.autoSaveInterval,
      memoryUsage: process.memoryUsage(),
    };
  }
}

// 导出单例实例
export const gameRuntime = new GameRuntime();