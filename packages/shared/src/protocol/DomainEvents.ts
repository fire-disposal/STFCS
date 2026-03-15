/**
 * 统一领域事件定义
 *
 * 使用 Message DSL 定义领域事件，确保类型安全和一致性
 */

import { z } from 'zod';
import { defineMessage } from './MessageDSL.js';
import { PointSchema, ArmorQuadrantSchema } from '../core-types.js';

// ==================== 事件 Payload Schema ====================

/**
 * 舰船移动事件
 */
export const ShipMovedEventSchema = z.object({
  shipId: z.string(),
  previousPosition: PointSchema,
  newPosition: PointSchema,
  previousHeading: z.number(),
  newHeading: z.number(),
  phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  timestamp: z.number(),
});

/**
 * 护盾切换事件
 */
export const ShieldToggledEventSchema = z.object({
  shipId: z.string(),
  isActive: z.boolean(),
  timestamp: z.number(),
});

/**
 * Flux 状态更新事件
 */
export const FluxStateUpdatedEventSchema = z.object({
  shipId: z.string(),
  fluxState: z.enum(['normal', 'venting', 'overloaded']),
  currentFlux: z.number().min(0),
  softFlux: z.number().min(0),
  hardFlux: z.number().min(0),
  timestamp: z.number(),
});

/**
 * 玩家加入事件
 */
export const PlayerJoinedEventSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  timestamp: z.number(),
});

/**
 * 玩家离开事件
 */
export const PlayerLeftEventSchema = z.object({
  playerId: z.string(),
  reason: z.string().optional(),
  timestamp: z.number(),
});

/**
 * 玩家 DM 模式变更事件
 */
export const PlayerDMModeChangedEventSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  isDMMode: z.boolean(),
  timestamp: z.number(),
});

/**
 * 对象选中事件
 */
export const ObjectSelectedEventSchema = z.object({
  tokenId: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  isDMMode: z.boolean(),
  timestamp: z.number(),
  forceOverride: z.boolean().optional(),
});

/**
 * 对象取消选中事件
 */
export const ObjectDeselectedEventSchema = z.object({
  tokenId: z.string(),
  playerId: z.string(),
  reason: z.enum(['manual', 'override', 'released']),
  timestamp: z.number(),
});

/**
 * Token 移动事件
 */
export const TokenMovedEventSchema = z.object({
  tokenId: z.string(),
  ownerId: z.string(),
  previousPosition: PointSchema,
  newPosition: PointSchema,
  previousHeading: z.number(),
  newHeading: z.number(),
  timestamp: z.number(),
});

/**
 * Token 拖拽开始事件
 */
export const TokenDragStartEventSchema = z.object({
  tokenId: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  position: PointSchema,
  heading: z.number(),
  timestamp: z.number(),
});

/**
 * Token 拖拽中事件
 */
export const TokenDraggingEventSchema = z.object({
  tokenId: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  position: PointSchema,
  heading: z.number(),
  isDragging: z.boolean(),
  timestamp: z.number(),
});

/**
 * Token 拖拽结束事件
 */
export const TokenDragEndEventSchema = z.object({
  tokenId: z.string(),
  playerId: z.string(),
  finalPosition: PointSchema,
  finalHeading: z.number(),
  committed: z.boolean(),
  timestamp: z.number(),
});

/**
 * 武器开火事件
 */
export const WeaponFiredEventSchema = z.object({
  sourceShipId: z.string(),
  targetShipId: z.string(),
  weaponId: z.string(),
  mountId: z.string(),
  timestamp: z.number(),
});

/**
 * 伤害造成事件
 */
export const DamageDealtEventSchema = z.object({
  sourceShipId: z.string(),
  targetShipId: z.string(),
  hit: z.boolean(),
  damage: z.number().min(0).optional(),
  shieldAbsorbed: z.number().min(0),
  armorReduced: z.number().min(0),
  hullDamage: z.number().min(0),
  hitQuadrant: ArmorQuadrantSchema.optional(),
  softFluxGenerated: z.number().min(0),
  hardFluxGenerated: z.number().min(0),
  timestamp: z.number(),
});

/**
 * 相机更新事件
 */
export const CameraUpdatedEventSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  centerX: z.number(),
  centerY: z.number(),
  zoom: z.number(),
  rotation: z.number(),
  timestamp: z.number(),
});

/**
 * 回合初始化事件
 */
export const TurnOrderInitializedEventSchema = z.object({
  units: z.array(z.object({
    id: z.string(),
    name: z.string(),
    ownerId: z.string(),
    ownerName: z.string(),
    unitType: z.enum(['ship', 'station', 'npc']),
    state: z.enum(['waiting', 'active', 'moved', 'acted', 'ended']),
    initiative: z.number(),
  })),
  roundNumber: z.number(),
  phase: z.enum(['planning', 'movement', 'action', 'resolution']),
  timestamp: z.number(),
});

/**
 * 回合更新事件
 */
export const TurnOrderUpdatedEventSchema = z.object({
  units: z.array(z.object({
    id: z.string(),
    name: z.string(),
    ownerId: z.string(),
    ownerName: z.string(),
    unitType: z.enum(['ship', 'station', 'npc']),
    state: z.enum(['waiting', 'active', 'moved', 'acted', 'ended']),
    initiative: z.number(),
  })),
  roundNumber: z.number(),
  phase: z.enum(['planning', 'movement', 'action', 'resolution']),
  timestamp: z.number(),
});

/**
 * 回合索引变更事件
 */
export const TurnIndexChangedEventSchema = z.object({
  currentIndex: z.number(),
  previousIndex: z.number(),
  roundNumber: z.number(),
  timestamp: z.number(),
});

/**
 * 单位状态变更事件
 */
export const UnitStateChangedEventSchema = z.object({
  unitId: z.string(),
  state: z.enum(['waiting', 'active', 'moved', 'acted', 'ended']),
  timestamp: z.number(),
});

/**
 * 回合数增加事件
 */
export const RoundIncrementedEventSchema = z.object({
  roundNumber: z.number(),
  timestamp: z.number(),
});

// ==================== 事件目录 ====================

/**
 * 领域事件目录
 * 使用 defineMessage 统一事件定义，支持类型推导和验证
 */
export const DOMAIN_EVENTS = {
  // 舰船事件
  SHIP_MOVED: defineMessage('SHIP_MOVED', ShipMovedEventSchema, {
    broadcast: true,
    description: '舰船移动',
  }),
  SHIELD_TOGGLED: defineMessage('SHIELD_TOGGLED', ShieldToggledEventSchema, {
    broadcast: true,
    description: '护盾切换',
  }),
  FLUX_STATE_UPDATED: defineMessage('FLUX_STATE_UPDATED', FluxStateUpdatedEventSchema, {
    broadcast: true,
    description: 'Flux 状态更新',
  }),

  // 玩家事件
  PLAYER_JOINED: defineMessage('PLAYER_JOINED', PlayerJoinedEventSchema, {
    broadcast: true,
    description: '玩家加入',
  }),
  PLAYER_LEFT: defineMessage('PLAYER_LEFT', PlayerLeftEventSchema, {
    broadcast: true,
    description: '玩家离开',
  }),
  PLAYER_DM_MODE_CHANGED: defineMessage('PLAYER_DM_MODE_CHANGED', PlayerDMModeChangedEventSchema, {
    broadcast: true,
    description: '玩家 DM 模式变更',
  }),

  // 选中事件
  OBJECT_SELECTED: defineMessage('OBJECT_SELECTED', ObjectSelectedEventSchema, {
    broadcast: true,
    description: '对象选中',
  }),
  OBJECT_DESELECTED: defineMessage('OBJECT_DESELECTED', ObjectDeselectedEventSchema, {
    broadcast: true,
    description: '对象取消选中',
  }),

  // Token 事件
  TOKEN_MOVED: defineMessage('TOKEN_MOVED', TokenMovedEventSchema, {
    broadcast: true,
    description: 'Token 移动',
  }),
  TOKEN_DRAG_START: defineMessage('TOKEN_DRAG_START', TokenDragStartEventSchema, {
    broadcast: true,
    description: 'Token 拖拽开始',
  }),
  TOKEN_DRAGGING: defineMessage('TOKEN_DRAGGING', TokenDraggingEventSchema, {
    broadcast: true,
    description: 'Token 拖拽中',
  }),
  TOKEN_DRAG_END: defineMessage('TOKEN_DRAG_END', TokenDragEndEventSchema, {
    broadcast: true,
    description: 'Token 拖拽结束',
  }),

  // 战斗事件
  WEAPON_FIRED: defineMessage('WEAPON_FIRED', WeaponFiredEventSchema, {
    broadcast: true,
    description: '武器开火',
  }),
  DAMAGE_DEALT: defineMessage('DAMAGE_DEALT', DamageDealtEventSchema, {
    broadcast: true,
    description: '伤害造成',
  }),

  // 相机事件
  CAMERA_UPDATED: defineMessage('CAMERA_UPDATED', CameraUpdatedEventSchema, {
    broadcast: true,
    description: '相机更新',
  }),

  // 回合事件
  TURN_ORDER_INITIALIZED: defineMessage('TURN_ORDER_INITIALIZED', TurnOrderInitializedEventSchema, {
    broadcast: true,
    description: '回合顺序初始化',
  }),
  TURN_ORDER_UPDATED: defineMessage('TURN_ORDER_UPDATED', TurnOrderUpdatedEventSchema, {
    broadcast: true,
    description: '回合顺序更新',
  }),
  TURN_INDEX_CHANGED: defineMessage('TURN_INDEX_CHANGED', TurnIndexChangedEventSchema, {
    broadcast: true,
    description: '回合索引变更',
  }),
  UNIT_STATE_CHANGED: defineMessage('UNIT_STATE_CHANGED', UnitStateChangedEventSchema, {
    broadcast: true,
    description: '单位状态变更',
  }),
  ROUND_INCREMENTED: defineMessage('ROUND_INCREMENTED', RoundIncrementedEventSchema, {
    broadcast: true,
    description: '回合数增加',
  }),
} as const;

// ==================== 类型推导 ====================

import type { InferMessageMap as InferEventsMap } from './MessageDSL.js';

/** 事件目录类型 */
export type DomainEventDirectory = typeof DOMAIN_EVENTS;

/** 领域事件类型 */
export type DomainEvent = InferEventsMap<DomainEventDirectory>;

/** 领域事件类型联合 */
export type DomainEventType = DomainEvent['type'];

/** 事件 Payload 映射 */
export type DomainEventPayloadMap = {
  [K in DomainEventType]: Extract<DomainEvent, { type: K }>['payload'];
};

// ==================== 事件创建工具 ====================

/**
 * 创建领域事件
 */
export function createDomainEvent<T extends DomainEventType>(
  type: T,
  payload: DomainEventPayloadMap[T]
): DomainEvent {
  return {
    type,
    payload,
  } as DomainEvent;
}

/**
 * 事件上下文
 */
export interface EventContext {
  roomId: string;
  playerId?: string;
  correlationId?: string;
}

// ==================== 导出 ====================

export { defineMessage } from './MessageDSL.js';
export type { MessageConfig } from './MessageDSL.js';
