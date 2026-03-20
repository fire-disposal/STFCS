/**
 * 领域事件总线 v2
 *
 * 基于统一协议层的事件总线，提供：
 * 1. 类型安全的事件发布和订阅
 * 2. 领域事件 → WS 消息自动转换
 * 3. 事件上下文追踪
 */

import type {
  DomainEvent,
  DomainEventType,
  DomainEventPayloadMap,
  EventContext,
} from '../protocol/DomainEvents.js';
import { createDomainEvent } from '../protocol/DomainEvents.js';
import type { WSMessage } from '../ws/index.js';
import { WS_MESSAGE_TYPES } from '../ws/index.js';

// ==================== 事件处理器类型 ====================

/** 事件处理器 */
export type EventHandler<T extends DomainEvent = DomainEvent> = (
  event: T,
  context: EventContext
) => void | Promise<void>;

/** 取消订阅函数 */
export type Unsubscribe = () => void;

// ==================== 事件到 WS 消息转换器 ====================

/**
 * 事件转换器接口
 */
export interface EventTranslator {
  /**
   * 将领域事件转换为 WS 消息
   */
  translate(event: DomainEvent, context: EventContext): WSMessage | null;
}

/**
 * 默认事件转换器
 * 将领域事件转换为对应的 WS 消息格式
 */
export class DefaultEventTranslator implements EventTranslator {
  translate(event: DomainEvent, _context: EventContext): WSMessage | null {
    const { type, payload } = event;

    switch (type) {
      // 舰船事件
      case 'SHIP_MOVED':
        return {
          type: WS_MESSAGE_TYPES.SHIP_MOVED,
          payload: {
            shipId: payload.shipId,
            phase: payload.phase,
            type: 'straight' as const,
            newX: payload.newPosition.x,
            newY: payload.newPosition.y,
            newHeading: payload.newHeading,
            timestamp: payload.timestamp,
          },
        };

      case 'SHIELD_TOGGLED':
        return {
          type: WS_MESSAGE_TYPES.SHIELD_UPDATE,
          payload: {
            shipId: payload.shipId,
            active: payload.isActive,
            type: 'front' as const,
            coverageAngle: 180,
          },
        };

      case 'FLUX_STATE_UPDATED':
        return {
          type: WS_MESSAGE_TYPES.FLUX_STATE,
          payload: {
            shipId: payload.shipId,
            fluxState: payload.fluxState,
            currentFlux: payload.currentFlux,
            softFlux: payload.softFlux,
            hardFlux: payload.hardFlux,
          },
        };

      // 玩家事件
      case 'PLAYER_JOINED':
        return {
          type: WS_MESSAGE_TYPES.PLAYER_JOINED,
          payload: {
            id: payload.playerId,
            name: payload.playerName,
            joinedAt: payload.timestamp,
            isActive: true,
            isDMMode: false,
          },
        };

      case 'PLAYER_LEFT':
        return {
          type: WS_MESSAGE_TYPES.PLAYER_LEFT,
          payload: {
            playerId: payload.playerId,
            reason: payload.reason,
          },
        };

      case 'PLAYER_DM_MODE_CHANGED':
        return {
          type: WS_MESSAGE_TYPES.DM_STATUS_UPDATE,
          payload: {
            players: [{
              id: payload.playerId,
              name: payload.playerName,
              isDMMode: payload.isDMMode,
            }],
          },
        };

      // 选中事件
      case 'OBJECT_SELECTED':
        return {
          type: WS_MESSAGE_TYPES.OBJECT_SELECTED,
          payload: {
            playerId: payload.playerId,
            playerName: payload.playerName,
            tokenId: payload.tokenId,
            timestamp: payload.timestamp,
            forceOverride: payload.forceOverride ?? false,
          },
        };

      case 'OBJECT_DESELECTED':
        return {
          type: WS_MESSAGE_TYPES.OBJECT_DESELECTED,
          payload: {
            playerId: payload.playerId,
            tokenId: payload.tokenId,
            timestamp: payload.timestamp,
            reason: payload.reason,
          },
        };

      // Token 事件
      case 'TOKEN_MOVED':
        return {
          type: WS_MESSAGE_TYPES.TOKEN_MOVED,
          payload: {
            tokenId: payload.tokenId,
            previousPosition: payload.previousPosition,
            newPosition: payload.newPosition,
            previousHeading: payload.previousHeading,
            newHeading: payload.newHeading,
            timestamp: payload.timestamp,
          },
        };

      case 'TOKEN_DRAG_START':
        return {
          type: WS_MESSAGE_TYPES.TOKEN_DRAG_START,
          payload: {
            tokenId: payload.tokenId,
            playerId: payload.playerId,
            playerName: payload.playerName,
            position: payload.position,
            heading: payload.heading,
            timestamp: payload.timestamp,
          },
        };

      case 'TOKEN_DRAGGING':
        return {
          type: WS_MESSAGE_TYPES.TOKEN_DRAGGING,
          payload: {
            tokenId: payload.tokenId,
            playerId: payload.playerId,
            playerName: payload.playerName,
            position: payload.position,
            heading: payload.heading,
            isDragging: payload.isDragging,
            timestamp: payload.timestamp,
          },
        };

      case 'TOKEN_DRAG_END':
        return {
          type: WS_MESSAGE_TYPES.TOKEN_DRAG_END,
          payload: {
            tokenId: payload.tokenId,
            playerId: payload.playerId,
            finalPosition: payload.finalPosition,
            finalHeading: payload.finalHeading,
            committed: payload.committed,
            timestamp: payload.timestamp,
          },
        };

      // 战斗事件
      case 'WEAPON_FIRED':
        return {
          type: WS_MESSAGE_TYPES.WEAPON_FIRED,
          payload: {
            sourceShipId: payload.sourceShipId,
            targetShipId: payload.targetShipId,
            weaponId: payload.weaponId,
            mountId: payload.mountId,
            timestamp: payload.timestamp,
          },
        };

      case 'DAMAGE_DEALT':
        return {
          type: WS_MESSAGE_TYPES.DAMAGE_DEALT,
          payload: {
            sourceShipId: payload.sourceShipId,
            targetShipId: payload.targetShipId,
            hit: payload.hit,
            damage: payload.damage,
            shieldAbsorbed: payload.shieldAbsorbed,
            armorReduced: payload.armorReduced,
            hullDamage: payload.hullDamage,
            hitQuadrant: payload.hitQuadrant,
            softFluxGenerated: payload.softFluxGenerated,
            hardFluxGenerated: payload.hardFluxGenerated,
            timestamp: payload.timestamp,
          },
        };

      // 相机事件
      case 'CAMERA_UPDATED':
        return {
          type: WS_MESSAGE_TYPES.CAMERA_UPDATED,
          payload: {
            playerId: payload.playerId,
            playerName: payload.playerName,
            centerX: payload.centerX,
            centerY: payload.centerY,
            zoom: payload.zoom,
            rotation: payload.rotation,
            timestamp: payload.timestamp,
          },
        };

      default:
        // 未知事件类型，不广播
        return null;
    }
  }
}

// ==================== 事件总线接口 ====================

/**
 * 事件总线接口
 */
export interface IEventBus {
  /**
   * 发布事件
   */
  publish<T extends DomainEvent>(
    event: T,
    context: EventContext
  ): Promise<void>;

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
  setWSBroadcaster(
    broadcaster: (message: WSMessage, excludeClientId?: string) => void
  ): void;
}

// ==================== 事件总线实现 ====================

/**
 * 事件总线实现
 */
export class EventBus implements IEventBus {
  private handlers: Map<DomainEventType, Set<EventHandler>> = new Map();
  private allHandlers: Set<EventHandler> = new Set();
  private translator: EventTranslator = new DefaultEventTranslator();
  private wsBroadcaster?: (message: WSMessage, excludeClientId?: string) => void;

  /**
   * 发布事件
   */
  async publish<T extends DomainEvent>(
    event: T,
    context: EventContext
  ): Promise<void> {
    // 确保事件有时间戳
    if (!('timestamp' in event.payload)) {
      (event.payload as any).timestamp = Date.now();
    }

    // 添加上下文信息到 payload
    const enrichedEvent: DomainEvent = {
      ...event,
      payload: {
        ...event.payload,
        roomId: context.roomId,
      } as any,
    };

    // 调用所有处理器
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
  setWSBroadcaster(
    broadcaster: (message: WSMessage, excludeClientId?: string) => void
  ): void {
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
 * 创建并发布领域事件
 */
export async function publishEvent<T extends DomainEventType>(
  eventBus: IEventBus,
  type: T,
  payload: DomainEventPayloadMap[T],
  context: EventContext
): Promise<void> {
  const event = createDomainEvent(type, payload) as DomainEvent;
  await eventBus.publish(event, context);
}

// ==================== 导出 ====================

export type { EventContext };
