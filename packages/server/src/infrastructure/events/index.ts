/**
 * 服务端事件模块导出
 */

// 原有事件总线集成
export { WSEventTranslator, createRoomEventBus, RoomEventBusManager } from './EventBusIntegration';
export type { WSEventTranslatorOptions } from './EventBusIntegration';

// 领域事件聚合器
export { DomainEventAggregator, createDomainEventAggregator } from './DomainEventAggregator';
export type { DomainEventAggregatorOptions } from './DomainEventAggregator';
