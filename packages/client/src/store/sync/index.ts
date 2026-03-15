/**
 * 状态同步模块导出
 *
 * 基于领域事件的状态同步 v2
 */

// 状态同步器 v2
export { StateSyncV2, createStateSyncV2 } from './StateSyncV2';
export type { StateSyncV2Options, DomainEventHandler } from './StateSyncV2';

// WS 事件总线集成
export {
  WSEventBusIntegration,
  createWSEventBusIntegration,
  type WSEventBusIntegrationOptions,
} from './WSEventBusIntegration';
