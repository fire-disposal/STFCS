/**
 * React Hooks for Room Client
 *
 * 提供：
 * 1. useRoomState - 订阅房间状态
 * 2. useRoomOperations - 类型安全的操作调用
 * 3. useRoomEvent - 监听房间事件
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { RoomClient } from './RoomClient';
import type {
  RoomState,
  OperationMap,
  OperationName,
  InferArgs,
  InferReturn,
} from '@vt/shared/room';

// ==================== useRoomState ====================

/**
 * 订阅房间状态
 *
 * @example
 * ```tsx
 * const state = useRoomState(client);
 *
 * if (!state) return <div>Loading...</div>;
 *
 * return (
 *   <div>
 *     <h1>{state.meta.name}</h1>
 *     <p>Players: {Object.keys(state.players).length}</p>
 *   </div>
 * );
 * ```
 */
export function useRoomState(client: RoomClient | null): RoomState | null {
  const [state, setState] = useState<RoomState | null>(client?.state ?? null);

  useEffect(() => {
    if (!client) {
      setState(null);
      return;
    }

    // 初始化状态
    setState(client.state);

    // 订阅状态变化
    const unsubscribe = client.onStateChange((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, [client]);

  return state;
}

/**
 * 订阅房间状态的特定部分
 *
 * @example
 * ```tsx
 * const players = useRoomSelector(client, state => state.players);
 * const phase = useRoomSelector(client, state => state.meta.phase);
 * ```
 */
export function useRoomSelector<T>(
  client: RoomClient | null,
  selector: (state: RoomState) => T
): T | null {
  const state = useRoomState(client);
  return state ? selector(state) : null;
}

// ==================== useRoomOperations ====================

/**
 * 获取类型安全的操作调用器
 *
 * @example
 * ```tsx
 * const ops = useRoomOperations<GameRoomOperations>(client);
 *
 * const handleJoin = async () => {
 *   await ops.join('player-id', 'Alice');
 * };
 *
 * const handleKick = async (targetId: string) => {
 *   await ops.kick(targetId);
 * };
 * ```
 */
export function useRoomOperations<TOps extends OperationMap>(
  client: RoomClient<TOps> | null
): {
  [K in OperationName<TOps>]: (...args: InferArgs<TOps[K]>) => Promise<InferReturn<TOps[K]>>;
} | null {
  const clientRef = useRef(client);

  useEffect(() => {
    clientRef.current = client;
  }, [client]);

  return useMemo(() => {
    if (!client) return null;
    return client.createOperations();
  }, [client]);
}

/**
 * 单个操作的 hook
 *
 * @example
 * ```tsx
 * const { execute, loading, error } = useRoomOperation(client, 'join');
 *
 * const handleJoin = async () => {
 *   const result = await execute('player-id', 'Alice');
 *   if (result.success) {
 *     console.log('Joined!');
 *   }
 * };
 * ```
 */
export function useRoomOperation<TOps extends OperationMap, K extends OperationName<TOps>>(
  client: RoomClient<TOps> | null,
  operation: K
): {
  execute: (...args: InferArgs<TOps[K]>) => Promise<InferReturn<TOps[K]>>;
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(
    async (...args: InferArgs<TOps[K]>) => {
      if (!client) {
        throw new Error('Client not connected');
      }

      setLoading(true);
      setError(null);

      try {
        const result = await client.call(operation, ...args);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Operation failed';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [client, operation]
  );

  return { execute, loading, error };
}

// ==================== useRoomEvent ====================

/**
 * 监听房间事件
 *
 * @example
 * ```tsx
 * useRoomEvent(client, 'player.joined', (player) => {
 *   toast.info(`${player.name} joined the room`);
 * });
 *
 * useRoomEvent(client, 'ship.destroyed', ({ tokenId }) => {
 *   playExplosionEffect(tokenId);
 * });
 * ```
 */
export function useRoomEvent<T>(
  client: RoomClient | null,
  event: string,
  handler: (payload: T) => void
): void {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!client) return;

    const unsubscribe = client.on(event, (payload) => {
      handlerRef.current(payload as T);
    });

    return unsubscribe;
  }, [client, event]);
}

// ==================== useRoom ====================

/**
 * 综合房间 hook
 *
 * @example
 * ```tsx
 * const { state, ops, loading, error } = useRoom<GameRoomOperations>(client);
 *
 * if (!state) return <Loading />;
 *
 * return (
 *   <div>
 *     <h1>Room: {state.meta.name}</h1>
 *     <button onClick={() => ops?.startGame()}>Start Game</button>
 *   </div>
 * );
 * ```
 */
export function useRoom<TOps extends OperationMap>(client: RoomClient<TOps> | null) {
  const state = useRoomState(client);
  const ops = useRoomOperations(client);

  return {
    state,
    ops,
    isConnected: client?.isConnected ?? false,
  };
}