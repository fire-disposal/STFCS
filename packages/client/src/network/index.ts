/**
 * 网络模块导出 - 简化架构
 * 
 * 不再导出中间层 RoomState/SocketRoom 类型，
 * 前端直接使用 @vt/data 的权威类型 GameRoomState, RoomPlayerState 等。
 * 
 * 发送操作使用 useGameActionSender / getGameActionSender 替代 room.send。
 */

export type { RoomInfo } from "@vt/data";
export { SocketNetworkManager, type AuthResult, type RoomJoinResult, type PlayerLoadoutResult } from "./SocketNetworkManager.js";
export { useRoomList, useSocketRoom } from "./hooks.js";
