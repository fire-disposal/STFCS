/**
 * 领域事件导出
 */

export * from './EventBus.js';

// 重新导出协议层的领域事件类型
export type {
  DomainEvent,
  DomainEventType,
  DomainEventPayloadMap,
} from '../protocol/DomainEvents.js';

export { createDomainEvent } from '../protocol/DomainEvents.js';
