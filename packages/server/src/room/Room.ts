/**
 * 房间基类
 *
 * 核心特性：
 * 1. Immer 不可变状态管理
 * 2. 事务性操作（自动回滚）
 * 3. 自动状态差异同步
 * 4. 声明式权限检查
 */

import { produce, freeze } from 'immer';
import type { 
  RoomState, 
  OperationDef, 
  OperationMap, 
  OperationName,
  InferArgs,
  InferReturn,
  StateUpdateMessage,
  EventMessage,
  RoomConfig,
} from '@vt/shared/room';
import { 
  createEmptyRoomState, 
  deepClone, 
  computeDiff,
  checkPermission,
} from '@vt/shared/room';

// ==================== 类型定义 ====================

/** WebSocket 发送接口 */
export interface WSSender {
  sendTo: (clientId: string, message: unknown) => void;
}

/** 操作结果 */
export interface OperationResult<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
  broadcast?: StateUpdateMessage;
  events?: EventMessage[];
}

/** 房间事件监听器 */
export type RoomEventListener<T = unknown> = (payload: T, roomId: string) => void;

// ==================== Room 基类 ====================

/**
 * 房间基类
 *
 * @example
 * ```ts
 * class GameRoom extends Room<GameOperations> {
 *   constructor(roomId: string, creatorId: string) {
 *     super(roomId, creatorId, gameOperations);
 *   }
 * }
 * ```
 */
export class Room<TOps extends OperationMap = OperationMap> {
  #state: RoomState;
  #roomId: string;
  #version: number = 0;
  #clients: Map<string, WSSender> = new Map();
  #operations: TOps;
  #eventListeners: Map<string, Set<RoomEventListener>> = new Map();

  constructor(
    roomId: string,
    creatorId: string,
    operations: TOps,
    name: string = `Room ${roomId.slice(0, 6)}`
  ) {
    this.#roomId = roomId;
    this.#operations = operations;
    this.#state = freeze(createEmptyRoomState(roomId, name, creatorId), true);
  }

  // ==================== 状态访问 ====================

  /** 获取当前状态（只读） */
  get state(): Readonly<RoomState> {
    return this.#state;
  }

  /** 获取房间 ID */
  get roomId(): string {
    return this.#roomId;
  }

  /** 获取状态版本 */
  get version(): number {
    return this.#version;
  }

  /** 获取所有客户端 ID */
  get clientIds(): string[] {
    return Array.from(this.#clients.keys());
  }

  /** 获取玩家数量 */
  get playerCount(): number {
    return Object.keys(this.#state.players).length;
  }

  // ==================== 客户端管理 ====================

  /**
   * 添加客户端连接
   */
  addClient(clientId: string, sender: WSSender): void {
    this.#clients.set(clientId, sender);
  }

  /**
   * 移除客户端连接
   */
  removeClient(clientId: string): boolean {
    return this.#clients.delete(clientId);
  }

  /**
   * 检查客户端是否在线
   */
  hasClient(clientId: string): boolean {
    return this.#clients.has(clientId);
  }

  // ==================== 操作执行 ====================

  /**
   * 执行操作
   * 
   * @param clientId 发起操作的客户端 ID
   * @param operation 操作名称
   * @param args 操作参数
   * @returns 操作结果
   */
  async execute<K extends OperationName<TOps>>(
    clientId: string,
    operation: K,
    ...args: InferArgs<TOps[K]>
  ): Promise<OperationResult<InferReturn<TOps[K]>>> {
    const opDef = this.#operations[operation] as OperationDef | undefined;
    
    if (!opDef) {
      return { success: false, error: `Unknown operation: ${operation}` };
    }

    // 权限检查
    const permission = checkPermission(this.#state, clientId, opDef);
    if (!permission.allowed) {
      return { success: false, error: permission.reason };
    }

    // 保存状态快照用于回滚
    const prevState = deepClone(this.#state);
    const events: EventMessage[] = [];

    try {
      // 使用 Immer 执行状态更新
      let result: InferReturn<TOps[K]>;
      
      this.#state = produce(this.#state, (draft) => {
        const opResult = opDef.handler(draft, clientId, ...args);
        // 更新时间戳
        draft.meta.updatedAt = Date.now();
        result = opResult as InferReturn<TOps[K]>;
      });

      // 计算状态差异
      const diff = computeDiff(prevState, this.#state);
      let broadcast: StateUpdateMessage | undefined;
      
      if (diff) {
        this.#version++;
        broadcast = {
          type: 'STATE_UPDATE',
          version: this.#version,
          diff,
          timestamp: Date.now(),
        };
      }

      return { 
        success: true, 
        result: result!,
        broadcast,
        events: events.length > 0 ? events : undefined,
      };
    } catch (error) {
      // 回滚状态
      this.#state = prevState;
      
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ==================== 广播 ====================

  /**
   * 广播状态更新
   */
  broadcastState(update: StateUpdateMessage, excludeClientId?: string): void {
    for (const [clientId, sender] of this.#clients) {
      if (clientId !== excludeClientId) {
        sender.sendTo(clientId, update);
      }
    }
  }

  /**
   * 广播事件
   */
  broadcastEvent<T>(event: string, payload: T, excludeClientId?: string): void {
    const message: EventMessage<T> = {
      type: 'EVENT',
      event,
      payload,
      timestamp: Date.now(),
    };

    for (const [clientId, sender] of this.#clients) {
      if (clientId !== excludeClientId) {
        sender.sendTo(clientId, message);
      }
    }

    // 触发本地监听器
    const listeners = this.#eventListeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(payload, this.#roomId);
      }
    }
  }

  /**
   * 发送消息给特定客户端
   */
  sendTo<T>(clientId: string, message: T): boolean {
    const sender = this.#clients.get(clientId);
    if (sender) {
      sender.sendTo(clientId, message);
      return true;
    }
    return false;
  }

  // ==================== 事件监听 ====================

  /**
   * 监听房间事件
   */
  on<T>(event: string, listener: RoomEventListener<T>): () => void {
    if (!this.#eventListeners.has(event)) {
      this.#eventListeners.set(event, new Set());
    }
    
    const listeners = this.#eventListeners.get(event)!;
    listeners.add(listener as RoomEventListener);
    
    // 返回取消监听函数
    return () => {
      listeners.delete(listener as RoomEventListener);
    };
  }

  // ==================== 状态快照 ====================

  /**
   * 获取完整状态快照
   */
  getSnapshot(): RoomState {
    return deepClone(this.#state);
  }

  /**
   * 从快照恢复状态
   */
  restoreSnapshot(snapshot: RoomState): void {
    this.#state = freeze(deepClone(snapshot), true);
    this.#version++;
    
    // 广播完整状态同步
    this.broadcastState({
      type: 'STATE_UPDATE',
      version: this.#version,
      diff: snapshot,  // 完整状态作为 diff
      timestamp: Date.now(),
    });
  }
}

// ==================== 房间工厂 ====================

/**
 * 创建房间类工厂
 */
export function defineRoom<TOps extends OperationMap>(
  config: RoomConfig<TOps>
) {
  return class extends Room<TOps> {
    constructor(roomId: string, creatorId: string, name?: string) {
      super(roomId, creatorId, config.operations, name);
    }

    /** 获取房间配置名称 */
    static get roomType() {
      return config.name;
    }

    /** 获取最大玩家数 */
    static get maxPlayers() {
      return config.maxPlayers;
    }
  };
}