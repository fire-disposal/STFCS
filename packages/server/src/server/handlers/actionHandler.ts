/**
 * Action消息处理器
 */

import { createLogger } from "../../infra/simple-logger.js";
import { gameRuntime } from "../../runtime/index.js";
import type { GameAction } from "../../core/types/common.js";

const logger = createLogger("action-handler");

/** Action处理器配置 */
export interface ActionHandlerConfig {
  validateActions: boolean;
  maxActionsPerSecond: number;
  actionTimeout: number;
}

const DEFAULT_CONFIG: ActionHandlerConfig = {
  validateActions: true,
  maxActionsPerSecond: 10,
  actionTimeout: 5000, // 5秒
};

/** Action处理器 */
export class ActionHandler {
  private config: ActionHandlerConfig;
  private actionCounters: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(config: Partial<ActionHandlerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 处理Action消息
   */
  async handleAction(
    roomId: string,
    playerId: string,
    actionData: any
  ): Promise<{ success: boolean; error?: string; events?: any[] }> {
    const sessionKey = `${roomId}:${playerId}`;
    
    // 检查速率限制
    if (!this.checkRateLimit(sessionKey)) {
      return {
        success: false,
        error: "Action rate limit exceeded",
      };
    }

    // 验证Action数据
    if (this.config.validateActions) {
      const validation = this.validateActionData(actionData);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
        };
      }
    }

    // 创建GameAction
    const action: GameAction = {
      type: actionData.type,
      playerId,
      timestamp: Date.now(),
      payload: actionData.payload,
    };

    try {
      // 处理Action（带超时）
      const result = await this.processActionWithTimeout(roomId, action);
      
      if (result.success) {
        // 更新计数器
        this.incrementActionCounter(sessionKey);
      }
      
      return result;
    } catch (error) {
      logger.error("Failed to handle action", error, { roomId, playerId, actionData });
      return {
        success: false,
        error: "Internal server error",
      };
    }
  }

  /**
   * 处理Action（带超时）
   */
  private async processActionWithTimeout(
    roomId: string,
    action: GameAction
  ): Promise<{ success: boolean; error?: string; events?: any[] }> {
    if (this.config.actionTimeout <= 0) {
      return gameRuntime.processAction(roomId, action);
    }

    const timeoutPromise = new Promise<{ success: boolean; error: string }>((resolve) => {
      setTimeout(() => {
        resolve({
          success: false,
          error: "Action processing timeout",
        });
      }, this.config.actionTimeout);
    });

    const actionPromise = gameRuntime.processAction(roomId, action);

    try {
      const result = await Promise.race([actionPromise, timeoutPromise]);
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * 验证Action数据
   */
  private validateActionData(actionData: any): { valid: boolean; error?: string } {
    if (!actionData) {
      return { valid: false, error: "Action data is required" };
    }

    if (!actionData.type || typeof actionData.type !== "string") {
      return { valid: false, error: "Action type is required and must be a string" };
    }

    if (!actionData.payload || typeof actionData.payload !== "object") {
      return { valid: false, error: "Action payload is required and must be an object" };
    }

    // 验证特定Action类型
    switch (actionData.type) {
      case "MOVE":
        return this.validateMoveAction(actionData.payload);
      case "ATTACK":
        return this.validateAttackAction(actionData.payload);
      case "ROTATE":
        return this.validateRotateAction(actionData.payload);
      case "END_TURN":
        return this.validateEndTurnAction(actionData.payload);
      case "TOGGLE_SHIELD":
        return this.validateToggleShieldAction(actionData.payload);
      case "VENT_FLUX":
        return this.validateVentFluxAction(actionData.payload);
      default:
        // 未知Action类型，但允许通过（可能由其他模块处理）
        return { valid: true };
    }
  }

  /**
   * 验证移动Action
   */
  private validateMoveAction(payload: any): { valid: boolean; error?: string } {
    if (!payload.shipId || typeof payload.shipId !== "string") {
      return { valid: false, error: "shipId is required for MOVE action" };
    }

    if (payload.distance !== undefined && typeof payload.direction !== "number") {
      return { valid: false, error: "distance must be a number" };
    }

    if (payload.direction !== undefined && typeof payload.direction !== "number") {
      return { valid: false, error: "direction must be a number" };
    }

    return { valid: true };
  }

  /**
   * 验证攻击Action
   */
  private validateAttackAction(payload: any): { valid: boolean; error?: string } {
    if (!payload.attackerId || typeof payload.attackerId !== "string") {
      return { valid: false, error: "attackerId is required for ATTACK action" };
    }

    if (!payload.targetId || typeof payload.targetId !== "string") {
      return { valid: false, error: "targetId is required for ATTACK action" };
    }

    if (!payload.weaponId || typeof payload.weaponId !== "string") {
      return { valid: false, error: "weaponId is required for ATTACK action" };
    }

    if (payload.targetQuadrant !== undefined && 
        (typeof payload.targetQuadrant !== "number" || payload.targetQuadrant < 0 || payload.targetQuadrant > 5)) {
      return { valid: false, error: "targetQuadrant must be a number between 0 and 5" };
    }

    return { valid: true };
  }

  /**
   * 验证旋转Action
   */
  private validateRotateAction(payload: any): { valid: boolean; error?: string } {
    if (!payload.shipId || typeof payload.shipId !== "string") {
      return { valid: false, error: "shipId is required for ROTATE action" };
    }

    if (payload.angle === undefined || typeof payload.angle !== "number") {
      return { valid: false, error: "angle is required and must be a number" };
    }

    return { valid: true };
  }

  /**
   * 验证结束回合Action
   */
  private validateEndTurnAction(payload: any): { valid: boolean; error?: string } {
    // END_TURN action通常不需要payload
    return { valid: true };
  }

  /**
   * 验证切换护盾Action
   */
  private validateToggleShieldAction(payload: any): { valid: boolean; error?: string } {
    if (!payload.shipId || typeof payload.shipId !== "string") {
      return { valid: false, error: "shipId is required for TOGGLE_SHIELD action" };
    }

    if (payload.active !== undefined && typeof payload.active !== "boolean") {
      return { valid: false, error: "active must be a boolean" };
    }

    return { valid: true };
  }

  /**
   * 验证排散辐能Action
   */
  private validateVentFluxAction(payload: any): { valid: boolean; error?: string } {
    if (!payload.shipId || typeof payload.shipId !== "string") {
      return { valid: false, error: "shipId is required for VENT_FLUX action" };
    }

    return { valid: true };
  }

  /**
   * 检查速率限制
   */
  private checkRateLimit(sessionKey: string): boolean {
    if (this.config.maxActionsPerSecond <= 0) {
      return true; // 无限制
    }

    const now = Date.now();
    const counter = this.actionCounters.get(sessionKey);

    if (!counter) {
      // 第一次请求
      this.actionCounters.set(sessionKey, {
        count: 1,
        resetTime: now + 1000, // 1秒后重置
      });
      return true;
    }

    // 检查是否需要重置计数器
    if (now >= counter.resetTime) {
      counter.count = 1;
      counter.resetTime = now + 1000;
      return true;
    }

    // 检查是否超过限制
    if (counter.count >= this.config.maxActionsPerSecond) {
      return false;
    }

    return true;
  }

  /**
   * 增加Action计数器
   */
  private incrementActionCounter(sessionKey: string): void {
    const counter = this.actionCounters.get(sessionKey);
    if (counter) {
      counter.count++;
    }
  }

  /**
   * 清理过期的计数器
   */
  cleanupExpiredCounters(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, counter] of this.actionCounters.entries()) {
      if (now >= counter.resetTime + 5000) { // 重置后5秒清理
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.actionCounters.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug("Cleaned up expired action counters", { count: expiredKeys.length });
    }
  }

  /**
   * 获取处理器统计
   */
  getStats(): any {
    return {
      config: this.config,
      activeSessions: this.actionCounters.size,
      totalActions: Array.from(this.actionCounters.values())
        .reduce((sum, counter) => sum + counter.count, 0),
    };
  }
}

// 导出单例实例
export const actionHandler = new ActionHandler();