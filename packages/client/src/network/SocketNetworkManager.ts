/**
 * SocketNetworkManager - Socket.IO 连接管理
 * 
 * 设计原则：
 * 1. 状态驱动：gameState 变化自动触发 React 更新
 * 2. 房间流程：create 仅创建；join 返回状态快照并可回退 sync:request_full
 * 3. 利用 Zustand：前端 hooks 直接订阅 gameState
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

type StateChangeListener = (state: GameRoomState | null) => void;

export class SocketNetworkManager {
	private socket: Socket | null = null;
	private serverUrl: string;
	private playerId: string | null = null;
	private playerName: string | null = null;
	private currentRoomId: string | null = null;
	private gameState: GameRoomState | null = null;
	private pendingRequests: Map<string, { resolve: (value: unknown) => void; reject: (reason: Error) => void; timeout: ReturnType<typeof setTimeout> }> = new Map();
	private stateListeners: Set<StateChangeListener> = new Set();

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
				logger.info("Connected", { socketId: this.socket!.id });
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
				reject(new Error(`Timeout: ${event}`));
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
		try {
			const data = await this.request("profile:get", {});
			return { success: true, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Failed" };
		}
	}

	async updateProfile(profile: { nickname?: string; avatar?: string }): Promise<{ success: boolean; profile?: { nickname: string; avatar: string | null }; error?: string }> {
		try {
			const data = await this.request("profile:update", profile);
			return { success: true, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Failed" };
		}
	}

	async getLoadout(): Promise<PlayerLoadoutResult> {
		try {
			const [tokenRes, weaponRes] = await Promise.all([
				this.request("customize:token", { action: "list" }),
				this.request("customize:weapon", { action: "list" }),
			]);

			return {
				success: true,
				loadout: {
					ships: (tokenRes as any).ships ?? [],
					weapons: (weaponRes as any).weapons ?? [],
				},
			};
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Failed" };
		}
	}

	async createRoom(options: { roomName: string; maxPlayers?: number }): Promise<RoomJoinResult> {
		try {
			const data = await this.request("room:create", { name: options.roomName, maxPlayers: options.maxPlayers ?? 4 });
			logger.info("Room created", { roomId: data.roomId });
			return { success: true, roomId: data.roomId };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Failed" };
		}
	}

	async joinRoom(roomId: string): Promise<RoomJoinResult> {
		try {
			logger.info("joinRoom start", { roomId });
			this.currentRoomId = roomId;
			const data = await this.request("room:join", { roomId });

			if (data.state) {
				this.setGameState(data.state);
			}

			if (!this.gameState || this.gameState.roomId !== roomId) {
				logger.warn("joinRoom missing sync:full, requesting full state", { roomId });
				await this.requestFullState();
			}

			logger.info("joinRoom request success", { roomId });
			return { success: true, roomId };
		} catch (error) {
			logger.error("joinRoom failed", { error });
			this.currentRoomId = null;
			return { success: false, error: error instanceof Error ? error.message : "Failed" };
		}
	}

	async requestFullState(): Promise<GameRoomState> {
		const fullState = await this.request("sync:request_full", {});
		this.setGameState(fullState);
		return fullState;
	}

	leaveRoom(): void {
		if (this.currentRoomId) {
			logger.info("leaveRoom", { roomId: this.currentRoomId });
			this.socket?.emit("request", { event: "room:leave", requestId: crypto.randomUUID(), payload: {} });
			this.currentRoomId = null;
			this.setGameState(null);
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
		try {
			await this.request("room:delete", { roomId });
			this.currentRoomId = null;
			this.setGameState(null);
			return { success: true };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Failed" };
		}
	}

	send<E extends WsEventName>(event: E, payload: WsPayload<E>): Promise<WsResponseData<E>> {
		return this.request(event, payload);
	}

	buildInviteLink(roomId: string): string {
		return `${window.location.origin}/join/${roomId}`;
	}

	getPlayerId(): string | null { return this.playerId; }
	getPlayerName(): string | null { return this.playerName; }
	getCurrentRoomId(): string | null { return this.currentRoomId; }
	getGameState(): GameRoomState | null { return this.gameState; }
	getSocket(): Socket | null { return this.socket; }
	isConnected(): boolean { return this.socket?.connected ?? false; }

	subscribeState(listener: StateChangeListener): () => void {
		this.stateListeners.add(listener);
		return () => this.stateListeners.delete(listener);
	}

	disconnect(): void {
		if (this.socket) {
			this.pendingRequests.forEach(p => {
				clearTimeout(p.timeout);
				p.reject(new Error("Disconnected"));
			});
			this.pendingRequests.clear();
			this.socket.disconnect();
			this.socket = null;
			this.playerId = null;
			this.playerName = null;
			this.currentRoomId = null;
			this.setGameState(null);
		}
	}

	private setGameState(state: GameRoomState | null): void {
		this.gameState = state;
		this.stateListeners.forEach(listener => listener(state));
	}

	private setupEventHandlers(): void {
		if (!this.socket) return;

		this.socket.on("disconnect", () => {
			logger.warn("Disconnected from server");
			this.currentRoomId = null;
			this.setGameState(null);
		});

		this.socket.on("response", (data: WsResponse) => {
			const pending = this.pendingRequests.get(data.requestId);
			if (!pending) return;
			clearTimeout(pending.timeout);
			this.pendingRequests.delete(data.requestId);
			if (data.success) {
				pending.resolve(data.data);
			} else {
				pending.reject(new Error(data.error?.message ?? "Error"));
			}
		});

		this.socket.on("sync:full", (state: GameRoomState) => {
			logger.info("sync:full received", { roomId: state.roomId, phase: state.phase });
			this.currentRoomId = state.roomId;
			this.setGameState(state);
		});

		this.socket.on("state:patch", (data: StatePatchPayload) => {
			if (!this.gameState) return;
			this.applyPatches(data.patches);
			this.setGameState(this.gameState);
		});
	}

	private applyPatches(patches: StatePatch[]): void {
		if (!this.gameState) return;

		for (const patch of patches) {
			if (patch.path.length === 0) continue;
			const [root, ...rest] = patch.path;

			if (root === "tokens") {
				if (rest.length === 0 && patch.op === "add" && patch.value) {
					this.gameState.tokens[(patch.value as CombatToken).$id] = patch.value as CombatToken;
				} else if (rest.length >= 1) {
					const id = String(rest[0]);
					if (patch.op === "remove") delete this.gameState.tokens[id];
					else if (rest.length === 1) this.gameState.tokens[id] = patch.value as CombatToken;
					else if (this.gameState.tokens[id]) this.patchObject(this.gameState.tokens[id], rest.slice(1), patch);
				}
			} else if (root === "players") {
				if (rest.length === 0 && patch.op === "add" && patch.value) {
					this.gameState.players[(patch.value as any).sessionId] = patch.value as any;
				} else if (rest.length >= 1) {
					const id = String(rest[0]);
					if (patch.op === "remove") delete this.gameState.players[id];
					else if (this.gameState.players[id]) this.patchObject(this.gameState.players[id], rest.slice(1), patch);
				}
			} else if (root === "phase" && patch.op === "replace") {
				this.gameState.phase = patch.value as any;
			} else if (root === "turnCount" && patch.op === "replace") {
				this.gameState.turnCount = patch.value as number;
			} else if (root === "activeFaction" && patch.op === "replace") {
				this.gameState.activeFaction = patch.value as any;
			}
		}
	}

	private patchObject(obj: any, path: (string | number)[], patch: StatePatch): void {
		if (path.length === 0) return;
		const [key, ...rest] = path;
		if (rest.length === 0) {
			if (patch.op === "remove") delete obj[key];
			else obj[key] = patch.value;
		} else {
			if (!obj[key]) obj[key] = {};
			this.patchObject(obj[key], rest, patch);
		}
	}
}

export type { RoomInfo };