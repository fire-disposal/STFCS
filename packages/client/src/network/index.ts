/**
 * 网络模块导出 - 简化架构
 */

export type { RoomInfo } from "@vt/data";
export { SocketNetworkManager, type AuthResult, type RoomJoinResult, type PlayerLoadoutResult } from "./SocketNetworkManager.js";
export { useRoomList, useSocketRoom, useTokens, useShips, type RoomState, type SocketRoom } from "./hooks.js";