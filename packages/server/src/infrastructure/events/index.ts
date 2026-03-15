/**
 * 服务端事件模块导出
 */

// 领域事件聚合器（新架构）
export { DomainEventAggregator, createDomainEventAggregator } from './DomainEventAggregator';
export type { DomainEventAggregatorOptions } from './DomainEventAggregator';

// 向后兼容的导出（已迁移到 shared）
export { EventBus, DefaultEventTranslator, createDomainEvent, publishEvent } from '@vt/shared/events';
export type {
  IEventBus,
  EventHandler,
  Unsubscribe,
  EventTranslator,
  EventContext,
} from '@vt/shared/events';
