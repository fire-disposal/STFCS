import type { IWSServer } from "@vt/shared/ws";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";

/**
 * Service 基类
 * 提供通用的 WS 和 RoomManager 依赖注入
 */
export abstract class BaseService {
	protected _wsServer: IWSServer | undefined;
	protected _roomManager: RoomManager | undefined;

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	setRoomManager(roomManager: RoomManager): void {
		this._roomManager = roomManager;
	}

	/**
	 * 获取玩家所在房间
	 */
	protected getPlayerRoom(clientId: string): ReturnType<RoomManager["getPlayerRoom"]> {
		if (!this._roomManager) {
			throw new Error("RoomManager not initialized");
		}
		return this._roomManager.getPlayerRoom(clientId);
	}

	/**
	 * 检查玩家是否在房间中，如果不在则抛出错误
	 */
	protected requirePlayerInRoom(clientId: string) {
		const room = this.getPlayerRoom(clientId);
		if (!room) {
			throw new Error("Player is not in a room");
		}
		return room;
	}

	/**
	 * 广播消息到房间
	 */
	protected broadcastToRoom(roomId: string, message: Parameters<RoomManager["broadcastToRoom"]>[1], excludePlayerId?: string): void {
		if (!this._roomManager) {
			throw new Error("RoomManager not initialized");
		}
		this._roomManager.broadcastToRoom(roomId, message, excludePlayerId);
	}
}
