import type { MapSnapshot, PlayerCamera, PlayerInfo, Point, TokenInfo } from "@vt/shared/types";
import type { IWSServer, WSMessage } from "@vt/shared/ws";
import { RoomMapStore } from "../map/RoomMapStore";

export interface Room {
	id: string;
	players: Map<string, PlayerInfo>;
	createdAt: number;
	maxPlayers: number;
	/** 存储房间内玩家的相机状态 */
	playerCameras: Map<string, PlayerCamera>;
	/** 房间地图快照（MVP 持久化基线） */
	mapSnapshot: MapSnapshot;
}

export interface IRoomManager {
	createRoom(roomId: string, maxPlayers?: number): Room;
	joinRoom(roomId: string, player: PlayerInfo): boolean;
	leaveRoom(roomId: string, playerId: string): boolean;
	getRoom(roomId: string): Room | undefined;
	getPlayerRoom(playerId: string): Room | undefined;
	broadcastToRoom(roomId: string, message: WSMessage, excludePlayerId?: string): void;
	deleteRoom(roomId: string): void;
	listRooms(): Room[];
}

export class RoomManager implements IRoomManager {
	private _rooms: Map<string, Room>;
	private _playerRooms: Map<string, string>;
	private _maxPlayersPerRoom: number;
	private _wsServer: IWSServer | undefined;
	private _mapStore: RoomMapStore;

	constructor(maxPlayersPerRoom: number = 8) {
		this._rooms = new Map();
		this._playerRooms = new Map();
		this._maxPlayersPerRoom = maxPlayersPerRoom;
		this._mapStore = new RoomMapStore();
	}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	createRoom(roomId: string, maxPlayers?: number): Room {
		const existingRoom = this._rooms.get(roomId);
		if (existingRoom) {
			return existingRoom;
		}

		const room: Room = {
			id: roomId,
			players: new Map(),
			createdAt: Date.now(),
			maxPlayers: maxPlayers ?? this._maxPlayersPerRoom,
			playerCameras: new Map(),
			mapSnapshot: this._mapStore.getSnapshot(roomId),
		};

		this._rooms.set(roomId, room);
		return room;
	}

	joinRoom(roomId: string, player: PlayerInfo): boolean {
		let room = this._rooms.get(roomId);
		if (!room) {
			room = this.createRoom(roomId);
		}

		if (room.players.size >= room.maxPlayers) {
			return false;
		}

		if (room.players.has(player.id)) {
			return true;
		}

		room.players.set(player.id, player);
		this._playerRooms.set(player.id, roomId);
		return true;
	}

	leaveRoom(roomId: string, playerId: string): boolean {
		const room = this._rooms.get(roomId);
		if (!room) {
			return false;
		}

		const removed = room.players.delete(playerId);
		this._playerRooms.delete(playerId);
		// 同时移除玩家的相机状态
		room.playerCameras.delete(playerId);

		if (room.players.size === 0) {
			this._rooms.delete(roomId);
		}

		return removed;
	}

	getRoom(roomId: string): Room | undefined {
		return this._rooms.get(roomId);
	}

	getPlayerRoom(playerId: string): Room | undefined {
		const roomId = this._playerRooms.get(playerId);
		if (roomId === undefined) {
			return undefined;
		}
		return this._rooms.get(roomId);
	}

	broadcastToRoom(roomId: string, message: WSMessage, excludePlayerId?: string): void {
		const room = this._rooms.get(roomId);
		if (!room || !this._wsServer) {
			return;
		}

		for (const [playerId] of room.players.entries()) {
			if (playerId !== excludePlayerId) {
				this._wsServer.sendTo(playerId, message);
			}
		}
	}

	deleteRoom(roomId: string): void {
		const room = this._rooms.get(roomId);
		if (!room) {
			return;
		}

		for (const [playerId] of room.players.entries()) {
			this._playerRooms.delete(playerId);
		}

		this._rooms.delete(roomId);
	}

	listRooms(): Room[] {
		return Array.from(this._rooms.values());
	}

	getRoomCount(): number {
		return this._rooms.size;
	}

	// ===== 玩家相机管理方法 =====

	/** 更新玩家相机状态 */
	updatePlayerCamera(roomId: string, playerId: string, camera: PlayerCamera): void {
		const room = this._rooms.get(roomId);
		if (!room) return;
		room.playerCameras.set(playerId, camera);
	}

	/** 获取房间内所有玩家的相机状态 */
	getRoomPlayerCameras(roomId: string): PlayerCamera[] {
		const room = this._rooms.get(roomId);
		if (!room) return [];
		return Array.from(room.playerCameras.values());
	}

	/** 获取指定玩家的相机状态 */
	getPlayerCamera(roomId: string, playerId: string): PlayerCamera | undefined {
		const room = this._rooms.get(roomId);
		if (!room) return undefined;
		return room.playerCameras.get(playerId);
	}

	/** 移除玩家相机状态 */
	removePlayerCamera(roomId: string, playerId: string): void {
		const room = this._rooms.get(roomId);
		if (!room) return;
		room.playerCameras.delete(playerId);
	}

	getMapSnapshot(roomId: string): MapSnapshot {
		return this._mapStore.getSnapshot(roomId);
	}

	saveMapSnapshot(roomId: string, snapshot: MapSnapshot): MapSnapshot {
		const room = this._rooms.get(roomId) ?? this.createRoom(roomId);
		const saved = this._mapStore.saveSnapshot(roomId, snapshot);
		room.mapSnapshot = saved;
		return saved;
	}

	upsertTokenPosition(
		roomId: string,
		tokenId: string,
		position: Point,
		heading: number,
		ownerId = "mvp",
		type: TokenInfo["type"] = "ship",
		size = 50,
		metadata: Record<string, unknown> = {},
	): TokenInfo {
		const room = this._rooms.get(roomId) ?? this.createRoom(roomId);
		const updated = this._mapStore.upsertToken(
			roomId,
			tokenId,
			position,
			heading,
			ownerId,
			type,
			size,
			metadata
		);
		room.mapSnapshot = this._mapStore.getSnapshot(roomId);
		return updated;
	}
}

export default RoomManager;
