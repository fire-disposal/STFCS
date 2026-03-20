/**
 * 客户端房间 SDK
 *
 * 提供：
 * 1. 类型安全的操作调用
 * 2. 自动状态同步
 * 3. 事件订阅/发送
 * 4. React hooks
 */

import type {
  RoomState,
  OperationMap,
  OperationName,
  InferArgs,
  InferReturn,
  StateUpdateMessage,
  EventMessage,
  SyncMessage,
} from '@vt/shared/room';
import { applyDiff } from '@vt/shared/room';

// ==================== 类型定义 ====================

/** 状态变更监听器 */
export type StateChangeListener = (state: RoomState, diff: Partial<RoomState>) => void;

/** 事件监听器 */
export type EventListener<T = unknown> = (payload: T) => void;

/** 待处理请求 */
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

// ==================== RoomClient ====================

/**
 * 房间客户端
 *
 * @example
 * ```ts
 * const client = new RoomClient<OperationMap>(ws);
 *
 * // 调用操作
 * await client.call('join', 'player-123', 'Alice');
 * await client.call('selectFaction', 'hegemony');
 *
 * // 发送事件
 * client.emit('chat', { content: 'Hello' });
 *
 * // 监听状态变化
 * client.onStateChange((state) => {
 *   console.log('State updated:', state);
 * });
 * ```
 */
export class RoomClient<TOps extends OperationMap = OperationMap> {
  private _ws: WebSocket;
  private _state: RoomState | null = null;
  private _version: number = 0;
  private _pendingRequests: Map<string, PendingRequest> = new Map();
  private _stateListeners: Set<StateChangeListener> = new Set();
  private _eventListeners: Map<string, Set<EventListener>> = new Map();
  private _requestTimeout: number;
  private _requestIdCounter: number = 0;

  constructor(ws: WebSocket, options?: { requestTimeout?: number }) {
    this._ws = ws;
    this._requestTimeout = options?.requestTimeout ?? 10000;
    this._setupMessageHandler();
  }

  // ==================== 状态访问 ====================

  /** 获取当前状态 */
  get state(): Readonly<RoomState> | null {
    return this._state;
  }

  /** 获取状态版本 */
  get version(): number {
    return this._version;
  }

  /** 是否已连接 */
  get isConnected(): boolean {
    return this._ws.readyState === WebSocket.OPEN;
  }

  // ==================== 操作调用 ====================

  /**
   * 调用远程操作
   */
  async call<K extends OperationName<TOps>>(
    operation: K,
    ...args: InferArgs<TOps[K]>
  ): Promise<InferReturn<TOps[K]>> {
    if (!this.isConnected) {
      throw new Error('WebSocket is not connected');
    }

    const requestId = this._generateRequestId();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${operation}`));
      }, this._requestTimeout);

      this._pendingRequests.set(requestId, {
        resolve: resolve as (r: unknown) => void,
        reject,
        timeout,
      });

      const message = {
        type: 'OPERATION',
        operation,
        args,
        requestId,
      };

      this._ws.send(JSON.stringify(message));
    });
  }

  /**
   * 创建类型安全的操作调用器
   */
  createOperations(): {
    [K in OperationName<TOps>]: (...args: InferArgs<TOps[K]>) => Promise<InferReturn<TOps[K]>>;
  } {
    const client = this;
    return new Proxy({} as any, {
      get(_target, operation: string) {
        return (...args: unknown[]) => 
          client.call(operation as OperationName<TOps>, ...args as InferArgs<TOps[OperationName<TOps>]>);
      },
    });
  }

  // ==================== 事件发送 ====================

  /**
   * 发送事件到服务器
   */
  emit<T>(event: string, payload: T): void {
    if (!this.isConnected) {
      console.warn('[RoomClient] Cannot emit: WebSocket is not connected');
      return;
    }

    const message = {
      type: 'EVENT',
      event,
      payload,
      timestamp: Date.now(),
    };

    this._ws.send(JSON.stringify(message));
  }

  // ==================== 状态同步 ====================

  /**
   * 初始化状态
   */
  init(state: RoomState, version: number = 0): void {
    this._state = state;
    this._version = version;
    this._notifyStateListeners(state, state);
  }

  /**
   * 监听状态变化
   */
  onStateChange(listener: StateChangeListener): () => void {
    this._stateListeners.add(listener);
    return () => this._stateListeners.delete(listener);
  }

  // ==================== 事件订阅 ====================

  /**
   * 监听事件
   */
  on<T>(event: string, listener: EventListener<T>): () => void {
    if (!this._eventListeners.has(event)) {
      this._eventListeners.set(event, new Set());
    }
    this._eventListeners.get(event)!.add(listener as EventListener);
    return () => this._eventListeners.get(event)?.delete(listener as EventListener);
  }

  /**
   * 取消监听
   */
  off<T>(event: string, listener: EventListener<T>): void {
    this._eventListeners.get(event)?.delete(listener as EventListener);
  }

  // ==================== 内部方法 ====================

  private _generateRequestId(): string {
    return `req_${Date.now()}_${++this._requestIdCounter}`;
  }

  private _setupMessageHandler(): void {
    this._ws.addEventListener('message', (event: MessageEvent) => {
      try {
        const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        this._handleMessage(message as SyncMessage);
      } catch (error) {
        console.error('[RoomClient] Failed to parse message:', error);
      }
    });
  }

  private _handleMessage(message: SyncMessage): void {
    switch (message.type) {
      case 'STATE_UPDATE': {
        this._handleStateUpdate(message);
        break;
      }

      case 'EVENT': {
        this._handleEvent(message);
        break;
      }

      case 'OPERATION_RESPONSE': {
        this._handleOperationResponse(message);
        break;
      }
    }
  }

  private _handleStateUpdate(message: StateUpdateMessage): void {
    if (message.version <= this._version) {
      return;
    }

    this._version = message.version;

    if (this._state) {
      this._state = applyDiff(this._state, message.diff);
    } else {
      this._state = message.diff as RoomState;
    }

    if (this._state) {
      this._notifyStateListeners(this._state, message.diff);
    }
  }

  private _handleEvent(message: EventMessage): void {
    const listeners = this._eventListeners.get(message.event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(message.payload);
        } catch (error) {
          console.error(`[RoomClient] Event listener error (${message.event}):`, error);
        }
      }
    }
  }

  private _handleOperationResponse(message: {
    requestId: string;
    success: boolean;
    result?: unknown;
    error?: string;
  }): void {
    const pending = this._pendingRequests.get(message.requestId);
    if (!pending) return;

    this._pendingRequests.delete(message.requestId);
    clearTimeout(pending.timeout);

    if (message.success) {
      pending.resolve(message.result);
    } else {
      pending.reject(new Error(message.error || 'Operation failed'));
    }
  }

  private _notifyStateListeners(state: RoomState, diff: Partial<RoomState>): void {
    for (const listener of this._stateListeners) {
      try {
        listener(state, diff);
      } catch (error) {
        console.error('[RoomClient] State listener error:', error);
      }
    }
  }
}

// ==================== 便捷函数 ====================

/**
 * 创建房间客户端
 */
export function createRoomClient<TOps extends OperationMap>(
  ws: WebSocket,
  options?: { requestTimeout?: number }
): RoomClient<TOps> {
  return new RoomClient<TOps>(ws, options);
}