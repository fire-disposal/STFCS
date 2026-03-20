/**
 * 序列化工具
 *
 * 使用 superjson 支持复杂类型（Map, Set, Date, BigInt 等）
 */

import { serialize, deserialize, registerCustom } from 'superjson';
import type { Point } from '../types/index.js';
import type { RoomState } from './types.js';

// 注册自定义类型
registerCustom<Point, [number, number]>({
  isApplicable: (v): v is Point => 
    typeof v === 'object' && v !== null && 'x' in v && 'y' in v,
  serialize: (v) => [v.x, v.y],
  deserialize: (v) => ({ x: v[0], y: v[1] }),
}, 'Point');

/**
 * 序列化房间状态
 */
export function serializeState(state: RoomState): string {
  return JSON.stringify(serialize(state));
}

/**
 * 反序列化房间状态
 */
export function deserializeState(json: string): RoomState {
  return deserialize(JSON.parse(json));
}

/**
 * 序列化状态差异
 */
export function serializeDiff(diff: Partial<RoomState>): string {
  return JSON.stringify(serialize(diff));
}

/**
 * 反序列化状态差异
 */
export function deserializeDiff(json: string): Partial<RoomState> {
  return deserialize(JSON.parse(json));
}

/**
 * 深拷贝（使用序列化）
 */
export function deepClone<T>(obj: T): T {
  return deserialize(JSON.parse(JSON.stringify(serialize(obj))));
}

/**
 * 计算状态差异
 * 返回需要同步的部分
 */
export function computeDiff(
  prevState: RoomState,
  nextState: RoomState
): Partial<RoomState> | null {
  const diff: Partial<RoomState> = {};
  let hasChanges = false;

  // 检查 meta 变化
  if (JSON.stringify(prevState.meta) !== JSON.stringify(nextState.meta)) {
    diff.meta = nextState.meta;
    hasChanges = true;
  }

  // 检查 players 变化
  const prevPlayerIds = Object.keys(prevState.players);
  const nextPlayerIds = Object.keys(nextState.players);
  
  if (
    prevPlayerIds.length !== nextPlayerIds.length ||
    JSON.stringify(prevState.players) !== JSON.stringify(nextState.players)
  ) {
    diff.players = nextState.players;
    hasChanges = true;
  }

  // 检查 game 变化
  if (JSON.stringify(prevState.game) !== JSON.stringify(nextState.game)) {
    diff.game = nextState.game;
    hasChanges = true;
  }

  return hasChanges ? diff : null;
}

/**
 * 应用状态差异
 */
export function applyDiff(
  state: RoomState,
  diff: Partial<RoomState>
): RoomState {
  return {
    ...state,
    ...diff,
    meta: diff.meta ? { ...state.meta, ...diff.meta } : state.meta,
    players: diff.players ? { ...state.players, ...diff.players } : state.players,
    game: diff.game ? { ...state.game, ...diff.game } : state.game,
  };
}