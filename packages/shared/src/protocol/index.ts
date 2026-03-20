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
} from './DomainEvents.js';

// 游戏阶段
export {
  GamePhaseSchema,
  TurnPhaseSchema,
  ShipActionTypeSchema,
  ActionRestrictionReasonSchema,
  GameFlowStateSchema,
  ShipActionStateSchema,
  ActionRequestSchema,
  ActionResultSchema,
  VALID_PHASE_TRANSITIONS,
  TURN_PHASE_ORDER,
  ACTION_RESTRICTIONS,
  isValidPhaseTransition,
  getNextTurnPhase,
  isActionRestricted,
} from './GamePhase.js';

export type {
  GamePhase,
  TurnPhase,
  ShipActionType,
  ActionRestrictionReason,
  GameFlowState,
  ShipActionState,
  ActionRequest,
  ActionResult,
} from './GamePhase.js';

// 状态同步
export {
  TokenDeltaSchema,
  ShipStatusDeltaSchema,
  BatchStateUpdateSchema,
  StateSyncRequestSchema,
  StateSyncResponseSchema,
  computeDelta,
  applyDelta,
  mergeDeltas,
  MessageBatcher,
  StateSnapshotManager,
  WS_COMPRESSION_OPTIONS,
} from './StateSync.js';

export type {
  TokenDelta,
  ShipStatusDelta,
  BatchStateUpdate,
  StateSyncRequest,
  StateSyncResponse,
  StateSnapshot,
} from './StateSync.js';

// 协议版本
export { PROTOCOL_VERSION } from '../core-types.js';

// 重新导出 Zod 用于扩展
export { z } from 'zod';

// ==================== 部署阶段协议 ====================

export {
  DEPLOYMENT_MESSAGE_TYPES,
  DeployShipRequestSchema,
  DeployShipResultSchema,
  RemoveDeployedShipRequestSchema,
  RemoveDeployedShipResultSchema,
  DeploymentReadyRequestSchema,
  DeploymentReadyUpdateSchema,
  DeploymentStartSchema,
  DeploymentCompleteSchema,
  DeploymentCancelSchema,
  DeploymentStateSchema,
  DeploymentStateSyncSchema,
  DeploymentShipsUpdateSchema,
  DeploymentMessageDirectory,
  createDefaultDeploymentState,
  isValidDeploymentPosition,
  areShipsOverlapping,
} from './DeploymentProtocol.js';

export type {
  DeploymentMessageType,
  DeployShipRequest,
  DeployShipResult,
  RemoveDeployedShipRequest,
  RemoveDeployedShipResult,
  DeploymentReadyRequest,
  DeploymentReadyUpdate,
  DeploymentStart,
  DeploymentComplete,
  DeploymentCancel,
  DeploymentState,
  DeploymentStateSync,
  DeploymentShipsUpdate,
} from './DeploymentProtocol.js';

// ==================== 战斗交互协议 ====================

export {
  COMBAT_MESSAGE_TYPES,
  SelectTargetRequestSchema,
  TargetSelectedSchema,
  ClearTargetSchema,
  SelectWeaponRequestSchema,
  WeaponSelectedSchema,
  ClearWeaponSchema,
  SelectQuadrantRequestSchema,
  QuadrantSelectedSchema,
  ClearQuadrantSchema,
  AttackPreviewRequestSchema,
  AttackPreviewResultSchema,
  ConfirmAttackRequestSchema,
  AttackResultSchema,
  DamageDealtEventSchema as CombatDamageDealtEventSchema,
  ShipDestroyedEventSchema,
  VentFluxRequestSchema,
  VentFluxResultSchema,
  OverloadTriggeredEventSchema,
  OverloadRecoveredEventSchema,
  ToggleShieldRequestSchema,
  ShieldToggledEventSchema as CombatShieldToggledEventSchema,
  CombatMessageDirectory,
  DAMAGE_MODIFIERS,
  MAX_DAMAGE_REDUCTION,
  MIN_DAMAGE_RATIO,
  calculateDamageModifier,
  calculateArmorDamageReduction,
} from './CombatProtocol.js';

export type {
  CombatMessageType,
  SelectTargetRequest,
  TargetSelected,
  ClearTarget,
  SelectWeaponRequest,
  WeaponSelected,
  ClearWeapon,
  SelectQuadrantRequest,
  QuadrantSelected,
  ClearQuadrant,
  AttackPreviewRequest,
  AttackPreviewResult,
  ConfirmAttackRequest,
  AttackResult,
  DamageDealtEvent,
  ShipDestroyedEvent,
  VentFluxRequest,
  VentFluxResult,
  OverloadTriggeredEvent,
  OverloadRecoveredEvent,
  ToggleShieldRequest,
  ShieldToggledEvent,
} from './CombatProtocol.js';
