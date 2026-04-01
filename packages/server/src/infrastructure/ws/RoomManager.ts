import type { MapSnapshot, PlayerCamera, PlayerInfo, Point, TokenInfo } from "@vt/shared/types";
import type { IWSServer, WSMessage } from "@vt/shared/ws";
import { GLOBAL_ROOM_ID } from "@vt/shared/constants";
import { RoomMapStore } from "../map/RoomMapStore";

export interface Room {
	id: string;
	players: Map<string, PlayerInfo>;
	createdAt: number;
	maxPlayers: number;
	playerCameras: Map<string, PlayerCamera>;
	mapSnapshot: MapSnapshot;
}

export interface GlobalObjectState {
	id: string;
	kind: "marker" | "token" | "note";
	position: { x: number; y: number };
	meta?: Record<string, unknown>;
	updatedAt: number;
}

export interface GlobalChatMessage {
	id: string;
	from: string;
	text: string;
	at: number;
}

export interface GlobalSessionState {
	revision: number;
	players: Record<string, PlayerInfo & { online: boolean; lastSeenAt: number; role: "host" | "member" }>;
	objects: Record<string, GlobalObjectState>;
	chat: GlobalChatMessage[];
	sessions: Record<string, { playerId: string; expiresAt: number }>;
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
	private readonly _globalRoom: Room;
	private readonly _playerRooms: Map<string, string>;
	private _wsServer: IWSServer | undefined;
	private readonly _mapStore: RoomMapStore;
	private _globalState: GlobalSessionState;

	constructor(maxPlayersPerRoom: number = 8) {
		this._playerRooms = new Map();
		this._mapStore = new RoomMapStore();
		this._globalRoom = {
			id: GLOBAL_ROOM_ID,
			players: new Map(),
			createdAt: Date.now(),
			maxPlayers: maxPlayersPerRoom,
			playerCameras: new Map(),
			mapSnapshot: this._mapStore.getSnapshot(GLOBAL_ROOM_ID),
		};
		this._globalState = {
			revision: 0,
			players: {},
			objects: {},
			chat: [],
			sessions: {},
		};
	}

	setWSServer(wsServer: IWSServer): void {
		this._wsServer = wsServer;
	}

	createRoom(_roomId: string, maxPlayers?: number): Room {
		if (typeof maxPlayers === "number") {
			this._globalRoom.maxPlayers = maxPlayers;
		}
		return this._globalRoom;
	}

	joinRoom(_roomId: string, player: PlayerInfo): boolean {
		if (this._globalRoom.players.size >= this._globalRoom.maxPlayers) {
			return false;
		}

		if (this._globalRoom.players.has(player.id)) {
			return true;
		}

		this._globalRoom.players.set(player.id, player);
		this._playerRooms.set(player.id, GLOBAL_ROOM_ID);
		const role: "host" | "member" = Object.keys(this._globalState.players).length === 0 ? "host" : "member";
		this._globalState.players[player.id] = {
			...player,
			online: true,
			lastSeenAt: Date.now(),
			role,
		};
		return true;
	}

	leaveRoom(_roomId: string, playerId: string): boolean {
		const removed = this._globalRoom.players.delete(playerId);
		this._playerRooms.delete(playerId);
		this._globalRoom.playerCameras.delete(playerId);
		if (this._globalState.players[playerId]) {
			this._globalState.players[playerId].online = false;
			this._globalState.players[playerId].lastSeenAt = Date.now();
		}
		return removed;
	}

	getRoom(_roomId: string): Room | undefined {
		return this._globalRoom;
	}

	getPlayerRoom(playerId: string): Room | undefined {
		return this._playerRooms.has(playerId) ? this._globalRoom : undefined;
	}

	broadcastToRoom(_roomId: string, message: WSMessage, excludePlayerId?: string): void {
		if (!this._wsServer) {
			return;
		}

		for (const [playerId] of this._globalRoom.players.entries()) {
			if (playerId !== excludePlayerId) {
				this._wsServer.sendTo(playerId, message);
			}
		}
	}

	deleteRoom(_roomId: string): void {
		this._globalRoom.players.clear();
		this._globalRoom.playerCameras.clear();
		this._playerRooms.clear();
	}

	listRooms(): Room[] {
		return [this._globalRoom];
	}

	getRoomCount(): number {
		return 1;
	}

	updatePlayerCamera(_roomId: string, playerId: string, camera: PlayerCamera): void {
		this._globalRoom.playerCameras.set(playerId, camera);
	}

	getRoomPlayerCameras(_roomId: string): PlayerCamera[] {
		return Array.from(this._globalRoom.playerCameras.values());
	}

	getPlayerCamera(_roomId: string, playerId: string): PlayerCamera | undefined {
		return this._globalRoom.playerCameras.get(playerId);
	}

	removePlayerCamera(_roomId: string, playerId: string): void {
		this._globalRoom.playerCameras.delete(playerId);
	}

	getMapSnapshot(_roomId: string): MapSnapshot {
		return this._mapStore.getSnapshot(GLOBAL_ROOM_ID);
	}

	saveMapSnapshot(_roomId: string, snapshot: MapSnapshot): MapSnapshot {
		const saved = this._mapStore.saveSnapshot(GLOBAL_ROOM_ID, snapshot);
		this._globalRoom.mapSnapshot = saved;
		return saved;
	}

	upsertTokenPosition(
		_roomId: string,
		tokenId: string,
		position: Point,
		heading: number,
		ownerId = "mvp",
		type: TokenInfo["type"] = "ship",
		size = 50,
		metadata: Record<string, unknown> = {},
	): TokenInfo {
		const updated = this._mapStore.upsertToken(
			GLOBAL_ROOM_ID,
			tokenId,
			position,
			heading,
			ownerId,
			type,
			size,
			metadata,
		);
		this._globalRoom.mapSnapshot = this._mapStore.getSnapshot(GLOBAL_ROOM_ID);
		return updated;
	}

	nextRevision(): number {
		this._globalState.revision += 1;
		return this._globalState.revision;
	}

	getGlobalState(): GlobalSessionState {
		return structuredClone(this._globalState);
	}

	setSession(token: string, playerId: string, expiresAt: number): void {
		this._globalState.sessions[token] = { playerId, expiresAt };
	}

	getSession(token: string): { playerId: string; expiresAt: number } | undefined {
		return this._globalState.sessions[token];
	}

	upsertObject(object: GlobalObjectState): void {
		this._globalState.objects[object.id] = object;
	}

	removeObject(objectId: string): void {
		delete this._globalState.objects[objectId];
	}

	appendChat(message: GlobalChatMessage): void {
		this._globalState.chat.push(message);
		if (this._globalState.chat.length > 100) {
			this._globalState.chat = this._globalState.chat.slice(-100);
		}
	}
}

export default RoomManager;
