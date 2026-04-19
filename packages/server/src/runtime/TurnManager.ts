/**
 * 回合管理器 - 基于 @vt/data 权威设计
 */

import { createLogger } from "../infra/simple-logger.js";
import { Match } from "./Match.js";
import type { FactionType } from "@vt/data";
import { Faction } from "@vt/data";


type TurnPhase = "MOVEMENT" | "COMBAT" | "END";

const logger = createLogger("turn-manager");

/** 回合管理器配置 */
export interface TurnManagerConfig {
  turnTimeLimit: number; // 回合时间限制（毫秒）
  phaseTimeLimit?: number; // 阶段时间限制（毫秒）
  autoEndTurn: boolean; // 是否自动结束回合
  autoEndPhase: boolean; // 是否自动结束阶段
}

const DEFAULT_CONFIG: TurnManagerConfig = {
  turnTimeLimit: 5 * 60 * 1000, // 5分钟
  phaseTimeLimit: 2 * 60 * 1000, // 2分钟
  autoEndTurn: false,
  autoEndPhase: false,
};

/** 回合计时器状态 */
interface TurnTimer {
  turnStartTime: number;
  phaseStartTime: number;
  turnTimeout: NodeJS.Timeout | undefined;
  phaseTimeout: NodeJS.Timeout | undefined;
}

/** 回合管理器 */
export class TurnManager {
  private config: TurnManagerConfig;
  private match: Match;
  private timer: TurnTimer;
  private turnHistory: Array<{
    turn: number;
    faction: FactionType;
    startTime: number;
    endTime?: number;
    actions: number;
  }> = [];

  constructor(match: Match, config: Partial<TurnManagerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.match = match;
    this.timer = {
      turnStartTime: Date.now(),
      phaseStartTime: Date.now(),
      turnTimeout: undefined,
      phaseTimeout: undefined,
    };

    logger.info("Turn manager created", { roomId: match.roomId, config: this.config });
  }

  /**
   * 开始新回合
   */
  startNewTurn(faction: FactionType): void {
    const stateManager = this.match.getStateManager();
    const currentTurn = stateManager.getState().turn;
    
    // 记录上一回合结束
    if (this.turnHistory.length > 0) {
      const lastTurn = this.turnHistory[this.turnHistory.length - 1];
      if (lastTurn) {
        lastTurn.endTime = Date.now();
      }
    }

    // 开始新回合
    this.timer.turnStartTime = Date.now();
    this.timer.phaseStartTime = Date.now();
    
    // 设置回合超时
    if (this.config.turnTimeLimit > 0 && this.config.autoEndTurn) {
      this.clearTurnTimeout();
      this.timer.turnTimeout = setTimeout(() => {
        this.autoEndTurn();
      }, this.config.turnTimeLimit);
    }

    // 记录回合历史
    this.turnHistory.push({
      turn: currentTurn,
      faction,
      startTime: this.timer.turnStartTime,
      actions: 0,
    });

    logger.info("New turn started", { 
      roomId: this.match.roomId,
      turn: currentTurn,
      faction,
    });
  }

  /**
   * 结束当前回合
   */
  endCurrentTurn(): void {
    const state = this.match.getStateManager().getState();
    
    // 清除超时计时器
    this.clearTurnTimeout();
    this.clearPhaseTimeout();

    // 更新回合历史
    if (this.turnHistory.length > 0) {
      const currentTurn = this.turnHistory[this.turnHistory.length - 1]!;
      currentTurn.endTime = Date.now();
    }

    // 切换到下一个阵营
    const nextFaction = this.getNextFaction(state.activeFaction);
    this.match.getStateManager().setActiveFaction(nextFaction);
    
    // 增加回合数
    this.match.getStateManager().nextTurn();
    
    // 开始新回合
    this.startNewTurn(nextFaction);

    logger.info("Turn ended", { 
      roomId: this.match.roomId,
      turn: state.turn,
      faction: state.activeFaction,
      nextFaction,
    });
  }

  /**
   * 自动结束回合（超时）
   */
  private autoEndTurn(): void {
    if (!this.config.autoEndTurn) return;

    const state = this.match.getStateManager().getState();
    
    logger.warn("Auto-ending turn due to timeout", { 
      roomId: this.match.roomId,
      turn: state.turn,
      faction: state.activeFaction,
      timeLimit: this.config.turnTimeLimit,
    });

    this.endCurrentTurn();
  }

  /**
   * 切换到下一阶段
   */
  switchToNextPhase(): void {
    const state = this.match.getStateManager().getState();
    
    if (!state.turnPhase) {
      // 如果没有阶段系统，直接返回
      return;
    }

    const nextPhase = this.getNextPhase(state.turnPhase as TurnPhase);
    
    // 更新阶段
    // 注意：这里需要扩展GameStateManager以支持阶段管理
    // 暂时简化处理
    
    // 重置阶段计时器
    this.timer.phaseStartTime = Date.now();
    
    // 设置阶段超时
    if (this.config.phaseTimeLimit && this.config.autoEndPhase) {
      this.clearPhaseTimeout();
      this.timer.phaseTimeout = setTimeout(() => {
        this.autoEndPhase();
      }, this.config.phaseTimeLimit);
    }

    logger.debug("Switched to next phase", { 
      roomId: this.match.roomId,
      turn: state.turn,
      fromPhase: state.turnPhase,
      toPhase: nextPhase,
    });
  }

  /**
   * 自动结束阶段（超时）
   */
  private autoEndPhase(): void {
    if (!this.config.autoEndPhase) return;

    const state = this.match.getStateManager().getState();
    
    logger.debug("Auto-ending phase due to timeout", { 
      roomId: this.match.roomId,
      turn: state.turn,
      phase: state.turnPhase,
      timeLimit: this.config.phaseTimeLimit,
    });

    this.switchToNextPhase();
  }

  /**
   * 获取下一个阵营
   */
  private getNextFaction(currentFaction: FactionType): FactionType {
    // 简化：玩家→敌人→玩家循环
    switch (currentFaction) {
      case Faction.PLAYER:
        return Faction.ENEMY as FactionType;
      default:
        return Faction.PLAYER as FactionType;
    }
  }

  /**
   * 获取下一个阶段
   */
  private getNextPhase(currentPhase: TurnPhase): TurnPhase {
    // 简化阶段顺序
    const phaseOrder: TurnPhase[] = [
      "MOVEMENT",
      "COMBAT",
      "END",
    ];

    const currentIndex = phaseOrder.indexOf(currentPhase);
    if (currentIndex === -1 || currentIndex >= phaseOrder.length - 1) {
      return phaseOrder[0]!; // 循环回到第一阶段
    }

    return phaseOrder[currentIndex + 1]!;
  }

  /**
   * 记录Action
   */
  recordAction(): void {
    if (this.turnHistory.length > 0) {
      const currentTurn = this.turnHistory[this.turnHistory.length - 1]!;
      currentTurn.actions++;
    }
  }

  /**
   * 获取当前回合剩余时间
   */
  getTurnRemainingTime(): number {
    if (!this.config.turnTimeLimit) return Infinity;
    
    const elapsed = Date.now() - this.timer.turnStartTime;
    return Math.max(0, this.config.turnTimeLimit - elapsed);
  }

  /**
   * 获取当前阶段剩余时间
   */
  getPhaseRemainingTime(): number {
    if (!this.config.phaseTimeLimit) return Infinity;
    
    const elapsed = Date.now() - this.timer.phaseStartTime;
    return Math.max(0, this.config.phaseTimeLimit - elapsed);
  }

  /**
   * 获取回合统计
   */
  getTurnStats(): any {
    const state = this.match.getStateManager().getState();
    
    return {
      currentTurn: state.turn,
      currentFaction: state.activeFaction,
      currentPhase: state.turnPhase,
      turnStartTime: this.timer.turnStartTime,
      phaseStartTime: this.timer.phaseStartTime,
      turnRemainingTime: this.getTurnRemainingTime(),
      phaseRemainingTime: this.getPhaseRemainingTime(),
      turnTimeLimit: this.config.turnTimeLimit,
      phaseTimeLimit: this.config.phaseTimeLimit,
      turnHistoryCount: this.turnHistory.length,
    };
  }

  /**
   * 获取回合历史
   */
  getTurnHistory(limit?: number): Array<{
    turn: number;
    faction: FactionType;
    startTime: number;
    endTime?: number;
    duration?: number | undefined;
    actions: number;
  }> {
    let history = this.turnHistory.map(turn => ({
      ...turn,
      duration: turn.endTime ? turn.endTime - turn.startTime : undefined,
    }));

    if (limit && limit > 0) {
      history = history.slice(-limit);
    }

    return history;
  }

  /**
   * 获取管理器统计
   */
  getStats(): any {
    const turnStats = this.getTurnStats();
    const recentHistory = this.getTurnHistory(5);
    
    return {
      ...turnStats,
      recentTurns: recentHistory,
      config: this.config,
    };
  }

  /**
   * 清除回合超时计时器
   */
  private clearTurnTimeout(): void {
    if (this.timer.turnTimeout) {
      clearTimeout(this.timer.turnTimeout);
      this.timer.turnTimeout = undefined;
    }
  }

  /**
   * 清除阶段超时计时器
   */
  private clearPhaseTimeout(): void {
    if (this.timer.phaseTimeout) {
      clearTimeout(this.timer.phaseTimeout);
      this.timer.phaseTimeout = undefined;
    }
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.clearTurnTimeout();
    this.clearPhaseTimeout();
    
    logger.info("Turn manager cleaned up", { roomId: this.match.roomId });
  }
}