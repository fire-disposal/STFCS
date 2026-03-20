/**
 * 房间管理器
 *
 * 功能：
 * - 房间创建/加入/离开
 * - 房主管理
 * - 私密房间支持
 * - 房间状态同步
 */

import type { MapSnapshot, PlayerCamera, PlayerInfo, Point, TokenInfo, RoomPhase, RoomInfo, RoomState } from "@vt/shared/types";
import { PROTOCOL_VERSION } from "@vt/shared/core-types";
import type { IWSServer, WSMessage } from "@vt/shared/ws";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";

/**
 * 内部房间数据结构
 */
export interface Room {
	id: string;
	name: string;
	ownerId: string | null;
	maxPlayers: number;
	isPrivate: boolean;
	password?: string;
	phase: RoomPhase;
	players: Map<string, PlayerInfo>;
	createdAt: number;
	updatedAt: number;
	/** 存储房间内玩家的相机状态 */
	playerCameras: Map<string, PlayerCamera>;
	/** 房间地图快照 */
	mapSnapshot: MapSnapshot;
}

export interface IRoomManager {
	createRoom(roomId: string, options?: RoomCreateOptions): Room;
	joinRoom(roomId: string, player: PlayerInfo, password?: string): RoomJoinResult;
	leaveRoom(roomId: string, playerId: string): boolean;
	getRoom(roomId: string): Room | undefined;
	getPlayerRoom(playerId: string): Room | undefined;
	broadcastToRoom(roomId: string, message: WSMessage, excludePlayerId?: string): void;
	deleteRoom(roomId: string): void;
	listRooms(): RoomInfo[];
	setRoomOwner(roomId: string, playerId: string): boolean;
	kickPlayer(roomId: string, playerId: string, requesterId: string): boolean;
	setRoomPhase(roomId: string, phase: RoomPhase): void;
	getRoomState(roomId: string): RoomState | undefined;
}

export interface RoomCreateOptions {
	name?: string;
	maxPlayers?: number;
	isPrivate?: boolean;
	password?: string;
	ownerId?: string;
}

export interface RoomJoinResult {
	success: boolean;
	reason?: 'room_full' | 'wrong_password' | 'already_joined' | 'not_found';
	room?: Room;
}

export class RoomManager implements IRoomManager {
	private _rooms: Map<string, Room>;
	private _playerRooms: Map<string, string>;
	private _maxPlayersPerRoom: number;
	private _wsServer: IWSServer | undefined;

	constructor(maxPlayersPerRoom: number = 8) {
		this._rooms = new Map();
		this._playerRooms = new Map();
		this._maxPlayersPerRoom = maxPlayersPerRoom;
	}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	createRoom(roomId: string, options: RoomCreateOptions = {}): Room {
		const existingRoom = this._rooms.get(roomId);
		if (existingRoom) {
			return existingRoom;
		}

		const room: Room = {
			id: roomId,
			name: options.name || `Room ${roomId}`,
			ownerId: options.ownerId || null,
			maxPlayers: options.maxPlayers ?? this._maxPlayersPerRoom,
			isPrivate: options.isPrivate ?? false,
			password: options.password,
			phase: 'lobby',
			players: new Map(),
			createdAt: Date.now(),
			updatedAt: Date.now(),
			playerCameras: new Map(),
			mapSnapshot: this._createDefaultSnapshot(roomId),
		};

		this._rooms.set(roomId, room);
		this._broadcastRoomListUpdate('add', room);
		return room;
	}

	joinRoom(roomId: string, player: PlayerInfo, password?: string): RoomJoinResult {
		let room = this._rooms.get(roomId);
		if (!room) {
			// 自动创建房间
			room = this.createRoom(roomId, { ownerId: player.id });
		}

		// 检查房间是否已满
		if (room.players.size >= room.maxPlayers) {
			return { success: false, reason: 'room_full' };
		}

		// 检查密码
		if (room.isPrivate && room.password && room.password !== password) {
			return { success: false, reason: 'wrong_password' };
		}

		// 检查是否已加入
		if (room.players.has(player.id)) {
			return { success: true, room };
		}

		// 如果是第一个玩家，设为房主
		if (room.players.size === 0 && !room.ownerId) {
			room.ownerId = player.id;
		}

		room.players.set(player.id, player);
		room.updatedAt = Date.now();
		this._playerRooms.set(player.id, roomId);

		// 广播房间更新
		this._broadcastRoomUpdate(room);

		return { success: true, room };
	}

	leaveRoom(roomId: string, playerId: string): boolean {
		const room = this._rooms.get(roomId);
		if (!room) {
			return false;
		}

		const removed = room.players.delete(playerId);
		this._playerRooms.delete(playerId);
		room.playerCameras.delete(playerId);
		room.updatedAt = Date.now();

		if (room.players.size === 0) {
			// 房间为空，删除房间
			this._rooms.delete(roomId);
			this._broadcastRoomListUpdate('remove', room);
		} else {
			// 如果离开的是房主，转移房主权限
			if (room.ownerId === playerId) {
				const nextOwner = room.players.keys().next().value;
				room.ownerId = nextOwner || null;
			}
			this._broadcastRoomUpdate(room);
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
		this._broadcastRoomListUpdate('remove', room);
	}

	listRooms(): RoomInfo[] {
		return Array.from(this._rooms.values()).map(room => this._toRoomInfo(room));
	}

	/**
	 * 设置房主
	 */
	setRoomOwner(roomId: string, playerId: string): boolean {
		const room = this._rooms.get(roomId);
		if (!room || !room.players.has(playerId)) {
			return false;
		}

		room.ownerId = playerId;
		room.updatedAt = Date.now();
		this._broadcastRoomUpdate(room);
		return true;
	}

	/**
	 * 踢出玩家
	 */
	kickPlayer(roomId: string, playerId: string, requesterId: string): boolean {
		const room = this._rooms.get(roomId);
		if (!room) {
			return false;
		}

		// 只有房主可以踢人
		if (room.ownerId !== requesterId) {
			return false;
		}

		// 不能踢自己
		if (playerId === requesterId) {
			return false;
		}

		// 踢出玩家
		const removed = room.players.delete(playerId);
		if (removed) {
			this._playerRooms.delete(playerId);
			room.playerCameras.delete(playerId);
			room.updatedAt = Date.now();

			// 通知被踢出的玩家
			if (this._wsServer) {
				this._wsServer.sendTo(playerId, {
					type: WS_MESSAGE_TYPES.ERROR,
					payload: {
						code: 'KICKED',
						message: 'You have been kicked from the room',
					},
				});
			}

			this._broadcastRoomUpdate(room);
		}

		return removed;
	}

	/**
	 * 设置房间阶段
	 */
	setRoomPhase(roomId: string, phase: RoomPhase): void {
		const room = this._rooms.get(roomId);
		if (!room) return;

		room.phase = phase;
		room.updatedAt = Date.now();
		this._broadcastRoomUpdate(room);
	}

	/**
	 * 获取房间状态
	 */
	getRoomState(roomId: string): RoomState | undefined {
		const room = this._rooms.get(roomId);
		if (!room) return undefined;

		return this._toRoomState(room);
	}

	getRoomCount(): number {
		return this._rooms.size;
	}

	// ===== 玩家相机管理方法 =====

	updatePlayerCamera(roomId: string, playerId: string, camera: PlayerCamera): void {
		const room = this._rooms.get(roomId);
		if (!room) return;
		room.playerCameras.set(playerId, camera);
	}

	getRoomPlayerCameras(roomId: string): PlayerCamera[] {
		const room = this._rooms.get(roomId);
		if (!room) return [];
		return Array.from(room.playerCameras.values());
	}

	getPlayerCamera(roomId: string, playerId: string): PlayerCamera | undefined {
		const room = this._rooms.get(roomId);
		if (!room) return undefined;
		return room.playerCameras.get(playerId);
	}

	removePlayerCamera(roomId: string, playerId: string): void {
		const room = this._rooms.get(roomId);
		if (!room) return;
		room.playerCameras.delete(playerId);
	}

	getMapSnapshot(roomId: string): MapSnapshot {
		const room = this._rooms.get(roomId) ?? this.createRoom(roomId);
		return room.mapSnapshot;
	}

	saveMapSnapshot(roomId: string, snapshot: MapSnapshot): MapSnapshot {
		const room = this._rooms.get(roomId) ?? this.createRoom(roomId);
		room.mapSnapshot = {
			...snapshot,
			savedAt: Date.now(),
			version: snapshot.version || PROTOCOL_VERSION,
		};
		room.updatedAt = Date.now();
		return room.mapSnapshot;
	}

	upsertTokenPosition(
		roomId: string,
		tokenId: string,
		position: Point,
		heading: number,
		ownerId = "mvp",
		type: TokenInfo["type"] = "ship",
		size = 50,
	): TokenInfo {
		const room = this._rooms.get(roomId) ?? this.createRoom(roomId);
		const snapshot = room.mapSnapshot;
		const existing = snapshot.tokens.find((token) => token.id === tokenId);
		const updated: TokenInfo = {
			id: tokenId,
			ownerId: existing?.ownerId ?? ownerId,
			position,
			heading,
			type: existing?.type ?? type,
			size: existing?.size ?? size,
			scale: existing?.scale ?? 1,
			turnState: existing?.turnState ?? "waiting",
			maxMovement: existing?.maxMovement ?? 9999,
			remainingMovement: existing?.remainingMovement ?? 9999,
			actionsPerTurn: existing?.actionsPerTurn ?? 0,
			remainingActions: existing?.remainingActions ?? 0,
			layer: existing?.layer ?? 1,
			collisionRadius: existing?.collisionRadius ?? size,
			metadata: existing?.metadata ?? {},
		};

		if (existing) {
			existing.position = position;
			existing.heading = heading;
		} else {
			snapshot.tokens.push(updated);
		}

		snapshot.savedAt = Date.now();
		room.updatedAt = Date.now();
		return updated;
	}

	// ===== 私有方法 =====

	private _createDefaultSnapshot(roomId: string): MapSnapshot {
		return {
			version: PROTOCOL_VERSION,
			savedAt: Date.now(),
			map: {
				id: `${roomId}_map`,
				width: 4096,
				height: 4096,
				name: `Room ${roomId} Star Map`,
			},
			tokens: [],
			starMap: {
				stars: {},
				systems: {},
			},
		};
	}

	private _toRoomInfo(room: Room): RoomInfo {
		return {
			id: room.id,
			name: room.name,
			ownerId: room.ownerId,
			maxPlayers: room.maxPlayers,
			isPrivate: room.isPrivate,
			hasPassword: !!room.password,
			phase: room.phase,
			playerCount: room.players.size,
			createdAt: room.createdAt,
			updatedAt: room.updatedAt,
		};
	}

	private _toRoomState(room: Room): RoomState {
		const dmPlayers = Array.from(room.players.values())
			.filter(p => p.isDMMode)
			.map(p => ({ id: p.id, name: p.name, isDMMode: p.isDMMode }));

		return {
			id: room.id,
			name: room.name,
			ownerId: room.ownerId,
			maxPlayers: room.maxPlayers,
			isPrivate: room.isPrivate,
			phase: room.phase,
			players: Array.from(room.players.values()),
			dm: {
				isDMMode: dmPlayers.length > 0,
				players: dmPlayers,
			},
			createdAt: room.createdAt,
			updatedAt: room.updatedAt,
		};
	}

	private _broadcastRoomUpdate(room: Room): void {
		if (!this._wsServer) return;

		const roomState = this._toRoomState(room);
		this.broadcastToRoom(room.id, {
			type: WS_MESSAGE_TYPES.ROOM_UPDATE,
			payload: {
				roomId: room.id,
				players: roomState.players.map((p: PlayerInfo) => ({
					id: p.id,
					name: p.name,
					isReady: p.isActive,
					currentShipId: null,
				})),
			},
		});

		// 同时广播房间列表更新
		this._broadcastRoomListUpdate('update', room);
	}

	private _broadcastRoomListUpdate(action: 'add' | 'remove' | 'update', room: Room): void {
		if (!this._wsServer) return;

		// 广播给所有连接的客户端（实际应用中可能需要限制）
		const roomInfo = this._toRoomInfo(room);
		this._wsServer.broadcast({
			type: WS_MESSAGE_TYPES.ROOM_UPDATE,
			payload: {
				action,
				room: roomInfo,
			},
		} as any);
	}
}

export default RoomManager;