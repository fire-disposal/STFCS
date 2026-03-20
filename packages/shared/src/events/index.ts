/**
 * 领域事件导出
 */

export * from './EventBus.js';

// 从 protocol 重新导出事件类型
export type { DomainEvent, DomainEventType, EventContext } from '../protocol/index.js';
export { createDomainEvent } from '../protocol/index.js';