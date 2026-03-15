/**
 * 状态同步模块导出
 */

// v1 - 基于 WS 消息的状态同步（保持向后兼容）
export { StateSync, createStateSync } from './StateSync';
export type { StateSyncOptions, MessageHandler } from './StateSync';

// v2 - 基于领域事件的状态同步
export { StateSyncV2, createStateSyncV2 } from './StateSyncV2';
export type { StateSyncV2Options, DomainEventHandler } from './StateSyncV2';

// WS 事件总线集成
export {
  WSEventBusIntegration,
  createWSEventBusIntegration,
  type WSEventBusIntegrationOptions,
} from './WSEventBusIntegration';
