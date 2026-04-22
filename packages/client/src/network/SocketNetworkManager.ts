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
	CombatToken,
	WeaponJSON,
	GameRoomState,
	StatePatch,
	StatePatchPayload,
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
	loadout?: { ships: CombatToken[]; weapons: WeaponJSON[] };
	error?: string;
}

interface InternalGameState {
	phase?: string;
	turnCount?: number;
	activeFaction?: string;
	tokens?: Record<string, CombatToken>;
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
			const [tokenRes, weaponRes] = await Promise.all([
				this.request("customize:token", { action: "list" }),
				this.request("customize:weapon", { action: "list" }),
			]);

			const ships = (tokenRes as { ships?: CombatToken[] }).ships ?? [];
			const weapons = (weaponRes as { weapons?: WeaponJSON[] }).weapons ?? [];

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

	kickPlayer(targetId: string): void {
		this.socket?.emit("request", { event: "room:action", requestId: crypto.randomUUID(), payload: { action: "kick", targetId } });
	}

	transferHost(targetId: string): void {
		this.socket?.emit("request", { event: "room:action", requestId: crypto.randomUUID(), payload: { action: "transfer_host", targetId } });
	}

	async deleteRoom(roomId: string): Promise<{ success: boolean; error?: string }> {
		if (!this.socket?.connected || !this.playerId) return { success: false, error: "Not authenticated" };

		try {
			await this.request("room:delete", { roomId });
			this.currentRoomId = null;
			this.gameState = null;
			return { success: true };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Delete failed" };
		}
	}

	async forceEndTurn(faction?: "PLAYER" | "ENEMY" | "NEUTRAL"): Promise<{ success: boolean; error?: string }> {
		try {
			await this.request("edit:room", { action: "force_end_turn", faction });
			return { success: true };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "操作失败" };
		}
	}

	async setPhase(phase: string): Promise<{ success: boolean; error?: string }> {
		try {
			await this.request("edit:room", { action: "set_phase", phase });
			return { success: true };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "操作失败" };
		}
	}

	async setTurn(turn: number): Promise<{ success: boolean; error?: string }> {
		try {
			await this.request("edit:room", { action: "set_turn", turn });
			return { success: true };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "操作失败" };
		}
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
				turnCount: state.turnCount,
				activeFaction: state.activeFaction,
				tokens: state.tokens,
				players: state.players,
			};
			this.emit("sync:full", state);
			this.emit("state:full", state);
		});

		this.socket.on("state:patch", (data: StatePatchPayload) => {
			if (this.gameState) this.applyPatches(data.patches);
			this.emit("state:patch", data);
		});

		this.socket.on("battle:log", (data: { log: unknown }) => {
			this.emit("battle:log", data);
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

	private applyPatches(patches: StatePatch[]): void {
		for (const patch of patches) {
			if (!this.gameState) continue;

			const path = patch.path;
			if (path.length === 0) continue;

			const [rootKey, ...restPath] = path;

			if (rootKey === "tokens") {
				if (restPath.length === 0) {
					if (patch.op === "add" && patch.value) {
						this.gameState.tokens ??= {};
						this.gameState.tokens[patch.value.$id as string] = patch.value as CombatToken;
					}
				} else {
					const tokenId = String(restPath[0]);
					if (patch.op === "remove") {
						if (this.gameState.tokens) delete this.gameState.tokens[tokenId];
					} else if (patch.op === "add" || patch.op === "replace") {
						this.gameState.tokens ??= {};
						if (!this.gameState.tokens[tokenId] && patch.op === "add") {
							this.gameState.tokens[tokenId] = patch.value as CombatToken;
						} else if (this.gameState.tokens[tokenId]) {
							this.applyPatchToObject(this.gameState.tokens[tokenId], restPath.slice(1), patch);
						}
					}
				}
			} else if (rootKey === "players") {
				if (restPath.length === 0) {
					if (patch.op === "add" && patch.value) {
						this.gameState.players ??= {};
						const player = patch.value as { sessionId: string };
						this.gameState.players[player.sessionId] = patch.value;
					}
				} else {
					const playerId = String(restPath[0]);
					if (patch.op === "remove") {
						if (this.gameState.players) delete this.gameState.players[playerId];
					} else if (this.gameState.players?.[playerId]) {
						this.applyPatchToObject(this.gameState.players[playerId], restPath.slice(1), patch);
					}
				}
			} else if (rootKey === "phase" && patch.op === "replace") {
				this.gameState.phase = patch.value as string;
			} else if (rootKey === "turnCount" && patch.op === "replace") {
				this.gameState.turnCount = patch.value as number;
			} else if (rootKey === "activeFaction" && patch.op === "replace") {
				this.gameState.activeFaction = patch.value as string;
			}
		}
	}

	private applyPatchToObject(obj: unknown, path: (string | number)[], patch: StatePatch): void {
		if (path.length === 0) return;
		if (!obj || typeof obj !== "object") return;

		const target = obj as Record<string | number, unknown>;
		const [key, ...rest] = path;

		if (rest.length === 0) {
			if (patch.op === "remove") {
				delete target[key];
			} else {
				target[key] = patch.value;
			}
		} else {
			if (!target[key]) target[key] = typeof rest[0] === "number" ? [] : {};
			this.applyPatchToObject(target[key], rest, patch);
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