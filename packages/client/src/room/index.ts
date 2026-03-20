/**
 * 客户端房间框架
 */

// 从 shared 重新导出类型
export type {
  OperationMap,
  OperationName,
  InferArgs,
  InferReturn,
  RoomState,
  TokenState,
  PlayerState,
} from '@vt/shared/room';

// Room Client
export { RoomClient, createRoomClient } from './RoomClient';
export type { StateChangeListener, EventListener } from './RoomClient';

// React Hooks
export {
  useRoomState,
  useRoomSelector,
  useRoomOperations,
  useRoomOperation,
  useRoomEvent,
  useRoom,
} from './hooks';