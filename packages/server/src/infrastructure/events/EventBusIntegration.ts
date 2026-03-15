/**
 * 服务端事件总线集成
 * 
 * 将领域事件总线与 WebSocket 服务器集成
 */

import { EventBus, type IEventBus, type EventContext, type DomainEvent } from '@vt/shared/events';
import type { IWSServer, WSMessage } from '@vt/shared/ws';
import { DefaultEventTranslator } from '@vt/shared/events';

/**
 * WS 事件翻译器
 * 将领域事件转换为 WS 消息并广播
 */
export interface WSEventTranslatorOptions {
  wsServer: IWSServer;
  roomId: string;
  excludeClientId?: string;
}

export class WSEventTranslator extends DefaultEventTranslator {
  constructor(
    private wsServer: IWSServer,
    private roomId: string,
    private excludeClientId?: string
  ) {
    super();
  }

  translate(event: DomainEvent, context: EventContext): WSMessage | null {
    const message = super.translate(event, context);
    return message as WSMessage | null;
  }

  broadcast(event: DomainEvent, excludeClientId?: string): void {
    const message = this.translate(event, { roomId: this.roomId });
    if (message) {
      this.wsServer.broadcast(message, excludeClientId);
    }
  }
}

/**
 * 创建房间事件总线
 * 
 * @param wsServer WebSocket 服务器
 * @param roomId 房间 ID
 * @returns 配置好的事件总线实例
 */
export function createRoomEventBus(
  wsServer: IWSServer,
  roomId: string
): IEventBus {
  const eventBus = new EventBus();
  
  // 创建 WS 翻译器并设置到事件总线
  const translator = new WSEventTranslator(wsServer, roomId);
  eventBus.setTranslator(translator);
  
  // 设置 WS 广播器
  eventBus.setWSBroadcaster((message, excludeId) => {
    wsServer.broadcast(message as WSMessage, excludeId);
  });

  return eventBus;
}

/**
 * 房间事件总线管理器
 * 管理每个房间的独立事件总线
 */
export class RoomEventBusManager {
  private eventBuses: Map<string, IEventBus> = new Map();

  constructor(private wsServer: IWSServer) {}

  /**
   * 获取或创建房间事件总线
   */
  getEventBus(roomId: string): IEventBus {
    let eventBus = this.eventBuses.get(roomId);
    
    if (!eventBus) {
      eventBus = createRoomEventBus(this.wsServer, roomId);
      this.eventBuses.set(roomId, eventBus);
    }
    
    return eventBus;
  }

  /**
   * 移除房间事件总线
   */
  removeEventBus(roomId: string): void {
    this.eventBuses.delete(roomId);
  }

  /**
   * 清空所有事件总线
   */
  clear(): void {
    this.eventBuses.clear();
  }
}
