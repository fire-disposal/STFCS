/**
 * 服务端房间框架
 */

// 核心类
export { Room, defineRoom } from './Room';
export type { WSSender, OperationResult, RoomEventListener } from './Room';

// 房间管理
export { RoomManager } from './RoomManager';
export type { RoomInfo, CreateRoomOptions, RoomConstructor } from './RoomManager';

// 游戏房间
export { GameRoom, GameRoomOperations } from './GameRoom';
export type { GameRoomOperations } from './GameRoom';

// WebSocket 适配
export { RoomWSHandler } from './RoomWSHandler';
export type { RoomHandlerOptions } from './RoomWSHandler';