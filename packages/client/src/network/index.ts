/**
 * 网络模块导出
 *
 * 基于 @vt/data 权威定义的全新网络层架构
 * 提供类型安全的 WebSocket 通信和高级服务
 */

// 从 @vt/data 导入权威类型
export type { RoomInfo } from "@vt/data";

// 核心层
export { WebSocketClient, WebSocketEvent, ConnectionState } from "./core/WebSocketClient.js";
export { RequestManager, RequestBuilder } from "./core/RequestManager.js";
export { StateSyncService, type GameState, type StateChangeListener, type FullSyncListener } from "./core/StateSyncService.js";

// 服务层
export { AuthService, createAuthService, type AuthServiceConfig } from "./services/AuthService.js";
export { RoomService, RoomServiceEvent, createRoomService, type RoomServiceConfig } from "./services/RoomService.js";
export { GameService, GameServiceEvent, createGameService, type GameServiceConfig, type MoveParams, type RotateParams, type AttackParams, type ShieldParams } from "./services/GameService.js";