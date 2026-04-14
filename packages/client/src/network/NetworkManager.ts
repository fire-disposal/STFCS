/**
 * 网络管理器
 *
 * 优化版：
 * - 合理的 localStorage 使用
 * - 用户名独占性检查
 * - 防止玩家列表重复
 * - 优化的房间同步
 */

import { Client, Room } from "@colyseus/sdk";
import type { GameRoomState } from "@vt/types";

export interface RoomInfo {
	id: string;
	name: string;
	clients: number;
	maxClients: number;
	ownerId: string | null;
	ownerShortId: number | null;
	phase: string;
	isPrivate: boolean;
	metadata?: Record<string, unknown>;
}

export class NetworkManager {
	// localStorage 键名
	private static readonly STORAGE_KEYS = {
		USERNAME: "stfcs_username",
		SHORT_ID: "stfcs_short_id",
		NICKNAME: "stfcs_nickname",
		AVATAR: "stfcs_avatar",
		LAST_ROOM: "stfcs_last_room",
	} as const;

	private readonly serverUrl: string;
	private readonly httpBaseUrl: string;
	private client: Client;
	private currentRoom: Room<GameRoomState> | null = null;
	public userName: string | null = null;
	private profile = { nickname: "", avatar: "👤" };
	private shortId: number | null = null;
	private roomsCache: RoomInfo[] = [];
	private roomsListeners: Set<(rooms: RoomInfo[]) => void> = new Set();
	private activeRoomOperation: Promise<Room<GameRoomState>> | null = null;
	private roomLeaveOperation: Promise<void> | null = null;
	private roomsRequestInFlight: Promise<RoomInfo[]> | null = null;
	private roomsRequestAbortController: AbortController | null = null;
	private static readonly ROOM_OPERATION_TIMEOUT_MS = 12000;
	private hasVisibilityListener = false;
	private roomsInterval: number | null = null;

	constructor(serverUrl: string) {
		this.serverUrl = serverUrl;
		this.httpBaseUrl = this.toHttpBaseUrl(serverUrl);
		this.client = new Client(serverUrl);
	}

	// ==================== 用户相关 ====================

	/**
	 * 设置当前用户
	 */
	setUser(username: string): void {
		this.userName = username.trim() || "Player";
		localStorage.setItem(NetworkManager.STORAGE_KEYS.USERNAME, this.userName);

		// 生成或恢复 shortId
		this.shortId = this.restoreOrCreateShortId();
		localStorage.setItem(NetworkManager.STORAGE_KEYS.SHORT_ID, String(this.shortId));
		this.profile.nickname = localStorage.getItem(NetworkManager.STORAGE_KEYS.NICKNAME) || "";
		this.profile.avatar = localStorage.getItem(NetworkManager.STORAGE_KEYS.AVATAR) || "👤";

		console.log("[NetworkManager] User set:", this.userName, "ShortId:", this.shortId);
	}

	/**
	 * 从本地存储恢复用户名
	 */
	restoreUser(): boolean {
		const username = localStorage.getItem(NetworkManager.STORAGE_KEYS.USERNAME);
		if (username) {
			this.userName = username;
			this.shortId = this.restoreOrCreateShortId();
			this.profile.nickname = localStorage.getItem(NetworkManager.STORAGE_KEYS.NICKNAME) || "";
			this.profile.avatar = localStorage.getItem(NetworkManager.STORAGE_KEYS.AVATAR) || "👤";
			return true;
		}
		return false;
	}

	/**
	 * 登出 - 清除用户数据
	 */
	logout(): void {
		this.userName = null;
		localStorage.removeItem(NetworkManager.STORAGE_KEYS.USERNAME);

		if (this.currentRoom) {
			this.currentRoom.leave();
			this.currentRoom = null;
		}
	}

	/**
	 * 完全清除 - 清除所有本地数据
	 */
	clearAll(): void {
		this.userName = null;
		this.shortId = null;

		Object.values(NetworkManager.STORAGE_KEYS).forEach((key) => {
			localStorage.removeItem(key);
		});

		if (this.currentRoom) {
			this.currentRoom.leave();
			this.currentRoom = null;
		}
	}

	getUserName(): string | null {
		return this.userName;
	}

	getProfile(): { nickname: string; avatar: string } {
		return { ...this.profile };
	}

	setProfile(profile: { nickname?: string; avatar?: string }): void {
		this.profile = {
			nickname: String(profile.nickname || "")
				.trim()
				.slice(0, 24),
			avatar:
				String(profile.avatar || "👤")
					.trim()
					.slice(0, 4) || "👤",
		};
		localStorage.setItem(NetworkManager.STORAGE_KEYS.NICKNAME, this.profile.nickname);
		localStorage.setItem(NetworkManager.STORAGE_KEYS.AVATAR, this.profile.avatar);
		this.currentRoom?.send("ROOM_UPDATE_PROFILE", this.profile);
	}

	getShortId(): number | null {
		return this.shortId;
	}

	getCurrentRoomId(): string | null {
		return this.currentRoom?.roomId ?? null;
	}

	hasUser(): boolean {
		return this.userName !== null && this.userName.length > 0;
	}

	// ==================== ShortId 管理 ====================

	private restoreOrCreateShortId(): number {
		const stored = localStorage.getItem(NetworkManager.STORAGE_KEYS.SHORT_ID);
		const normalized = this.normalizeShortId(stored);
		if (normalized !== null) {
			return normalized;
		}
		return this.generateShortId();
	}

	private normalizeShortId(value: unknown): number | null {
		const num = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
		if (!Number.isInteger(num) || num < 100000 || num > 999999) {
			return null;
		}
		return num;
	}

	private generateShortId(): number {
		return Math.floor(100000 + Math.random() * 900000);
	}

	// ==================== 房间相关 ====================

	/**
	 * 获取房间列表
	 *
	 * 直接请求最新列表，不使用 HTTP 缓存
	 * 因为房间状态变化频繁，缓存意义不大
	 */
	async getRooms(): Promise<RoomInfo[]> {
		if (this.roomsRequestInFlight) {
			return this.roomsRequestInFlight;
		}

		this.roomsRequestAbortController = new AbortController();
		const currentController = this.roomsRequestAbortController;

		this.roomsRequestInFlight = (async () => {
			try {
				const response = await fetch(`${this.httpBaseUrl}/matchmake`, {
					signal: currentController.signal,
				});

				if (!response.ok) {
					throw new Error("Failed to fetch rooms");
				}

				const data = await response.json();
				const rooms = Array.isArray(data) ? data : [];
				const battleRooms = rooms
					.filter((r: Record<string, unknown>) => {
						const roomType = String(r.name || "");
						const metadata = (r.metadata as Record<string, unknown> | undefined) || {};
						const metadataRoomType = String(metadata.roomType || "");
						return roomType === "battle" || metadataRoomType === "battle";
					})
					.map((r: Record<string, unknown>) => {
						const roomId = String(r.roomId || "");
						const metadata = (r.metadata as Record<string, unknown> | undefined) || {};
						const displayName = String(metadata.name || `Room ${roomId.substring(0, 6)}`);
						const ownerShortId = this.normalizeShortId(metadata.ownerShortId);

						return {
							id: roomId,
							name: displayName,
							clients: Number(r.clients || 0),
							maxClients: Number(r.maxClients || metadata.maxPlayers || 8),
							ownerId: typeof metadata.ownerId === "string" ? metadata.ownerId : null,
							ownerShortId,
							phase: String(metadata.phase || "lobby"),
							isPrivate: Boolean(metadata.isPrivate),
							metadata,
						};
					})
					.filter((r: RoomInfo) => r.id.length > 0);

				this.roomsCache = battleRooms;
				this.notifyRoomsListeners();
				return battleRooms;
			} catch (error) {
				if (error instanceof DOMException && error.name === "AbortError") {
					return this.roomsCache;
				}

				console.error("[NetworkManager] Failed to get rooms:", error);
				return this.roomsCache;
			} finally {
				if (this.roomsRequestAbortController === currentController) {
					this.roomsRequestAbortController = null;
				}
				this.roomsRequestInFlight = null;
			}
		})();

		return this.roomsRequestInFlight;
	}

	/**
	 * 订阅房间列表更新
	 * 使用优化的轮询策略：
	 * - 标签页可见时轮询
	 * - 标签页隐藏时停止
	 * - 有监听器时启动
	 */
	subscribeRooms(listener: (rooms: RoomInfo[]) => void): () => void {
		const shouldStartPolling = this.roomsListeners.size === 0;

		this.roomsListeners.add(listener);
		listener(this.roomsCache);

		if (shouldStartPolling) {
			this.startRoomsPolling();
		}

		return () => {
			this.roomsListeners.delete(listener);

			if (this.roomsListeners.size === 0) {
				this.stopRoomsPolling();
			}
		};
	}

	/**
	 * 开始定期更新房间列表
	 *
	 * 固定 5 秒轮询一次，保持房间列表实时性
	 * 因为房间状态变化频繁，不适合使用复杂的缓存策略
	 */
	private startRoomsPolling(intervalMs: number = 5000): void {
		if (this.roomsInterval !== null) {
			return;
		}

		this.enableVisibilityListener();

		if (typeof document !== "undefined" && document.visibilityState !== "visible") {
			return;
		}

		this.roomsInterval = window.setInterval(() => {
			this.getRooms();
		}, intervalMs);
	}

	/**
	 * 停止定期更新房间列表
	 */
	private stopRoomsPolling(): void {
		if (this.roomsInterval !== null) {
			window.clearInterval(this.roomsInterval);
			this.roomsInterval = null;
		}
		this.disableVisibilityListener();
		this.roomsRequestAbortController?.abort();
	}

	private notifyRoomsListeners(): void {
		this.roomsListeners.forEach((listener) => listener(this.roomsCache));
	}

	private readonly handleVisibilityChange = (): void => {
		if (typeof document === "undefined") {
			return;
		}

		if (document.visibilityState === "visible") {
			this.startRoomsPolling();
			this.getRooms();
			return;
		}

		this.stopRoomsPolling();
	};

	private enableVisibilityListener(): void {
		if (this.hasVisibilityListener || typeof document === "undefined") {
			return;
		}

		document.addEventListener("visibilitychange", this.handleVisibilityChange);
		this.hasVisibilityListener = true;
	}

	private disableVisibilityListener(): void {
		if (!this.hasVisibilityListener || typeof document === "undefined") {
			return;
		}

		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
		this.hasVisibilityListener = false;
	}

	// ==================== 房间操作 ====================

	/**
	 * 创建房间
	 */
	async createRoom(
		options: { roomName?: string; maxPlayers?: number } = {}
	): Promise<Room<GameRoomState>> {
		if (this.activeRoomOperation) {
			return this.activeRoomOperation;
		}

		const playerName = this.getValidatedPlayerName();
		const shortId = this.getValidatedShortId();

		console.log("[NetworkManager] Creating room...", {
			playerName,
			shortId,
			serverUrl: this.serverUrl,
			options,
		});

		this.activeRoomOperation = (async () => {
			// 异步离开前一个房间，不阻塞创建流程
			this.leaveCurrentRoomIfNeeded().catch((e) => {
				console.warn("[NetworkManager] Failed to leave previous room during create:", e);
			});

			// 确保有默认值
			const createOptions = {
				playerName,
				shortId,
				roomName: options.roomName?.trim() || undefined,
				maxPlayers: options.maxPlayers || 8,
			};

			console.log("[NetworkManager] Calling client.create with:", createOptions);

			const room = await this.withRoomOperationTimeout(
				this.client.create<GameRoomState>("battle", createOptions),
				"创建房间"
			);

			console.log("[NetworkManager] Room created:", room?.roomId);

			if (!room?.roomId) {
				console.error("[NetworkManager] Server returned invalid room object:", room);
				throw new Error("服务器返回无效的房间对象");
			}

			this.bindRoomLifecycle(room);
			localStorage.setItem(NetworkManager.STORAGE_KEYS.LAST_ROOM, room.roomId);
			return room;
		})()
			.catch((error: unknown) => {
				console.error("[NetworkManager] Failed to create room:", error);

				// 提取详细的错误信息
				let errorMessage = "创建房间失败";
				if (error instanceof Error) {
					errorMessage = error.message;
				} else if (typeof error === "string") {
					errorMessage = error;
				}

				throw new Error(errorMessage);
			})
			.finally(() => {
				this.activeRoomOperation = null;
			});

		return this.activeRoomOperation;
	}

	/**
	 * 加入房间
	 */
	async joinRoom(roomId: string): Promise<Room<GameRoomState>> {
		if (this.activeRoomOperation) {
			return this.activeRoomOperation;
		}

		const playerName = this.getValidatedPlayerName();
		const shortId = this.getValidatedShortId();

		console.log("[NetworkManager] Joining room:", roomId, { playerName, shortId });

		this.activeRoomOperation = (async () => {
			// 异步离开前一个房间，不阻塞加入流程
			this.leaveCurrentRoomIfNeeded().catch((e) => {
				console.warn("[NetworkManager] Failed to leave previous room during join:", e);
			});

			const room = await this.withRoomOperationTimeout(
				this.client.joinById<GameRoomState>(roomId, { playerName, shortId }),
				"加入房间"
			);

			console.log("[NetworkManager] Joined room:", room.roomId);

			if (!room?.roomId) {
				throw new Error("服务器返回无效的房间对象");
			}

			this.bindRoomLifecycle(room);
			localStorage.setItem(NetworkManager.STORAGE_KEYS.LAST_ROOM, room.roomId);
			return room;
		})()
			.catch((error: unknown) => {
				console.error("[NetworkManager] Failed to join room:", error);

				// 提取详细的错误信息
				let errorMessage = "加入房间失败";
				if (error instanceof Error) {
					errorMessage = error.message;
				} else if (typeof error === "string") {
					errorMessage = error;
				}

				throw new Error(errorMessage);
			})
			.finally(() => {
				this.activeRoomOperation = null;
			});

		return this.activeRoomOperation;
	}

	/**
	 * 离开房间
	 *
	 * 调用此方法会：
	 * 1. 发送退出通知给服务器（退出码 1000，正常退出）
	 * 2. 清理本地状态
	 */
	async leaveRoom(): Promise<void> {
		if (!this.currentRoom) {
			console.log("[NetworkManager] leaveRoom: no current room");
			return;
		}

		console.log("[NetworkManager] leaveRoom: leaving", this.currentRoom.roomId);
		try {
			await this.currentRoom.leave(1000);
			console.log("[NetworkManager] leaveRoom: completed");
		} catch (error) {
			console.warn("[NetworkManager] leaveRoom: error:", error);
		}
	}

	async deleteRoom(roomId: string): Promise<void> {
		const shortId = this.getValidatedShortId();
		const response = await fetch(`${this.httpBaseUrl}/api/rooms/${encodeURIComponent(roomId)}`, {
			method: "DELETE",
			headers: {
				"Content-Type": "application/json",
				"x-short-id": String(shortId),
			},
		});

		if (!response.ok) {
			let message = "删除房间失败";
			try {
				const data = await response.json();
				if (typeof data?.message === "string" && data.message.trim()) {
					message = data.message;
				}
			} catch {
				// ignore
			}

			throw new Error(message);
		}

		if (this.currentRoom?.roomId === roomId) {
			this.currentRoom = null;
		}
		await this.getRooms();
	}

	/**
	 * 离开当前房间（如果需要）
	 *
	 * 注意：此方法设计为"尽力而为"，不会阻塞主要操作
	 * 因为服务器会处理多个客户端快速加入/离开的情况
	 */
	private async leaveCurrentRoomIfNeeded(): Promise<void> {
		if (this.roomLeaveOperation) {
			console.log("[NetworkManager] leaveCurrentRoomIfNeeded: already in progress");
			await this.roomLeaveOperation;
			return;
		}

		if (!this.currentRoom) {
			console.log("[NetworkManager] leaveCurrentRoomIfNeeded: no current room");
			return;
		}

		const roomToLeave = this.currentRoom;
		console.log("[NetworkManager] leaveCurrentRoomIfNeeded: leaving room", roomToLeave.roomId);

		this.roomLeaveOperation = (async () => {
			try {
				console.log("[NetworkManager] Calling room.leave(1000)...");

				// 传递 1000 表示正常退出，不触发重连
				// 不等待完成，因为服务器会异步处理
				roomToLeave.leave(1000).catch((e: unknown) => {
					console.warn("[NetworkManager] room.leave() error:", e);
				});

				// 等待短暂延迟确保服务器收到退出通知
				await new Promise((resolve) => setTimeout(resolve, 100));
				console.log("[NetworkManager] room.leave() sent");
			} catch (error) {
				console.warn("[NetworkManager] Failed to leave previous room:", error);
			} finally {
				// 立即清理状态，不等待服务器确认
				if (this.currentRoom === roomToLeave) {
					console.log("[NetworkManager] Clearing current room state");
					this.currentRoom = null;
				}
				this.roomLeaveOperation = null;
				console.log("[NetworkManager] Clearing roomLeaveOperation");
			}
		})();

		// 不等待完成，立即返回
		console.log("[NetworkManager] leaveCurrentRoomIfNeeded returning immediately");
	}

	private bindRoomLifecycle(room: Room<GameRoomState>): void {
		this.currentRoom = room;
		console.log("[NetworkManager] Binding lifecycle to room:", room.roomId);

		// 消息处理
		room.onMessage("role", (payload: unknown) => {
			console.log("[NetworkManager] Role message received:", payload);
		});

		room.onMessage("identity", (payload: unknown) => {
			if (!payload || typeof payload !== "object") return;
			const shortId = this.normalizeShortId((payload as Record<string, unknown>).shortId);
			if (shortId === null) return;
			this.shortId = shortId;
			localStorage.setItem(NetworkManager.STORAGE_KEYS.SHORT_ID, String(shortId));
			console.log("[NetworkManager] Identity synced from server, short id:", shortId);
		});

		// 发送玩家配置
		room.send("ROOM_UPDATE_PROFILE", this.profile);

		// 清理回调 - 统一处理
		const cleanup = () => {
			if (this.currentRoom === room) {
				console.log("[NetworkManager] Room cleanup:", room.roomId);
				this.currentRoom = null;
			}
		};

		room.onLeave(cleanup);
		room.onError(cleanup);
		room.onDrop(cleanup);
	}

	buildInviteLink(roomId: string): string {
		const url = new URL(window.location.href);
		url.searchParams.set("room", roomId);
		return url.toString();
	}

	private getValidatedPlayerName(): string {
		const playerName = this.userName?.trim();
		if (!playerName) {
			throw new Error("请先设置用户名");
		}
		return playerName;
	}

	private getValidatedShortId(): number {
		const normalized = this.normalizeShortId(this.shortId);
		if (normalized !== null) {
			this.shortId = normalized;
			localStorage.setItem(NetworkManager.STORAGE_KEYS.SHORT_ID, String(normalized));
			return normalized;
		}

		const generated = this.generateShortId();
		this.shortId = generated;
		localStorage.setItem(NetworkManager.STORAGE_KEYS.SHORT_ID, String(generated));
		return generated;
	}

	private toHttpBaseUrl(wsUrl: string): string {
		return wsUrl.replace("ws://", "http://").replace("wss://", "https://");
	}

	private async withRoomOperationTimeout<T>(operation: Promise<T>, actionName: string): Promise<T> {
		let timer: number | null = null;

		try {
			const timeoutPromise = new Promise<T>((_, reject) => {
				timer = window.setTimeout(() => {
					reject(new Error(`${actionName}超时，请检查服务器连接后重试`));
				}, NetworkManager.ROOM_OPERATION_TIMEOUT_MS);
			});

			return await Promise.race([operation, timeoutPromise]);
		} finally {
			if (timer !== null) {
				window.clearTimeout(timer);
			}
		}
	}

	/**
	 * 获取当前房间
	 */
	getCurrentRoom(): Room<GameRoomState> | null {
		return this.currentRoom;
	}

	/**
	 * 清理资源
	 */
	dispose(): void {
		console.log("[NetworkManager] Disposing...");
		this.stopRoomsPolling();
		this.roomsRequestAbortController?.abort();
		this.roomsRequestAbortController = null;
		this.roomsRequestInFlight = null;
		this.roomLeaveOperation = null;
		this.roomsListeners.clear();
		this.roomsCache = [];
		if (this.currentRoom) {
			console.log("[NetworkManager] Leaving current room during dispose");
			this.currentRoom.leave(1000).catch(() => {});
			this.currentRoom = null;
		}
	}
}
