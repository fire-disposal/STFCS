/**
 * 房间管理器（Socket.IO 适配版）
 *
 * 移除 ConnectionManager 依赖，改为在创建 Room 时注入传输回调。
 */

import { createLogger } from "../../infra/simple-logger.js";
import { Room, type RoomTransportCallbacks } from "./Room.js";
import type { GameState } from "../../core/types/common.js";

export interface RoomManagerOptions {
	maxRooms?: number;
	roomCleanupDelay?: number;
	roomInactivityTimeout?: number;
}

export class RoomManager {
	private rooms = new Map<string, Room>();
	private logger = createLogger("room-manager");
	private options: Required<RoomManagerOptions>;
	/** playerId -> socketId 映射（由外部 Socket.IO handler 维护并注入） */
	private playerSocketMap = new Map<string, string>();

	constructor(options: RoomManagerOptions = {}) {
		this.options = {
			maxRooms: 100,
			roomCleanupDelay: 30000,
			roomInactivityTimeout: 300000,
			...options,
		};
		this.startCleanupCycle();
	}

	/** 设置玩家 socket 映射（由 Socket.IO handler 调用） */
	setPlayerSocket(playerId: string, socketId: string): void {
		this.playerSocketMap.set(playerId, socketId);
	}

	removePlayerSocket(playerId: string): void {
		this.playerSocketMap.delete(playerId);
	}

	/** 创建新房间 */
	createRoom(options: {
		roomName: string;
		maxPlayers?: number;
		mapWidth?: number;
		mapHeight?: number;
		creatorSessionId?: string;
	}): Room | null {
		if (this.rooms.size >= this.options.maxRooms) {
			this.logger.warn("Maximum rooms limit reached", { maxRooms: this.options.maxRooms });
			return null;
		}

		// 构建传输回调（闭包捕获 roomId）
		const roomIdRef = { current: "" as string };
		const callbacks: RoomTransportCallbacks = {
			sendToPlayer: (_playerId, _message) => {
				// 由外部 Socket.IO handler 覆写
			},
			broadcast: (_message) => {},
			broadcastToFaction: (_faction, _message) => {},
			broadcastExcept: (_excludePlayerId, _message) => {},
			broadcastToSpectators: (_message) => {},
			broadcastToPlayers: (_message) => {},
		};

		const room = new Room(callbacks, options);
		roomIdRef.current = room.id;
		this.rooms.set(room.id, room);

		this.logger.info("Room created", {
			roomId: room.id,
			roomName: options.roomName,
			totalRooms: this.rooms.size,
		});

		return room;
	}

	/** 获取房间 */
	getRoom(roomId: string): Room | undefined {
		return this.rooms.get(roomId);
	}

	/** 移除房间 */
	removeRoom(roomId: string): boolean {
		const room = this.rooms.get(roomId);
		if (!room) return false;

		room.cleanup();
		this.rooms.delete(roomId);
		this.logger.info("Room removed", { roomId, totalRooms: this.rooms.size });
		return true;
	}

	/** 玩家加入房间 */
	joinRoom(roomId: string, connectionId: string, playerId: string, playerName: string): boolean {
		const room = this.getRoom(roomId);
		if (!room) {
			this.logger.warn("Room not found", { roomId, playerId });
			return false;
		}
		return room.joinPlayer(connectionId, playerId, playerName);
	}

	/** 玩家离开房间 */
	leaveRoom(roomId: string, playerId: string): boolean {
		const room = this.getRoom(roomId);
		if (!room) return false;
		return room.leavePlayer(playerId);
	}

	/** 处理玩家消息 */
	handlePlayerMessage(roomId: string, playerId: string, message: any): void {
		const room = this.getRoom(roomId);
		if (!room) return;
		room.handlePlayerMessage(playerId, message);
	}

	/** 获取所有房间列表 */
	getAllRooms(): Array<{
		id: string;
		name: string;
		creatorId: string;
		playerCount: number;
		maxPlayers: number;
		gameState: GameState;
		phase: string;
		createdAt: number;
	}> {
		return Array.from(this.rooms.values()).map((room) => ({
			id: room.id,
			name: room.name,
			creatorId: room.creatorId,
			playerCount: room.getPlayerCount(),
			maxPlayers: room.maxPlayers,
			gameState: room.gameState,
			phase: room.getInfo().phase,
			createdAt: room.createdAt,
		}));
	}

	/** 获取活跃房间 */
	getActiveRooms(): Array<{
		id: string;
		name: string;
		playerCount: number;
		maxPlayers: number;
		phase: string;
	}> {
		return this.getAllRooms().filter((room) => room.playerCount > 0);
	}

	/** 搜索房间 */
	searchRooms(criteria: {
		name?: string;
		minPlayers?: number;
		maxPlayers?: number;
		phase?: string;
	}): Array<{
		id: string;
		name: string;
		playerCount: number;
		maxPlayers: number;
		phase: string;
	}> {
		return this.getAllRooms().filter((room) => {
			if (criteria.name && !room.name.toLowerCase().includes(criteria.name.toLowerCase())) return false;
			if (criteria.minPlayers !== undefined && room.playerCount < criteria.minPlayers) return false;
			if (criteria.maxPlayers !== undefined && room.playerCount > criteria.maxPlayers) return false;
			if (criteria.phase && room.phase !== criteria.phase) return false;
			return true;
		});
	}

	/** 获取房间统计 */
	getStats(): {
		totalRooms: number;
		activeRooms: number;
		totalPlayers: number;
		maxRooms: number;
	} {
		let totalPlayers = 0;
		let activeRooms = 0;
		for (const room of this.rooms.values()) {
			const count = room.getPlayerCount();
			totalPlayers += count;
			if (count > 0) activeRooms++;
		}
		return {
			totalRooms: this.rooms.size,
			activeRooms,
			totalPlayers,
			maxRooms: this.options.maxRooms,
		};
	}

	/** 处理连接断开 */
	handleConnectionDisconnected(connectionId: string): void {
		for (const room of this.rooms.values()) {
			const players = room.getPlayers();
			for (const player of players) {
				if ((player as any).connectionId === connectionId) {
					room.leavePlayer(player.id);
					break;
				}
			}
		}
	}

	// ==================== 清理 ====================

	private startCleanupCycle(): void {
		setInterval(() => this.cleanupInactiveRooms(), this.options.roomCleanupDelay);
	}

	private cleanupInactiveRooms(): void {
		const now = Date.now();
		const toRemove: string[] = [];

		for (const [roomId, room] of this.rooms.entries()) {
			if (room.getPlayerCount() === 0 && now - room.createdAt > this.options.roomInactivityTimeout) {
				toRemove.push(roomId);
			}
		}

		for (const roomId of toRemove) {
			this.removeRoom(roomId);
		}

		if (toRemove.length > 0) {
			this.logger.info("Cleaned up inactive rooms", { count: toRemove.length, totalRooms: this.rooms.size });
		}
	}

	cleanupAllRooms(): void {
		for (const roomId of Array.from(this.rooms.keys())) {
			this.removeRoom(roomId);
		}
		this.logger.info("All rooms cleaned up");
	}
}
