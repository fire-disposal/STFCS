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
import type { ShipJSON, SocketIOActionEvent, WeaponJSON } from "@vt/data";

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

export interface PlayerLoadoutResult {
	success: boolean;
	loadout?: {
		ships: ShipJSON[];
		weapons: WeaponJSON[];
	};
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
	private pendingRequests: Map<string, { resolve: Function; reject: Function; timeout: ReturnType<typeof setTimeout> }> = new Map();

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

		try {
			const data = await this.sendRequest<{
				playerId: string;
				playerName: string;
				isHost: boolean;
				role: string;
				profile?: { nickname: string; avatar: string; avatarAssetId?: string };
			}>("auth:login", { playerName });

			this.playerId = data.playerId;
			this.playerName = data.playerName;
			logger.info("Authenticated", { playerId: data.playerId });

			return { success: true, ...data, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Auth failed" };
		}
	}

	async getRoomList(): Promise<RoomInfo[]> {
		try {
			const data = await this.sendRequest<{ rooms: RoomInfo[] }>("room:list", {});
			return data.rooms || [];
		} catch {
			return [];
		}
	}

	async getProfile(): Promise<{ success: boolean; profile?: { nickname: string; avatar: string; avatarAssetId?: string }; error?: string }> {
		if (!this.socket?.connected) {
			return { success: false, error: "Not connected" };
		}

		try {
			const data = await this.sendRequest<{ profile: { nickname: string; avatar: string; avatarAssetId?: string } }>("profile:get", {});
			return { success: true, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Profile fetch failed" };
		}
	}

	async updateProfile(profile: { nickname?: string; avatar?: string; avatarAssetId?: string }): Promise<{ success: boolean; profile?: { nickname: string; avatar: string; avatarAssetId?: string }; error?: string }> {
		if (!this.socket?.connected) {
			return { success: false, error: "Not connected" };
		}

		try {
			const data = await this.sendRequest<{ profile: { nickname: string; avatar: string; avatarAssetId?: string } }>("profile:update", profile);
			return { success: true, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Profile update failed" };
		}
	}

	async getLoadout(): Promise<PlayerLoadoutResult> {
		if (!this.socket?.connected) {
			return { success: false, error: "Not connected" };
		}

		try {
			const data = await this.sendRequest<{ loadout: { ships: ShipJSON[]; weapons: WeaponJSON[] } }>("profile:loadout:get", {});
			return { success: true, loadout: data.loadout };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Loadout fetch failed" };
		}
	}

	async createRoom(options: RoomCreateOptions): Promise<RoomJoinResult> {
		if (!this.socket?.connected || !this.playerId) {
			return { success: false, error: "Not authenticated" };
		}

		try {
			const data = await this.sendRequest<{ roomId: string; roomName: string; isHost: boolean }>("room:create", {
				name: options.roomName,
				maxPlayers: options.maxPlayers ?? 4,
			}, 10000);

			this.currentRoomId = data.roomId;
			logger.info("Room created and joined", { roomId: data.roomId });
			return { success: true, roomId: data.roomId };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Room creation failed" };
		}
	}

	async joinRoom(roomId: string): Promise<RoomJoinResult> {
		if (!this.socket?.connected || !this.playerId) {
			return { success: false, error: "Not authenticated" };
		}

		try {
			const data = await this.sendRequest<{ roomId: string; roomName: string; isHost: boolean; role: string }>("room:join", { roomId });

			this.currentRoomId = roomId;
			return { success: true, roomId: data.roomId };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Join failed" };
		}
	}

	leaveRoom(): void {
		if (this.currentRoomId) {
			this.socket?.emit("request", { event: "room:leave", requestId: crypto.randomUUID(), payload: {} });
			this.currentRoomId = null;
			this.gameState = null;
		}
	}

	setReady(_isReady: boolean): void {
		this.socket?.emit("request", { event: "room:action", requestId: crypto.randomUUID(), payload: { action: "ready" } });
	}

	startGame(): void {
		this.socket?.emit("request", { event: "room:action", requestId: crypto.randomUUID(), payload: { action: "start" } });
	}

	sendAction(event: SocketIOActionEvent, payload: unknown): Promise<{ success: boolean; error?: string }> {
		const action = event.replace("game:", "");
		const finalPayload = typeof payload === "object" && payload !== null ? { action, ...payload } : { action };
		return this.sendRequest("game:action", finalPayload);
	}

	send(event: string, payload: unknown): Promise<any> {
		return this.sendRequest(event, payload);
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

	getSocket(): Socket | null {
		return this.socket;
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

		this.socket.on("response", (data: { requestId: string; success: boolean; data?: any; error?: { code: string; message: string } }) => {
			this.handleResponse(data);
		});

		this.socket.on("sync:full", (state: SocketGameState) => {
			this.gameState = state;
			this.emit("sync:full", state);
		});

		this.socket.on("sync:delta", (data: { timestamp: number; changes: any[] }) => {
			if (this.gameState) {
				this.applyDelta(data.changes);
			}
			this.emit("sync:delta", data);
		});

		this.socket.on("player:joined", (data: { playerId: string; playerName: string; totalPlayers: number }) => {
			this.emit("player:joined", data);
		});

		this.socket.on("player:left", (data: { playerId: string; totalPlayers: number }) => {
			this.emit("player:left", data);
		});

		this.socket.on("error", (data: { code: string; message: string }) => {
			logger.error("Server error", data);
			this.emit("error", data);
		});
	}

	private handleResponse(data: { requestId: string; success: boolean; data?: any; error?: { code: string; message: string } }): void {
		const pending = this.pendingRequests.get(data.requestId);
		if (!pending) return;

		clearTimeout(pending.timeout);
		this.pendingRequests.delete(data.requestId);

		if (data.success) {
			pending.resolve(data.data);
		} else {
			pending.reject(new Error(data.error?.message ?? "Unknown error"));
		}
	}

	private sendRequest<T>(event: string, payload: unknown, timeoutMs = 10000): Promise<T> {
		if (!this.socket?.connected) {
			return Promise.reject(new Error("Not connected"));
		}

		const requestId = crypto.randomUUID();

		return new Promise<T>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				reject(new Error(`Request timeout: ${event}`));
			}, timeoutMs);

			this.pendingRequests.set(requestId, { resolve, reject, timeout });
			this.socket!.emit("request", { event, requestId, payload });
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
			for (const pending of this.pendingRequests.values()) {
				clearTimeout(pending.timeout);
				pending.reject(new Error("Disconnected"));
			}
			this.pendingRequests.clear();

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