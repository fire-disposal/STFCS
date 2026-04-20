/**
 * SocketNetworkManager - Socket.IO 连接管理
 *
 * 负责：
 * - 建立/维护 Socket.IO 连接
 * - 认证流程
 * - 房间列表获取
 * - 房间创建/加入/离开
 */

import { io, Socket } from "socket.io-client";
import type { SocketIOActionEvent } from "@vt/data";

const logger = {
	info: (...args: any[]) => console.log("[network]", ...args),
	warn: (...args: any[]) => console.warn("[network]", ...args),
	error: (...args: any[]) => console.error("[network]", ...args),
};

export interface RoomInfo {
	roomId: string;
	name: string;
	clients: number;
	maxClients: number;
	metadata: {
		phase: string;
		turnCount?: number;
		ownerShortId?: number;
		isPrivate?: boolean;
	};
}

export interface AuthResult {
	success: boolean;
	playerId?: string;
	playerName?: string;
	profile?: {
		nickname: string;
		avatar: string;
	};
	error?: string;
}

export interface RoomCreateOptions {
	roomName: string;
	maxPlayers?: number;
}

export interface RoomJoinResult {
	success: boolean;
	roomId?: string;
	error?: string;
}

interface SocketGameState {
	currentPhase: string;
	turnCount: number;
	activeFaction: string;
	ships: Map<string, any>;
	players: Map<string, any>;
}

export class SocketNetworkManager {
	private socket: Socket | null = null;
	private serverUrl: string;
	private playerId: string | null = null;
	private playerName: string | null = null;
	private currentRoomId: string | null = null;
	private gameState: SocketGameState | null = null;
	private listeners: Map<string, Set<(data: any) => void>> = new Map();

	constructor(serverUrl: string) {
		this.serverUrl = serverUrl;
	}

	async connect(): Promise<boolean> {
		if (this.socket?.connected) {
			logger.info("Already connected");
			return true;
		}

		this.socket = io(this.serverUrl, {
			transports: ["websocket"],
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
		});

		this.setupEventHandlers();

		return new Promise((resolve) => {
			this.socket!.once("connect", () => {
				logger.info("Socket.IO connected", { socketId: this.socket!.id });
				resolve(true);
			});
			this.socket!.once("connect_error", (err) => {
				logger.error("Connection failed", { error: err.message });
				resolve(false);
			});
		});
	}

	async authenticate(playerName: string): Promise<AuthResult> {
		if (!this.socket?.connected) {
			return { success: false, error: "Not connected" };
		}

		return new Promise((resolve) => {
			this.socket!.emit("auth", { playerName });
			this.socket!.once("auth:success", (data: {
				playerId: string;
				playerName: string;
				profile?: { nickname: string; avatar: string };
			}) => {
				this.playerId = data.playerId;
				this.playerName = data.playerName;
				logger.info("Authenticated", { playerId: data.playerId });
				resolve({ success: true, ...data });
			});
			this.socket!.once("error", (err: { code: string; message: string }) => {
				if (err.code === "AUTH_FAILED") {
					resolve({ success: false, error: err.message });
				}
			});
		});
	}

	async getRoomList(): Promise<RoomInfo[]> {
		return new Promise((resolve) => {
			this.socket?.emit("room:list");
			this.socket?.once("room:list:result", (data: { rooms: RoomInfo[] }) => {
				resolve(data.rooms || []);
			});
			setTimeout(() => resolve([]), 5000);
		});
	}

	async getProfile(): Promise<{ success: boolean; profile?: { nickname: string; avatar: string }; error?: string }> {
		if (!this.socket?.connected) {
			return { success: false, error: "Not connected" };
		}

		return new Promise((resolve) => {
			this.socket!.emit("profile:get", (result: any) => {
				resolve(result);
			});
		});
	}

	async updateProfile(profile: {
		nickname?: string;
		avatar?: string;
	}): Promise<{ success: boolean; profile?: { nickname: string; avatar: string }; error?: string }> {
		if (!this.socket?.connected) {
			return { success: false, error: "Not connected" };
		}

		return new Promise((resolve) => {
			this.socket!.emit("profile:update", profile, (result: any) => {
				resolve(result);
			});
		});
	}

	async createRoom(options: RoomCreateOptions): Promise<RoomJoinResult> {
		if (!this.socket?.connected || !this.playerId) {
			return { success: false, error: "Not authenticated" };
		}

		return new Promise((resolve) => {
			const timeoutId = setTimeout(() => {
				resolve({ success: false, error: "Room creation timeout" });
			}, 10000); // 10秒超时

			const cleanup = () => {
				clearTimeout(timeoutId);
				this.socket!.off("room:created", onRoomCreated);
				this.socket!.off("error", onError);
			};

			const onRoomCreated = (data: { roomId: string; roomName: string }) => {
				cleanup();
				this.currentRoomId = data.roomId;
				logger.info("Room created and joined", { roomId: data.roomId });
				resolve({ success: true, roomId: data.roomId });
			};

			const onError = (err: { code: string; message: string }) => {
				if (err.code === "ROOM_CREATE_FAILED") {
					cleanup();
					resolve({ success: false, error: err.message });
				}
			};

			this.socket!.emit("room:create", {
				roomName: options.roomName,
				maxPlayers: options.maxPlayers ?? 4,
			});
			this.socket!.once("room:created", onRoomCreated);
			this.socket!.once("error", onError);
		});
	}

	async joinRoom(roomId: string): Promise<RoomJoinResult> {
		if (!this.socket?.connected || !this.playerId) {
			return { success: false, error: "Not authenticated" };
		}

		return new Promise((resolve) => {
			this.socket!.emit("room:join", { roomId });
			this.socket!.once("state:full", (state: SocketGameState) => {
				this.currentRoomId = roomId;
				this.gameState = state;
				this.emit("state:full", state);
				resolve({ success: true, roomId });
			});
			this.socket!.once("error", (err: { code: string; message: string }) => {
				resolve({ success: false, error: err.message });
			});
		});
	}

	leaveRoom(): void {
		if (this.currentRoomId) {
			this.socket?.emit("room:leave");
			this.currentRoomId = null;
			this.gameState = null;
		}
	}

	setReady(_isReady: boolean): void {
		this.socket?.emit("room:ready");
	}

	startGame(): void {
		this.socket?.emit("room:start");
	}

	sendAction(event: SocketIOActionEvent, payload: unknown): Promise<{ success: boolean; error?: string }> {
		return new Promise((resolve) => {
			this.socket?.emit(event, payload, (result: any) => {
				resolve(result);
			});
		});
	}

	send(event: string, payload: unknown): Promise<any> {
		return new Promise((resolve) => {
			this.socket?.emit(event, payload, (result: any) => {
				resolve(result);
			});
		});
	}

	getPlayerId(): string | null {
		return this.playerId;
	}

	getPlayerName(): string | null {
		return this.playerName;
	}

	getCurrentRoomId(): string | null {
		return this.currentRoomId;
	}

	getGameState(): SocketGameState | null {
		return this.gameState;
	}

	isConnected(): boolean {
		return this.socket?.connected ?? false;
	}

	on(event: string, handler: (data: any) => void): void {
		if (!this.listeners.has(event)) {
			this.listeners.set(event, new Set());
		}
		this.listeners.get(event)!.add(handler);
		this.socket?.on(event, handler);
	}

	off(event: string, handler?: (data: any) => void): void {
		if (handler) {
			this.listeners.get(event)?.delete(handler);
			this.socket?.off(event, handler);
		} else {
			this.listeners.get(event)?.clear();
			this.socket?.off(event);
		}
	}

	emit(event: string, data: any): void {
		const handlers = this.listeners.get(event);
		if (handlers) {
			handlers.forEach((h) => h(data));
		}
	}

	buildInviteLink(roomId: string): string {
		const baseUrl = window.location.origin;
		return `${baseUrl}/join/${roomId}`;
	}

	private setupEventHandlers(): void {
		if (!this.socket) return;

		this.socket.on("disconnect", (reason) => {
			logger.warn("Disconnected", { reason });
			this.emit("disconnect", { reason });
		});

		this.socket.on("reconnect", (attemptNumber) => {
			logger.info("Reconnected", { attemptNumber });
			this.emit("reconnect", { attemptNumber });
		});

		this.socket.on("state:delta", (data: { events: any[]; timestamp: number }) => {
			if (this.gameState) {
				this.applyDelta(data.events);
			}
			this.emit("state:delta", data);
		});

		this.socket.on("player:joined", (data: { playerId: string; playerName: string; totalPlayers: number }) => {
			this.emit("player:joined", data);
		});

		this.socket.on("player:left", (data: { playerId: string; totalPlayers: number }) => {
			this.emit("player:left", data);
		});

		this.socket.on("event", (data: any) => {
			this.emit("event", data);
		});

		this.socket.on("error", (data: { code: string; message: string }) => {
			logger.error("Server error", data);
			this.emit("error", data);
		});
	}

	private applyDelta(events: any[]): void {
		for (const event of events) {
			switch (event.type) {
				case "ship_update":
					if (this.gameState?.ships && event.shipId && event.data) {
						this.gameState.ships.set(event.shipId, event.data);
					}
					break;
				case "phase_change":
					if (this.gameState && event.phase) {
						this.gameState.currentPhase = event.phase;
					}
					break;
				case "turn_change":
					if (this.gameState && event.turn) {
						this.gameState.turnCount = event.turn;
					}
					break;
			}
		}
	}

	disconnect(): void {
		if (this.socket) {
			this.socket.disconnect();
			this.socket = null;
			this.playerId = null;
			this.playerName = null;
			this.currentRoomId = null;
			this.gameState = null;
			this.listeners.clear();
		}
	}
}

export type { SocketIOActionEvent };