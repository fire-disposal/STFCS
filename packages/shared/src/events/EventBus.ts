/**
 * 领域事件总线
 *
 * 提供类型安全的事件发布和订阅
 */

import type { DomainEvent, DomainEventType, EventContext } from '../protocol/index.js';
import { createDomainEvent } from '../protocol/index.js';

// ==================== 事件处理器类型 ====================

/** 事件处理器 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T
) => void | Promise<void>;

/** 取消订阅函数 */
export type Unsubscribe = () => void;

// ==================== 事件总线接口 ====================

export interface IEventBus {
  publish<T extends DomainEvent>(event: T, context?: EventContext): Promise<void>;
  subscribe<T extends DomainEventType>(
    type: T,
    handler: EventHandler<Extract<DomainEvent, { type: T }>>
  ): Unsubscribe;
  subscribeAll(handler: EventHandler): Unsubscribe;
}

// ==================== 事件总线实现 ====================

export class EventBus implements IEventBus {
  private handlers: Map<DomainEventType, Set<EventHandler>> = new Map();
  private allHandlers: Set<EventHandler> = new Set();

  async publish<T extends DomainEvent>(
    event: T,
    _context?: EventContext
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // 全局处理器
    this.allHandlers.forEach(handler => {
      const result = handler(event);
      if (result instanceof Promise) promises.push(result);
    });

    // 类型处理器
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        const result = handler(event as any);
        if (result instanceof Promise) promises.push(result);
      });
    }

    await Promise.all(promises);
  }

  subscribe<T extends DomainEventType>(
    type: T,
    handler: EventHandler<Extract<DomainEvent, { type: T }>>
  ): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);
    return () => this.handlers.get(type)?.delete(handler as EventHandler);
  }

  subscribeAll(handler: EventHandler): Unsubscribe {
    this.allHandlers.add(handler);
    return () => this.allHandlers.delete(handler);
  }
}

// ==================== 事件创建工具 ====================

export async function publishEvent<T extends string>(
  eventBus: IEventBus,
  type: T,
  payload: unknown,
  context?: EventContext
): Promise<void> {
  const event = createDomainEvent(type as any, payload);
  await eventBus.publish(event, context);
}