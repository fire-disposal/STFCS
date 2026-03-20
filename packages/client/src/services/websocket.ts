/**
 * WebSocket 连接服务
 *
 * 简化版：仅负责连接管理
 * - 创建 WebSocket 连接
 * - 创建 RoomClient 实例
 * - 处理重连逻辑
 *
 * 所有游戏操作通过 RoomClient 调用
 */

import { RoomClient, createRoomClient } from '@/room';
import type { OperationMap, RoomState } from '@vt/shared/room';

// ==================== 类型定义 ====================

export interface ConnectionOptions {
  url: string;
  playerId?: string;
  playerName?: string;
}

export interface ConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  playerId: string | null;
  roomId: string | null;
  error: string | null;
}

type StateChangeListener = (state: RoomState | null) => void;

// ==================== WebSocketService ====================

/**
 * WebSocket 连接服务
 *
 * @example
 * ```ts
 * const service = new WebSocketService();
 *
 * // 连接
 * const client = await service.connect({ url: 'ws://localhost:8080' });
 *
 * // 使用 RoomClient 调用操作
 * await client.call('join', 'Alice');
 * await client.call('selectFaction', 'hegemony');
 *
 * // 监听状态
 * client.onStateChange((state) => {
 *   console.log('State updated:', state);
 * });
 * ```
 */
export class WebSocketService {
  private _ws: WebSocket | null = null;
  private _client: RoomClient<OperationMap> | null = null;
  private _stateListeners: Set<StateChangeListener> = new Set();
  private _connectionState: ConnectionState = {
    isConnected: false,
    isConnecting: false,
    playerId: null,
    roomId: null,
    error: null,
  };
  private _reconnectAttempts = 0;
  private _maxReconnectAttempts = 5;
  private _reconnectDelay = 1000;
  private _pingInterval: ReturnType<typeof setInterval> | null = null;
  private _connectionOptions: ConnectionOptions | null = null;

  // ==================== 连接管理 ====================

  /**
   * 连接到服务器
   * @returns RoomClient 实例
   */
  async connect(options: ConnectionOptions): Promise<RoomClient<OperationMap>> {
    const { url } = options;
    this._connectionOptions = options;

    if (this._ws?.readyState === WebSocket.OPEN) {
      return this._client!;
    }

    this._connectionState.isConnecting = true;
    this._connectionState.error = null;
    this._notifyStateChange();

    return new Promise((resolve, reject) => {
      try {
        this._ws = new WebSocket(url);

        this._ws.onopen = () => {
          console.log('[WS] Connected to:', url);

          // 创建 RoomClient
          this._client = createRoomClient<OperationMap>(this._ws!);

          // 订阅状态变化
          this._client.onStateChange((state) => {
            this._notifyStateChange(state);
          });

          this._connectionState.isConnected = true;
          this._connectionState.isConnecting = false;
          this._reconnectAttempts = 0;

          this._startPingInterval();
          this._notifyStateChange();

          resolve(this._client!);
        };

        this._ws.onmessage = () => {
          // RoomClient 内部处理消息
        };

        this._ws.onerror = (error) => {
          console.error('[WS] Error:', error);
          this._connectionState.error = 'Connection error';
          this._connectionState.isConnecting = false;
          this._notifyStateChange();
          reject(new Error('WebSocket connection failed'));
        };

        this._ws.onclose = (event) => {
          console.log('[WS] Closed:', event.code, event.reason);
          this._connectionState.isConnected = false;
          this._connectionState.isConnecting = false;
          this._stopPingInterval();
          this._notifyStateChange();

          if (event.code !== 1000) {
            this._attemptReconnect();
          }
        };
      } catch (error) {
        this._connectionState.isConnecting = false;
        this._connectionState.error = error instanceof Error ? error.message : 'Unknown error';
        this._notifyStateChange();
        reject(error);
      }
    });
  }

  /**
   * 断开连接
   */
  disconnect(): void {
    if (this._ws) {
      this._ws.close(1000, 'Client disconnected');
      this._ws = null;
    }

    this._client = null;
    this._stopPingInterval();

    this._connectionState = {
      isConnected: false,
      isConnecting: false,
      playerId: null,
      roomId: null,
      error: null,
    };

    this._notifyStateChange();
  }

  /**
   * 尝试重连
   */
  private _attemptReconnect(): void {
    if (!this._connectionOptions) return;

    if (this._reconnectAttempts < this._maxReconnectAttempts) {
      this._reconnectAttempts++;
      const delay = this._reconnectDelay * Math.pow(2, this._reconnectAttempts - 1);

      console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this._reconnectAttempts}/${this._maxReconnectAttempts})`);

      setTimeout(() => {
        this.connect(this._connectionOptions!).catch((error) => {
          console.error('[WS] Reconnection failed:', error);
        });
      }, delay);
    }
  }

  // ==================== 状态访问 ====================

  /**
   * 获取连接状态
   */
  get connectionState(): Readonly<ConnectionState> {
    return this._connectionState;
  }

  /**
   * 获取房间客户端
   */
  get client(): RoomClient<OperationMap> | null {
    return this._client;
  }

  /**
   * 获取房间状态
   */
  get state(): RoomState | null {
    return this._client?.state ?? null;
  }

  /**
   * 是否已连接
   */
  isConnected(): boolean {
    return this._ws?.readyState === WebSocket.OPEN;
  }

  /**
   * 设置玩家信息
   */
  setPlayerInfo(playerId: string, roomId: string): void {
    this._connectionState.playerId = playerId;
    this._connectionState.roomId = roomId;
    this._notifyStateChange();
  }

  /**
   * 清除玩家信息
   */
  clearPlayerInfo(): void {
    this._connectionState.playerId = null;
    this._connectionState.roomId = null;
    this._notifyStateChange();
  }

  // ==================== 状态订阅 ====================

  /**
   * 订阅状态变化
   */
  onStateChange(listener: StateChangeListener): () => void {
    this._stateListeners.add(listener);
    return () => this._stateListeners.delete(listener);
  }

  // ==================== 内部方法 ====================

  private _notifyStateChange(state?: RoomState | null): void {
    const currentState = state ?? this._client?.state ?? null;
    for (const listener of this._stateListeners) {
      try {
        listener(currentState);
      } catch (error) {
        console.error('[WS] State listener error:', error);
      }
    }
  }

  private _startPingInterval(): void {
    this._pingInterval = setInterval(() => {
      if (this._ws?.readyState === WebSocket.OPEN) {
        this._ws.send(JSON.stringify({ type: 'PING', timestamp: Date.now() }));
      }
    }, 30000);
  }

  private _stopPingInterval(): void {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }
}

// ==================== 单例导出 ====================

export const websocketService = new WebSocketService();