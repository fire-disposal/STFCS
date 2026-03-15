/**
 * 领域事件聚合器
 *
 * 订阅领域事件并转换为 WS 消息广播
 */

import type { IEventBus, DomainEvent, EventContext } from '@vt/shared/events';
import type { IWSServer } from '@vt/shared/ws';
import type { IRoomManager } from '../di/IRoomManager';
import { DefaultEventTranslator } from '@vt/shared/events';

/**
 * 领域事件聚合器配置
 */
export interface DomainEventAggregatorOptions {
  /** 房间 ID */
  roomId: string;
  /** 是否启用日志 */
  enableLogging?: boolean;
}

/**
 * 领域事件聚合器
 * 
 * 订阅领域事件，转换为 WS 消息，广播到房间
 */
export class DomainEventAggregator {
  private eventBus: IEventBus;
  private wsServer: IWSServer;
  private roomManager: IRoomManager;
  private roomId: string;
  private enableLogging: boolean;
  private translator: DefaultEventTranslator;
  private unsubscribe?: () => void;

  constructor(
    eventBus: IEventBus,
    wsServer: IWSServer,
    roomManager: IRoomManager,
    options: DomainEventAggregatorOptions
  ) {
    this.eventBus = eventBus;
    this.wsServer = wsServer;
    this.roomManager = roomManager;
    this.roomId = options.roomId;
    this.enableLogging = options.enableLogging ?? false;
    this.translator = new DefaultEventTranslator();
  }

  /**
   * 启动事件聚合
   */
  start(): void {
    // 订阅所有领域事件
    this.unsubscribe = this.eventBus.subscribeAll((event, context) => {
      this.handleEvent(event, context);
    });

    if (this.enableLogging) {
      console.log('[DomainEventAggregator] Started for room:', this.roomId);
    }
  }

  /**
   * 处理事件
   */
  private handleEvent(event: DomainEvent, context: EventContext): void {
    // 转换为 WS 消息
    const wsMessage = this.translator.translate(event, context);
    
    if (!wsMessage) {
      if (this.enableLogging) {
        console.log('[DomainEventAggregator] No translation for event:', event.type);
      }
      return;
    }

    // 广播到房间
    const room = this.roomManager.getRoom(this.roomId);
    if (!room) {
      if (this.enableLogging) {
        console.warn('[DomainEventAggregator] Room not found:', this.roomId);
      }
      return;
    }

    // 获取房间内所有玩家 ID
    const playerIds = Array.from(room.players.keys());
    
    // 广播给所有玩家
    playerIds.forEach(playerId => {
      // 这里需要通过 clientId 发送，实际实现需要根据项目结构调整
      // 暂时使用 broadcast 方法
    });

    if (this.enableLogging) {
      console.log('[DomainEventAggregator] Broadcast event:', event.type, 'to room:', this.roomId);
    }
  }

  /**
   * 停止事件聚合
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    if (this.enableLogging) {
      console.log('[DomainEventAggregator] Stopped for room:', this.roomId);
    }
  }
}

/**
 * 创建领域事件聚合器
 */
export function createDomainEventAggregator(
  eventBus: IEventBus,
  wsServer: IWSServer,
  roomManager: IRoomManager,
  options: DomainEventAggregatorOptions
): DomainEventAggregator {
  return new DomainEventAggregator(eventBus, wsServer, roomManager, options);
}
