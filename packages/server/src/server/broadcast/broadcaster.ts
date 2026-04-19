/**
 * 广播策略管理器
 */

import { createLogger } from "../../infra/simple-logger.js";
import type { GameEvent } from "../../core/types/common.js";
import type { Room } from "../rooms/Room.js";

const logger = createLogger("broadcaster");

/** 广播目标 */
export type BroadcastTarget = 
  | "ALL"                    // 广播给所有人
  | "FACTION"                // 广播给特定阵营
  | "PLAYER"                 // 广播给特定玩家
  | "EXCEPT_PLAYER"          // 广播给除特定玩家外的所有人
  | "SPECTATORS_ONLY"        // 只广播给观察者
  | "PLAYERS_ONLY";          // 只广播给玩家

/** 广播范围 */
export interface BroadcastScope {
  target: BroadcastTarget;
  faction?: string;
  playerId?: string;
  excludePlayerIds?: string[];
}

/** 广播消息 */
export interface BroadcastMessage {
  type: string;
  payload: any;
  timestamp: number;
  scope?: BroadcastScope;
  priority?: number; // 优先级（越高越先发送）
}

/** 广播策略 */
export interface BroadcastStrategy {
  name: string;
  shouldBroadcast(event: GameEvent, scope: BroadcastScope): boolean;
  transformMessage?(event: GameEvent, scope: BroadcastScope): BroadcastMessage;
  getDeliveryPriority?(event: GameEvent, scope: BroadcastScope): number;
}

/** 广播器配置 */
export interface BroadcasterConfig {
  defaultStrategy: string;
  enableCompression: boolean;
  batchSize: number;
  batchInterval: number;
  maxQueueSize: number;
}

const DEFAULT_CONFIG: BroadcasterConfig = {
  defaultStrategy: "reliable",
  enableCompression: false,
  batchSize: 10,
  batchInterval: 100, // 100ms
  maxQueueSize: 1000,
};

/** 广播器 */
export class Broadcaster {
  private config: BroadcasterConfig;
  private strategies: Map<string, BroadcastStrategy> = new Map();
  private messageQueue: Array<{
    message: BroadcastMessage;
    room: Room;
    scope: BroadcastScope;
  }> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor(config: Partial<BroadcasterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeDefaultStrategies();
    this.startBatchProcessor();
    
    logger.info("Broadcaster initialized", { config: this.config });
  }

  /**
   * 初始化默认策略
   */
  private initializeDefaultStrategies(): void {
    // 可靠广播策略（默认）
    this.addStrategy({
      name: "reliable",
      shouldBroadcast: (_event, _scope) => true,
      getDeliveryPriority: (_event, _scope) => {
        // 根据事件类型确定优先级
        switch (_event.type) {
          case "DAMAGE":
          case "SHIP_DESTROYED":
            return 100; // 高优先级
          case "MOVED":
          case "ROTATED":
            return 50; // 中优先级
          case "FLUX_CHANGED":
          case "TURN_CHANGED":
            return 30; // 低优先级
          default:
            return 10; // 默认优先级
        }
      },
    });

    // 优化广播策略（减少带宽）
    this.addStrategy({
      name: "optimized",
      shouldBroadcast: (_event, _scope) => {
        // 过滤掉不重要的频繁事件
        const frequentEvents = ["POSITION_UPDATE", "FLUX_UPDATE"];
        return !frequentEvents.includes(_event.type);
      },
      transformMessage: (_event, _scope) => {
        // 压缩消息
        return {
          type: _event.type,
          payload: this.compressPayload(_event.payload),
          timestamp: _event.timestamp,
          scope: _scope,
          priority: 20,
        };
      },
    });

    // 全量广播策略（调试用）
    this.addStrategy({
      name: "verbose",
      shouldBroadcast: (_event, _scope) => true,
      transformMessage: (_event, _scope) => ({
        type: _event.type,
        payload: _event.payload,
        timestamp: _event.timestamp,
        scope: _scope,
        priority: 5,
      }),
    });
  }

  /**
   * 添加广播策略
   */
  addStrategy(strategy: BroadcastStrategy): void {
    this.strategies.set(strategy.name, strategy);
    logger.debug("Added broadcast strategy", { name: strategy.name });
  }

  /**
   * 广播事件
   */
  broadcast(
    room: Room,
    event: GameEvent,
    scope: BroadcastScope = { target: "ALL" }
  ): void {
    // 检查队列大小
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      logger.warn("Broadcast queue full, dropping message", {
        queueSize: this.messageQueue.length,
        maxSize: this.config.maxQueueSize,
      });
      return;
    }

    // 获取策略
    const strategy = this.strategies.get(this.config.defaultStrategy) || 
                     this.strategies.get("reliable")!;

    // 检查是否应该广播
    if (!strategy.shouldBroadcast(event, scope)) {
      return;
    }

    // 转换消息
    const message = strategy.transformMessage 
      ? strategy.transformMessage(event, scope)
      : {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp,
          scope,
          priority: strategy.getDeliveryPriority?.(event, scope) || 10,
        };

    // 添加到队列
    this.messageQueue.push({ message, room, scope });

    // 如果队列达到批量大小，立即处理
    if (this.messageQueue.length >= this.config.batchSize) {
      this.processBatch();
    }
  }

  /**
   * 立即广播（跳过队列）
   */
  broadcastImmediate(
    room: Room,
    event: GameEvent,
    scope: BroadcastScope = { target: "ALL" }
  ): void {
    const strategy = this.strategies.get(this.config.defaultStrategy) || 
                     this.strategies.get("reliable")!;

    if (!strategy.shouldBroadcast(event, scope)) {
      return;
    }

    const message = strategy.transformMessage 
      ? strategy.transformMessage(event, scope)
      : {
          type: event.type,
          payload: event.payload,
          timestamp: event.timestamp,
          scope,
          priority: strategy.getDeliveryPriority?.(event, scope) || 100,
        };

    this.deliverMessage(room, message, scope);
  }

  /**
   * 开始批量处理器
   */
  private startBatchProcessor(): void {
    if (this.config.batchInterval <= 0) return;

    this.batchTimer = setInterval(() => {
      if (this.messageQueue.length > 0 && !this.isProcessing) {
        this.processBatch();
      }
    }, this.config.batchInterval);
  }

  /**
   * 处理批量消息
   */
  private processBatch(): void {
    if (this.isProcessing || this.messageQueue.length === 0) return;

    this.isProcessing = true;

    try {
      // 按优先级排序
      this.messageQueue.sort((a, b) => b.message.priority! - a.message.priority!);

      // 处理一批消息
      const batchSize = Math.min(this.config.batchSize, this.messageQueue.length);
      const batch = this.messageQueue.splice(0, batchSize);

      // 按房间分组
      const messagesByRoom = new Map<Room, Array<{ message: BroadcastMessage; scope: BroadcastScope }>>();
      
      for (const { message, room, scope } of batch) {
        if (!messagesByRoom.has(room)) {
          messagesByRoom.set(room, []);
        }
        const roomMessages = messagesByRoom.get(room);
        if (roomMessages) {
          roomMessages.push({ message, scope });
        }
      }

      // 发送消息
      for (const [room, messages] of messagesByRoom.entries()) {
        this.deliverMessages(room, messages);
      }

      logger.debug("Processed broadcast batch", {
        batchSize: batch.length,
        remaining: this.messageQueue.length,
        rooms: messagesByRoom.size,
      });
    } catch (error) {
      logger.error("Failed to process broadcast batch", error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 发送消息
   */
  private deliverMessages(
    room: Room,
    messages: Array<{ message: BroadcastMessage; scope: BroadcastScope }>
  ): void {
    // 按目标分组
    const messagesByTarget = new Map<string, BroadcastMessage[]>();
    
    for (const { message, scope } of messages) {
      const targetKey = this.getTargetKey(scope);
      if (!messagesByTarget.has(targetKey)) {
        messagesByTarget.set(targetKey, []);
      }
      messagesByTarget.get(targetKey)!.push(message);
    }

    // 发送给每个目标组
    for (const [targetKey, targetMessages] of messagesByTarget.entries()) {
      const scope = this.parseTargetKey(targetKey);
      
      // 批量发送
      if (targetMessages.length > 1 && this.config.enableCompression) {
        const batchMessage = this.createBatchMessage(targetMessages);
        this.deliverToTarget(room, batchMessage, scope);
      } else {
        for (const message of targetMessages) {
          this.deliverToTarget(room, message, scope);
        }
      }
    }
  }

  /**
   * 发送单个消息
   */
  private deliverMessage(
    room: Room,
    message: BroadcastMessage,
    scope: BroadcastScope
  ): void {
    this.deliverToTarget(room, message, scope);
  }

  /**
   * 发送给目标
   */
  private deliverToTarget(
    room: Room,
    message: BroadcastMessage,
    scope: BroadcastScope
  ): void {
    try {
      switch (scope.target) {
        case "ALL":
          room.broadcast({ type: message.type, payload: message.payload });
          break;
        case "FACTION":
          if (scope.faction) {
            room.broadcastToFaction(scope.faction, { type: message.type, payload: message.payload });
          }
          break;
        case "PLAYER":
          if (scope.playerId) {
            room.sendToPlayer(scope.playerId, { type: message.type, payload: message.payload });
          }
          break;
        case "EXCEPT_PLAYER":
          if (scope.playerId) {
            room.broadcastExcept(scope.playerId, { type: message.type, payload: message.payload });
          }
          break;
        case "SPECTATORS_ONLY":
          room.broadcastToSpectators({ type: message.type, payload: message.payload });
          break;
        case "PLAYERS_ONLY":
          room.broadcastToPlayers({ type: message.type, payload: message.payload });
          break;
      }
    } catch (error) {
      logger.error("Failed to deliver broadcast message", error, {
        roomId: room.id,
        messageType: message.type,
        scope,
      });
    }
  }

  /**
   * 创建批量消息
   */
  private createBatchMessage(messages: BroadcastMessage[]): BroadcastMessage {
    return {
      type: "BATCH",
      payload: {
        messages: messages.map(msg => ({
          type: msg.type,
          payload: msg.payload,
          timestamp: msg.timestamp,
        })),
      },
      timestamp: Date.now(),
      priority: Math.max(...messages.map(m => m.priority || 0)),
    };
  }

  /**
   * 压缩负载
   */
  private compressPayload(payload: any): any {
    if (!this.config.enableCompression) return payload;

    // 简化压缩：移除空值和默认值
    const compressed: any = {};
    
    for (const [key, value] of Object.entries(payload)) {
      if (value !== null && value !== undefined && value !== "" && value !== 0) {
        compressed[key] = value;
      }
    }

    return compressed;
  }

  /**
   * 获取目标键
   */
  private getTargetKey(scope: BroadcastScope): string {
    const parts: string[] = [scope.target];
    
    if (scope.faction) parts.push(`faction:${scope.faction}`);
    if (scope.playerId) parts.push(`player:${scope.playerId}`);
    if (scope.excludePlayerIds?.length) {
      parts.push(`exclude:${scope.excludePlayerIds.join(",")}`);
    }
    
    return parts.join("|");
  }

  /**
   * 解析目标键
   */
  private parseTargetKey(key: string): BroadcastScope {
    const parts = key.split("|");
    const scope: BroadcastScope = { target: parts[0] as BroadcastTarget };

    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      if (!part) continue;
      const [type, value] = part.split(":");
      if (!value) continue;
      
      switch (type) {
        case "faction":
          scope.faction = value;
          break;
        case "player":
          scope.playerId = value;
          break;
        case "exclude":
          scope.excludePlayerIds = value.split(",");
          break;
      }
    }

    return scope;
  }

  /**
   * 获取广播器统计
   */
  getStats(): any {
    return {
      config: this.config,
      queueSize: this.messageQueue.length,
      maxQueueSize: this.config.maxQueueSize,
      strategies: Array.from(this.strategies.keys()),
      isProcessing: this.isProcessing,
    };
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    this.messageQueue = [];
    logger.info("Broadcaster cleaned up");
  }
}

// 导出单例实例
export const broadcaster = new Broadcaster();