/**
 * 事件总线集成
 *
 * 将 WebSocket 服务与领域事件总线连接
 */

import type { IEventBus, EventContext } from '@vt/shared';
import type { WebSocketService } from '@/services/websocket';
import type { DomainEvent } from '@vt/shared';
import { EventBus, DefaultEventTranslator } from '@vt/shared';

/**
 * WS 事件总线集成配置
 */
export interface WSEventBusIntegrationOptions {
  /** 房间 ID */
  roomId: string;
  /** 是否启用日志 */
  enableLogging?: boolean;
}

/**
 * WS 事件总线集成
 */
export class WSEventBusIntegration {
  private eventBus: IEventBus;
  private ws: WebSocketService;
  private roomId: string;
  private enableLogging: boolean;
  private disposed: boolean = false;

  constructor(
    ws: WebSocketService,
    options: WSEventBusIntegrationOptions
  ) {
    this.ws = ws;
    this.roomId = options.roomId;
    this.enableLogging = options.enableLogging ?? false;

    // 创建事件总线
    this.eventBus = new EventBus();

    // 设置 WS 广播器
    this.eventBus.setWSBroadcaster((message, excludeClientId) => {
      if (this.disposed) return;
      
      // 广播到 WS
      if (this.enableLogging) {
        console.log('[WSEventBus] Broadcasting:', message);
      }
      this.ws.send(message as any);
    });

    // 设置事件转换器
    this.eventBus.setTranslator(new DefaultEventTranslator());

    // 订阅 WS 消息并转换为领域事件
    this.setupWSListeners();
  }

  /**
   * 设置 WS 监听器
   */
  private setupWSListeners(): void {
    // 监听 WS 消息并转换为领域事件
    // 注意：这里需要从 WS 消息反向转换为领域事件
    // 由于我们已经有 EventTranslator 做正向转换，这里需要反向转换
    
    // 简化实现：直接订阅 WS 消息并触发事件总线
    this.ws.on('SHIP_MOVED', (payload) => {
      this.publishFromWS('SHIP_MOVED', {
        shipId: payload.shipId,
        previousPosition: { x: 0, y: 0 }, // 需要从其他地方获取
        newPosition: { x: payload.newX, y: payload.newY },
        previousHeading: 0, // 需要从其他地方获取
        newHeading: payload.newHeading,
        phase: payload.phase,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('OBJECT_SELECTED', (payload) => {
      this.publishFromWS('OBJECT_SELECTED', {
        tokenId: payload.tokenId,
        playerId: payload.playerId,
        playerName: payload.playerName,
        isDMMode: payload.forceOverride ?? false,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('OBJECT_DESELECTED', (payload) => {
      this.publishFromWS('OBJECT_DESELECTED', {
        tokenId: payload.tokenId,
        playerId: payload.playerId,
        reason: payload.reason,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('TOKEN_MOVED', (payload) => {
      this.publishFromWS('TOKEN_MOVED', {
        tokenId: payload.tokenId,
        ownerId: '', // 需要从其他地方获取
        previousPosition: payload.previousPosition,
        newPosition: payload.newPosition,
        previousHeading: payload.previousHeading,
        newHeading: payload.newHeading,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('TOKEN_DRAG_START', (payload) => {
      this.publishFromWS('TOKEN_DRAG_START', {
        tokenId: payload.tokenId,
        playerId: payload.playerId,
        playerName: payload.playerName,
        position: payload.position,
        heading: payload.heading,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('TOKEN_DRAGGING', (payload) => {
      this.publishFromWS('TOKEN_DRAGGING', {
        tokenId: payload.tokenId,
        playerId: payload.playerId,
        playerName: payload.playerName,
        position: payload.position,
        heading: payload.heading,
        isDragging: payload.isDragging,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('TOKEN_DRAG_END', (payload) => {
      this.publishFromWS('TOKEN_DRAG_END', {
        tokenId: payload.tokenId,
        playerId: payload.playerId,
        finalPosition: payload.finalPosition,
        finalHeading: payload.finalHeading,
        committed: payload.committed,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('CAMERA_UPDATED', (payload) => {
      this.publishFromWS('CAMERA_UPDATED', {
        playerId: payload.playerId,
        playerName: payload.playerName,
        centerX: payload.centerX,
        centerY: payload.centerY,
        zoom: payload.zoom,
        rotation: payload.rotation,
        timestamp: payload.timestamp,
      });
    });

    this.ws.on('PLAYER_JOINED', (payload) => {
      this.publishFromWS('PLAYER_JOINED', {
        playerId: payload.id,
        playerName: payload.name,
        timestamp: payload.joinedAt,
      });
    });

    this.ws.on('PLAYER_LEFT', (payload) => {
      this.publishFromWS('PLAYER_LEFT', {
        playerId: payload.playerId,
        reason: payload.reason,
      });
    });

    this.ws.on('DM_STATUS_UPDATE', (payload) => {
      payload.players.forEach(p => {
        this.publishFromWS('PLAYER_DM_MODE_CHANGED', {
          playerId: p.id,
          playerName: p.name,
          isDMMode: p.isDMMode,
          timestamp: Date.now(),
        });
      });
    });
  }

  /**
   * 从 WS 消息发布领域事件
   */
  private publishFromWS<T extends DomainEvent['type']>(
    type: T,
    payload: any
  ): void {
    if (this.disposed) return;

    const context: EventContext = {
      roomId: this.roomId,
    };

    this.eventBus.publish({ type, payload } as any, context).catch(err => {
      console.error('[WSEventBus] Error publishing event:', err);
    });
  }

  /**
   * 获取事件总线实例
   */
  getEventBus(): IEventBus {
    return this.eventBus;
  }

  /**
   * 发布领域事件
   */
  publish<T extends DomainEvent>(event: T, context?: Partial<EventContext>): void {
    if (this.disposed) return;

    const fullContext: EventContext = {
      roomId: this.roomId,
      ...context,
    };

    this.eventBus.publish(event, fullContext).catch(err => {
      console.error('[WSEventBus] Error publishing event:', err);
    });
  }

  /**
   * 订阅领域事件
   */
  subscribe<T extends DomainEvent['type']>(
    type: T,
    handler: (event: Extract<DomainEvent, { type: T }>, context: EventContext) => void
  ): () => void {
    return this.eventBus.subscribe(type, handler as any);
  }

  /**
   *  dispose
   */
  dispose(): void {
    this.disposed = true;
  }
}

/**
 * 创建 WS 事件总线集成实例
 */
export function createWSEventBusIntegration(
  ws: WebSocketService,
  options: WSEventBusIntegrationOptions
): WSEventBusIntegration {
  return new WSEventBusIntegration(ws, options);
}
