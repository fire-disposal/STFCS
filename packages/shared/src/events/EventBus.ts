/**
 * 领域事件总线
 * 
 * 目标：
 * 1. 统一领域事件的发布和订阅
 * 2. 提供类型安全的事件处理
 * 3. 支持事件转换（领域事件 → WS 消息）
 */

import { z } from 'zod';

// ==================== 基础事件类型 ====================

/** 基础事件接口 */
export interface IDomainEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly roomId?: string;
}

/** 事件上下文 */
export interface EventContext {
  roomId: string;
  playerId?: string;
  correlationId?: string;
}

// ==================== 领域事件定义 ====================

/**
 * 舰船事件
 */
export interface ShipMovedEvent extends IDomainEvent {
  type: 'SHIP_MOVED';
  shipId: string;
  previousPosition: { x: number; y: number };
  newPosition: { x: number; y: number };
  previousHeading: number;
  newHeading: number;
  phase: 1 | 2 | 3;
}

export interface ShieldToggledEvent extends IDomainEvent {
  type: 'SHIELD_TOGGLED';
  shipId: string;
  isActive: boolean;
}

export interface FluxStateUpdatedEvent extends IDomainEvent {
  type: 'FLUX_STATE_UPDATED';
  shipId: string;
  fluxState: 'normal' | 'venting' | 'overloaded';
  currentFlux: number;
  softFlux: number;
  hardFlux: number;
}

/**
 * 玩家事件
 */
export interface PlayerJoinedEvent extends IDomainEvent {
  type: 'PLAYER_JOINED';
  playerId: string;
  playerName: string;
}

export interface PlayerLeftEvent extends IDomainEvent {
  type: 'PLAYER_LEFT';
  playerId: string;
  reason?: string;
}

export interface PlayerDMModeChangedEvent extends IDomainEvent {
  type: 'PLAYER_DM_MODE_CHANGED';
  playerId: string;
  playerName: string;
  isDMMode: boolean;
}

/**
 * Token/选中事件
 */
export interface ObjectSelectedEvent extends IDomainEvent {
  type: 'OBJECT_SELECTED';
  tokenId: string;
  playerId: string;
  playerName: string;
  isDMMode: boolean;
}

export interface ObjectDeselectedEvent extends IDomainEvent {
  type: 'OBJECT_DESELECTED';
  tokenId: string;
  playerId: string;
  reason: 'manual' | 'override' | 'released';
}

export interface TokenMovedEvent extends IDomainEvent {
  type: 'TOKEN_MOVED';
  tokenId: string;
  ownerId: string;
  previousPosition: { x: number; y: number };
  newPosition: { x: number; y: number };
  previousHeading: number;
  newHeading: number;
}

/**
 * 战斗事件
 */
export interface WeaponFiredEvent extends IDomainEvent {
  type: 'WEAPON_FIRED';
  sourceShipId: string;
  targetShipId: string;
  weaponId: string;
  mountId: string;
}

export interface DamageDealtEvent extends IDomainEvent {
  type: 'DAMAGE_DEALT';
  sourceShipId: string;
  targetShipId: string;
  hit: boolean;
  damage?: number;
  shieldAbsorbed: number;
  armorReduced: number;
  hullDamage: number;
  softFluxGenerated: number;
  hardFluxGenerated: number;
}

/**
 * 联合类型
 */
export type DomainEvent =
  | ShipMovedEvent
  | ShieldToggledEvent
  | FluxStateUpdatedEvent
  | PlayerJoinedEvent
  | PlayerLeftEvent
  | PlayerDMModeChangedEvent
  | ObjectSelectedEvent
  | ObjectDeselectedEvent
  | TokenMovedEvent
  | WeaponFiredEvent
  | DamageDealtEvent;

export type DomainEventType = DomainEvent['type'];

// ==================== 事件到 WS 消息的转换 ====================

/**
 * 事件转换器接口
 */
export interface EventTranslator {
  /**
   * 将领域事件转换为 WS 消息
   * @param event 领域事件
   * @param context 事件上下文
   * @returns WS 消息，如果返回 null 则表示不广播
   */
  translate(event: DomainEvent, context: EventContext): unknown | null;
}

/**
 * 默认事件转换器
 */
export class DefaultEventTranslator implements EventTranslator {
  translate(event: DomainEvent, context: EventContext): unknown | null {
    switch (event.type) {
      case 'SHIP_MOVED':
        return {
          type: 'SHIP_MOVED' as const,
          payload: {
            shipId: event.shipId,
            phase: event.phase,
            type: 'straight' as const,
            newX: event.newPosition.x,
            newY: event.newPosition.y,
            newHeading: event.newHeading,
            timestamp: event.timestamp,
          },
        };

      case 'OBJECT_SELECTED':
        return {
          type: 'OBJECT_SELECTED' as const,
          payload: {
            playerId: event.playerId,
            playerName: event.playerName,
            tokenId: event.tokenId,
            timestamp: event.timestamp,
            forceOverride: false,
          },
        };

      case 'OBJECT_DESELECTED':
        return {
          type: 'OBJECT_DESELECTED' as const,
          payload: {
            playerId: event.playerId,
            tokenId: event.tokenId,
            timestamp: event.timestamp,
            reason: event.reason,
          },
        };

      case 'TOKEN_MOVED':
        return {
          type: 'TOKEN_MOVED' as const,
          payload: {
            tokenId: event.tokenId,
            previousPosition: event.previousPosition,
            newPosition: event.newPosition,
            previousHeading: event.previousHeading,
            newHeading: event.newHeading,
            timestamp: event.timestamp,
          },
        };

      case 'WEAPON_FIRED':
        return {
          type: 'WEAPON_FIRED' as const,
          payload: {
            sourceShipId: event.sourceShipId,
            targetShipId: event.targetShipId,
            weaponId: event.weaponId,
            mountId: event.mountId,
            timestamp: event.timestamp,
          },
        };

      case 'DAMAGE_DEALT':
        return {
          type: 'DAMAGE_DEALT' as const,
          payload: {
            sourceShipId: event.sourceShipId,
            targetShipId: event.targetShipId,
            hit: event.hit,
            damage: event.damage,
            shieldAbsorbed: event.shieldAbsorbed,
            armorReduced: event.armorReduced,
            hullDamage: event.hullDamage,
            softFluxGenerated: event.softFluxGenerated,
            hardFluxGenerated: event.hardFluxGenerated,
            timestamp: event.timestamp,
          },
        };

      default:
        // 未知事件类型，不广播
        return null;
    }
  }
}

// ==================== 事件总线接口 ====================

/** 事件处理器 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
  context: EventContext
) => void | Promise<void>;

/** 取消订阅函数 */
export type Unsubscribe = () => void;

/**
 * 事件总线接口
 */
export interface IEventBus {
  /**
   * 发布事件
   */
  publish<T extends DomainEvent>(event: T, context: EventContext): Promise<void>;

  /**
   * 订阅特定类型的事件
   */
  subscribe<T extends DomainEventType>(
    type: T,
    handler: EventHandler<Extract<DomainEvent, { type: T }>>
  ): Unsubscribe;

  /**
   * 订阅所有事件
   */
  subscribeAll(handler: EventHandler): Unsubscribe;

  /**
   * 设置事件转换器
   */
  setTranslator(translator: EventTranslator): void;

  /**
   * 设置 WS 广播函数
   */
  setWSBroadcaster(broadcaster: (message: unknown, excludeClientId?: string) => void): void;
}

/**
 * 事件总线实现
 */
export class EventBus implements IEventBus {
  private handlers: Map<DomainEventType, Set<EventHandler>> = new Map();
  private allHandlers: Set<EventHandler> = new Set();
  private translator: EventTranslator = new DefaultEventTranslator();
  private wsBroadcaster?: (message: unknown, excludeClientId?: string) => void;

  /**
   * 发布事件
   */
  async publish<T extends DomainEvent>(event: T, context: EventContext): Promise<void> {
    // 确保事件有时间戳
    if (!event.timestamp) {
      (event as any).timestamp = Date.now();
    }

    // 添加上下文信息
    const enrichedEvent = { ...event, roomId: context.roomId };

    // 调用所有事件处理器
    const allPromises: Promise<void>[] = [];

    // 调用全局处理器
    this.allHandlers.forEach(handler => {
      const result = handler(enrichedEvent, context);
      if (result instanceof Promise) {
        allPromises.push(result);
      }
    });

    // 调用特定类型处理器
    const typeHandlers = this.handlers.get(event.type);
    if (typeHandlers) {
      typeHandlers.forEach(handler => {
        const result = handler(enrichedEvent as any, context);
        if (result instanceof Promise) {
          allPromises.push(result);
        }
      });
    }

    // 等待所有处理器完成
    await Promise.all(allPromises);

    // 转换为 WS 消息并广播
    this.broadcastToWS(enrichedEvent, context);
  }

  /**
   * 订阅特定类型的事件
   */
  subscribe<T extends DomainEventType>(
    type: T,
    handler: EventHandler<Extract<DomainEvent, { type: T }>>
  ): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler);
    };
  }

  /**
   * 订阅所有事件
   */
  subscribeAll(handler: EventHandler): Unsubscribe {
    this.allHandlers.add(handler);

    return () => {
      this.allHandlers.delete(handler);
    };
  }

  /**
   * 设置事件转换器
   */
  setTranslator(translator: EventTranslator): void {
    this.translator = translator;
  }

  /**
   * 设置 WS 广播函数
   */
  setWSBroadcaster(broadcaster: (message: unknown, excludeClientId?: string) => void): void {
    this.wsBroadcaster = broadcaster;
  }

  /**
   * 广播到 WS
   */
  private broadcastToWS(event: DomainEvent, context: EventContext): void {
    if (!this.wsBroadcaster) return;

    const message = this.translator.translate(event, context);
    if (message) {
      this.wsBroadcaster(message);
    }
  }
}

// ==================== 事件创建工具 ====================

/**
 * 创建领域事件
 */
export function createDomainEvent<T extends DomainEventType>(
  type: T,
  data: Omit<Extract<DomainEvent, { type: T }>, 'type' | 'timestamp' | 'roomId'>,
  context: EventContext
): Extract<DomainEvent, { type: T }> {
  return {
    ...data,
    type,
    timestamp: Date.now(),
    roomId: context.roomId,
  } as Extract<DomainEvent, { type: T }>;
}

// ==================== 导出 ====================

export {
  ShipMovedEvent,
  ShieldToggledEvent,
  FluxStateUpdatedEvent,
  PlayerJoinedEvent,
  PlayerLeftEvent,
  PlayerDMModeChangedEvent,
  ObjectSelectedEvent,
  ObjectDeselectedEvent,
  TokenMovedEvent,
  WeaponFiredEvent,
  DamageDealtEvent,
};
