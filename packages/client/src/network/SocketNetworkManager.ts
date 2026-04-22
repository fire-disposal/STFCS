/**
 * SocketNetworkManager - Socket.IO 连接管理
 *
 * 完全基于 @vt/data 的 WsEventDefinitions，使用泛型自动推导类型
 */

import { io, Socket } from "socket.io-client";
import type {
	WsEventName,
	WsPayload,
	WsResponseData,
	WsResponse,
	RoomInfo,
	TokenJSON,
	WeaponJSON,
	GameRoomState,
	DeltaChange,
} from "@vt/data";

const logger = {
	info: (...args: unknown[]) => console.log("[network]", ...args),
	warn: (...args: unknown[]) => console.warn("[network]", ...args),
	error: (...args: unknown[]) => console.error("[network]", ...args),
};

export interface AuthResult {
	success: boolean;
	playerId?: string;
	playerName?: string;
	profile?: { nickname: string; avatar: string | null; avatarAssetId?: string };
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
	loadout?: { ships: TokenJSON[]; weapons: WeaponJSON[] };
	error?: string;
}

interface InternalGameState {
	phase?: string;
	turn?: number;
	activeFaction?: string;
	tokens?: Record<string, TokenJSON>;
	players?: Record<string, unknown>;
}

export class SocketNetworkManager {
	private socket: Socket | null = null;
	private serverUrl: string;
	private playerId: string | null = null;
	private playerName: string | null = null;
	private currentRoomId: string | null = null;
	private gameState: InternalGameState | null = null;
	private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
	private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();

	constructor(serverUrl: string) {
		this.serverUrl = serverUrl;
	}

	async connect(): Promise<boolean> {
		if (this.socket?.connected) return true;

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

	/**
	 * 泛型请求方法 - 自动推导类型
	 */
	async request<E extends WsEventName>(
		event: E,
		payload: WsPayload<E>,
		timeoutMs = 10000
	): Promise<WsResponseData<E>> {
		if (!this.socket?.connected) throw new Error("Not connected");

		const requestId = crypto.randomUUID();

		return new Promise<WsResponseData<E>>((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.pendingRequests.delete(requestId);
				reject(new Error(`Request timeout: ${event}`));
			}, timeoutMs);

			this.pendingRequests.set(requestId, {
				resolve: resolve as (value: unknown) => void,
				reject,
				timeout,
			});

			this.socket!.emit("request", { event, requestId, payload });
		});
	}

	async authenticate(playerName: string): Promise<AuthResult> {
		if (!this.socket?.connected) return { success: false, error: "Not connected" };

		try {
			const data = await this.request("auth:login", { playerName });
			this.playerId = data.playerId;
			this.playerName = data.playerName;
			logger.info("Authenticated", { playerId: data.playerId });

			const profile = await this.getProfile();
			return { success: true, ...data, profile: profile.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Auth failed" };
		}
	}

	async getRoomList(): Promise<RoomInfo[]> {
		try {
			const data = await this.request("room:list", {});
			return data.rooms ?? [];
		} catch {
			return [];
		}
	}

	async getProfile(): Promise<{ success: boolean; profile?: { nickname: string; avatar: string | null }; error?: string }> {
		if (!this.socket?.connected) return { success: false, error: "Not connected" };

		try {
			const data = await this.request("profile:get", {});
			return { success: true, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Profile fetch failed" };
		}
	}

	async updateProfile(profile: { nickname?: string; avatar?: string }): Promise<{ success: boolean; profile?: { nickname: string; avatar: string | null }; error?: string }> {
		if (!this.socket?.connected) return { success: false, error: "Not connected" };

		try {
			const data = await this.request("profile:update", { nickname: profile.nickname, avatar: profile.avatar });
			return { success: true, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Profile update failed" };
		}
	}

	async getLoadout(): Promise<PlayerLoadoutResult> {
		if (!this.socket?.connected) return { success: false, error: "Not connected" };

		try {
			const [tokenData, weaponData] = await Promise.all([
				this.request("token:list", {}),
				this.request("weapon:list", {}),
			]);

			const ships = (tokenData.ships ?? []).filter((s) => s !== null).map((s) => s.shipJson as TokenJSON).filter(Boolean);
			const weapons = (weaponData.weapons ?? []).filter((w) => w !== null).map((w) => w.weaponJson as WeaponJSON).filter(Boolean);

			return { success: true, loadout: { ships, weapons } };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Loadout fetch failed" };
		}
	}

	async createRoom(options: RoomCreateOptions): Promise<RoomJoinResult> {
		if (!this.socket?.connected || !this.playerId) return { success: false, error: "Not authenticated" };

		try {
			const data = await this.request("room:create", { name: options.roomName, maxPlayers: options.maxPlayers ?? 4 }, 10000);
			this.currentRoomId = data.roomId;
			logger.info("Room created and joined", { roomId: data.roomId });
			return { success: true, roomId: data.roomId };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Room creation failed" };
		}
	}

	async joinRoom(roomId: string): Promise<RoomJoinResult> {
		if (!this.socket?.connected || !this.playerId) return { success: false, error: "Not authenticated" };

		try {
			const data = await this.request("room:join", { roomId });
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

	setReady(): void {
		this.socket?.emit("request", { event: "room:action", requestId: crypto.randomUUID(), payload: { action: "ready" } });
	}

	startGame(): void {
		this.socket?.emit("request", { event: "room:action", requestId: crypto.randomUUID(), payload: { action: "start" } });
	}

	async sendGameAction(payload: WsPayload<"game:action">): Promise<{ success: boolean; error?: string }> {
		try {
			await this.request("game:action", payload);
			return { success: true };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Action failed" };
		}
	}

	send<E extends WsEventName>(event: E, payload: WsPayload<E>): Promise<WsResponseData<E>> {
		return this.request(event, payload);
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

	getGameState(): InternalGameState | null {
		return this.gameState;
	}

	isConnected(): boolean {
		return this.socket?.connected ?? false;
	}

	getSocket(): Socket | null {
		return this.socket;
	}

	on(event: string, handler: (data: unknown) => void): void {
		if (!this.listeners.has(event)) this.listeners.set(event, new Set());
		this.listeners.get(event)!.add(handler);
		this.socket?.on(event, handler);
	}

	off(event: string, handler?: (data: unknown) => void): void {
		if (handler) {
			this.listeners.get(event)?.delete(handler);
			this.socket?.off(event, handler);
		} else {
			this.listeners.get(event)?.clear();
			this.socket?.off(event);
		}
	}

	emit(event: string, data: unknown): void {
		this.listeners.get(event)?.forEach((h) => h(data));
	}

	buildInviteLink(roomId: string): string {
		return `${window.location.origin}/join/${roomId}`;
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

		this.socket.on("response", (data: WsResponse) => this.handleResponse(data));

		this.socket.on("sync:full", (state: GameRoomState) => {
			this.gameState = {
				phase: state.phase,
				turn: state.turnCount,
				activeFaction: state.activeFaction,
				tokens: state.tokens,
				players: state.players,
			};
			this.emit("sync:full", state);
			this.emit("state:full", state);
		});

		this.socket.on("sync:delta", (data: { timestamp: number; changes: DeltaChange[] }) => {
			if (this.gameState) this.applyDelta(data.changes);
			this.emit("sync:delta", data);
			this.emit("state:delta", data);
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

	private handleResponse(data: WsResponse): void {
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

	private applyDelta(events: DeltaChange[]): void {
		for (const change of events) {
			if (!this.gameState) continue;

			switch (change.type) {
				case "token_add":
					if (change.id) {
						this.gameState.tokens ??= {};
						this.gameState.tokens[change.id] = change.value as TokenJSON;
					}
					break;
				case "token_update":
					if (change.id && this.gameState.tokens?.[change.id]) {
						this.gameState.tokens[change.id] = { ...this.gameState.tokens[change.id], ...(change.value as Partial<TokenJSON>) };
					}
					break;
				case "token_remove":
				case "token_destroyed":
					if (change.id && this.gameState.tokens) {
						delete this.gameState.tokens[change.id];
					}
					break;
				case "player_join":
					if (change.id) {
						this.gameState.players ??= {};
						this.gameState.players[change.id] = change.value;
					}
					break;
				case "player_leave":
					if (change.id && this.gameState.players) {
						delete this.gameState.players[change.id];
					}
					break;
				case "phase_change":
					this.gameState.phase = change.value as string;
					break;
				case "turn_change":
					this.gameState.turn = change.value as number;
					break;
				case "faction_turn":
					this.gameState.activeFaction = change.value as string;
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

export type { RoomInfo };