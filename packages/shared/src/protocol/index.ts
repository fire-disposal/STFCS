/**
 * 协议层导出
 *
 * 统一的消息协议 DSL 和领域事件定义
 */

// 消息协议 DSL
export {
  defineMessage,
  defineRequest,
  MessageValidator,
  MessageDispatcher,
} from './MessageDSL.js';

export type {
  MessageConfig,
  RequestConfig,
  MessageDirectory,
  InferMessageType,
  InferRequestType,
  InferResponseType,
  InferMessageMap,
  WSMessageFromDirectory,
  WSMessagePayloadMap,
} from './MessageDSL.js';

// 领域事件
export {
  DOMAIN_EVENTS,
  createDomainEvent,
} from './DomainEvents.js';

export type {
  DomainEventDirectory,
  DomainEvent,
  DomainEventType,
  DomainEventPayloadMap,
  EventContext,
} from './DomainEvents.js';

// 事件 Schema（用于扩展和验证）
export {
  ShipMovedEventSchema,
  ShieldToggledEventSchema,
  FluxStateUpdatedEventSchema,
  PlayerJoinedEventSchema,
  PlayerLeftEventSchema,
  PlayerDMModeChangedEventSchema,
  ObjectSelectedEventSchema,
  ObjectDeselectedEventSchema,
  TokenMovedEventSchema,
  TokenDragStartEventSchema,
  TokenDraggingEventSchema,
  TokenDragEndEventSchema,
  WeaponFiredEventSchema,
  DamageDealtEventSchema,
  CameraUpdatedEventSchema,
  TurnOrderInitializedEventSchema,
  TurnOrderUpdatedEventSchema,
  TurnIndexChangedEventSchema,
  UnitStateChangedEventSchema,
  RoundIncrementedEventSchema,
} from './DomainEvents.js';

// 协议版本
export { PROTOCOL_VERSION } from '../core-types.js';

// 重新导出 Zod 用于扩展
export { z } from 'zod';
