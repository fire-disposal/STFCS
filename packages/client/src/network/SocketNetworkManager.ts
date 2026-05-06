/**
 * SocketNetworkManager - Socket.IO 连接管理
 *
 * 设计原则：
 * 1. 状态驱动：gameState 变化自动触发 React 更新
 * 2. 房间流程：create 仅创建；join 返回状态快照并可回退 sync:request_full
 * 3. 利用 Zustand：前端 hooks 直接订阅 gameState
 * 4. Mutative 不可变：state:patch 通过 produce() 包裹生成新引用，确保 Zustand 检测到变化
 */

import { io, Socket } from "socket.io-client";
import { apply as applyMutativePatches } from "mutative";
import type {
	WsEventName,
	WsPayload,
	WsResponseData,
	WsResponse,
	RoomInfo,
	CombatToken,
	WeaponJSON,
	GameRoomState,
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
	private pendingRequests: Map<
		string,
		{
			resolve: (value: unknown) => void;
			reject: (reason: Error) => void;
			timeout: ReturnType<typeof setTimeout>;
		}
	> = new Map();
	private stateListeners: Set<StateChangeListener> = new Set();

	constructor(serverUrl: string) {
		this.serverUrl = serverUrl;
	}

	async connect(): Promise<boolean> {
		if (this.socket?.connected) return true;

		this.socket = io(this.serverUrl, {
			transports: ["websocket"],
			reconnection: true,
			reconnectionAttempts: 15,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 30000,
			randomizationFactor: 0.5,
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

	async getProfile(): Promise<{
		success: boolean;
		profile?: { nickname: string; avatar: string | null };
		error?: string;
	}> {
		try {
			const data = await this.request("profile:get", {});
			return { success: true, profile: data.profile };
		} catch (error) {
			return { success: false, error: error instanceof Error ? error.message : "Failed" };
		}
	}

	async updateProfile(profile: { nickname?: string; avatar?: string }): Promise<{
		success: boolean;
		profile?: { nickname: string; avatar: string | null };
		error?: string;
	}> {
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
			const data = await this.request("room:create", {
				name: options.roomName,
				maxPlayers: options.maxPlayers ?? 4,
			});
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

	async logout(): Promise<void> {
		try {
			await this.request("auth:logout", {});
		} catch {
			// 忽略超时等错误，本地清理优先
		}
		this.playerId = null;
		this.playerName = null;
		this.currentRoomId = null;
		this.setGameState(null);
	}

	async leaveRoom(): Promise<void> {
		if (!this.currentRoomId) return;
		try {
			await this.request("room:leave", {});
		} catch {
			/* ignore */
		}
		this.currentRoomId = null;
		this.setGameState(null);
	}

	async setReady(): Promise<void> {
		try {
			await this.request("room:action", { action: "ready" });
		} catch {
			/* ignore */
		}
	}

	async startGame(): Promise<void> {
		try {
			await this.request("room:action", { action: "start" });
		} catch {
			/* ignore */
		}
	}

	async kickPlayer(targetId: string): Promise<void> {
		try {
			await this.request("room:action", { action: "kick", targetId });
		} catch {
			/* ignore */
		}
	}

	async transferHost(targetId: string): Promise<void> {
		try {
			await this.request("room:action", { action: "transfer_host", targetId });
		} catch {
			/* ignore */
		}
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

	buildInviteLink(roomId: string): string {
		return `${window.location.origin}/join/${roomId}`;
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
	getGameState(): GameRoomState | null {
		return this.gameState;
	}
	getSocket(): Socket | null {
		return this.socket;
	}
	isConnected(): boolean {
		return this.socket?.connected ?? false;
	}

	subscribeState(listener: StateChangeListener): () => void {
		this.stateListeners.add(listener);
		return () => this.stateListeners.delete(listener);
	}

	disconnect(): void {
		if (this.socket) {
			this.pendingRequests.forEach((p) => {
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
		this.stateListeners.forEach((listener) => listener(state));
	}

	private wasInRoom = false;
	private lastRoomId: string | null = null;

	private setupEventHandlers(): void {
		if (!this.socket) return;

		this.socket.on("disconnect", () => {
			logger.warn("Disconnected from server");
			this.wasInRoom = this.currentRoomId !== null;
			this.lastRoomId = this.currentRoomId;
			this.notifyDisconnect();
		});

		this.socket.io.on("reconnect_attempt", (attempt) => {
			logger.info("Reconnect attempt", { attempt });
			this.notifyReconnecting(attempt);
		});

		this.socket.io.on("reconnect", async (attempt) => {
			logger.info("Reconnected", { attempt });
			this.notifyReconnected();
			if (this.wasInRoom && this.lastRoomId) {
				await this.attemptRejoinRoom();
			}
		});

		this.socket.io.on("reconnect_failed", () => {
			logger.error("Reconnect failed");
			this.notifyReconnectFailed();
			this.wasInRoom = false;
			this.lastRoomId = null;
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
			logger.info("sync:full received", { roomId: state.roomId, mode: state.mode });
			this.currentRoomId = state.roomId;
			this.setGameState(state);
		});

		this.socket.on("state:patch", (data: StatePatchPayload) => {
			if (!this.gameState) return;
			// 使用 Mutative 的 apply() 应用 patches 并产生新引用
			// 替代自定义 applyPatchesToDraft — 与服务端 patch 生成使用同一库
			// patches 来自服务端 Mutative.create() 生成，格式与 mutative.apply() 兼容
			// 唯一差异：Mutative.Patch.path 允许 string，但服务端始终发送 (string|number)[]
			// 运行时安全，as any 消除类型不匹配
			const nextState = applyMutativePatches(this.gameState, data.patches as any);
			this.setGameState(nextState);
		});
	}

	private async attemptRejoinRoom(): Promise<void> {
		if (!this.lastRoomId) return;
		try {
			const data = await this.request("room:rejoin", { roomId: this.lastRoomId });
			if (data.success && data.state) {
				this.currentRoomId = this.lastRoomId;
				this.setGameState(data.state);
				logger.info("Rejoined room successfully", { roomId: this.lastRoomId });
			}
		} catch (e) {
			logger.error("Failed to rejoin room", { error: e });
			this.wasInRoom = false;
			this.lastRoomId = null;
		}
	}

	private notifyDisconnect(): void {
		this.emitGlobalNotification("warning", "连接断开，正在重连...");
	}

	private notifyReconnecting(attempt: number): void {
		this.emitGlobalNotification("info", `重连中... (${attempt}/15)`);
	}

	private notifyReconnected(): void {
		this.emitGlobalNotification("success", "已重新连接");
	}

	private notifyReconnectFailed(): void {
		this.emitGlobalNotification("error", "重连失败，请刷新页面");
	}

	private emitGlobalNotification(
		type: "success" | "error" | "warning" | "info",
		message: string
	): void {
		window.dispatchEvent(
			new CustomEvent("stfcs-notification", {
				detail: { type, message, duration: 3000 },
			})
		);
	}
}

export type { RoomInfo };
