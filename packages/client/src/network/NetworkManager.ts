/**
 * 网络管理器
 *
 * 职责：
 * - WebSocket 连接管理
 * - 房间创建/加入/离开
 * - 连接状态维护
 * - 自动重连（轻量化）
 *
 * 重连策略：
 * - 断开后立即尝试重新加入（最多3次，每次间隔1秒）
 * - 使用之前的 roomId 和 playerName 尝试恢复
 * - 失败后由上层 UI 显示"重新加入"按钮
 */

import { Client, Room } from "@colyseus/sdk";
import type { GameRoomState } from "@/sync/types";
import { GameClient } from "@/sync/GameClient";

export interface RoomInfo {
	roomId: string;
	name: string;
	clients: number;
	maxClients: number;
	roomType: string;
	metadata: {
		roomType: string;
		name: string;
		phase: string;
		ownerId: string | null;
		ownerShortId: number | null;
		maxPlayers: number;
		isPrivate: boolean;
		createdAt: number;
		turnCount?: number;
	};
}

export class NetworkManager {
	private readonly serverUrl: string;
	private client: Client;
	private currentRoom: Room<GameRoomState> | null = null;
	private gameClient: GameClient | null = null;
	private activeRoomOperation: Promise<Room<GameRoomState>> | null = null;
	private roomLeaveOperation: Promise<void> | null = null;
	private playerShortId: number | null = null;
	private playerProfile: { nickname: string; avatar: string } | null = null;

	// 重连状态
	private lastRoomId: string | null = null;
	private lastPlayerName: string | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 3;
	private reconnectDelayMs = 1000;
	private isReconnecting = false;

	private static readonly ROOM_OPERATION_TIMEOUT_MS = 12000;

	constructor(serverUrl: string) {
		this.serverUrl = serverUrl;
		this.client = new Client(serverUrl);
	}

	// ==================== 房间操作 ====================

	/** 创建房间 */
	async createRoom(options: {
		playerName?: string;
		roomName?: string;
		maxPlayers?: number;
	}): Promise<Room<GameRoomState>> {
		if (this.activeRoomOperation) {
			return this.activeRoomOperation;
		}

		this.activeRoomOperation = (async () => {
			await this.leaveCurrentRoomIfNeeded();

			const createOptions = {
				playerName: options.playerName,
				roomName: options.roomName?.trim() || undefined,
				maxPlayers: options.maxPlayers || 8,
			};

			const room = await this.withRoomOperationTimeout(
				this.client.create<GameRoomState>("battle", createOptions),
				"创建房间"
			);

			if (!room?.roomId) {
				throw new Error("服务器返回无效的房间对象");
			}

			// 保存重连信息
			this.lastRoomId = room.roomId;
			this.lastPlayerName = options.playerName || null;

			this.bindRoomLifecycle(room);
			this.gameClient = new GameClient(room);
			return room;
		})()
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "创建房间失败";
				throw new Error(message);
			})
			.finally(() => {
				this.activeRoomOperation = null;
			});

		return this.activeRoomOperation;
	}

	/** 加入房间 */
	async joinRoom(roomId: string, options: { playerName?: string }): Promise<Room<GameRoomState>> {
		if (this.activeRoomOperation) {
			return this.activeRoomOperation;
		}

		this.activeRoomOperation = (async () => {
			await this.leaveCurrentRoomIfNeeded();

			const joinOptions = {
				playerName: options.playerName,
			};

			const room = await this.withRoomOperationTimeout(
				this.client.joinById<GameRoomState>(roomId, joinOptions),
				"加入房间"
			);

			if (!room?.roomId) {
				throw new Error("服务器返回无效的房间对象");
			}

			// 保存重连信息
			this.lastRoomId = room.roomId;
			this.lastPlayerName = options.playerName || null;

			this.bindRoomLifecycle(room);
			this.gameClient = new GameClient(room);
			return room;
		})()
			.catch((error: unknown) => {
				const message = error instanceof Error ? error.message : "加入房间失败";
				throw new Error(message);
			})
			.finally(() => {
				this.activeRoomOperation = null;
			});

		return this.activeRoomOperation;
	}

	/** 离开房间 */
	async leaveRoom(): Promise<void> {
		// 立即清除状态（避免返回大厅时状态不一致）
		this.lastRoomId = null;
		this.lastPlayerName = null;
		this.reconnectAttempts = 0;
		this.isReconnecting = false;
		this.playerShortId = null;

		// 保存引用后立即清除（onLeave 回调可能延迟触发）
		const room = this.currentRoom;
		this.currentRoom = null;
		this.gameClient = null;

		if (!room) return;

		try {
			await room.leave();
		} catch (error) {
			console.warn("[NetworkManager] leaveRoom error:", error);
		}
	}

	/** 尝试自动重连 */
	async attemptReconnect(): Promise<Room<GameRoomState> | null> {
		if (!this.lastRoomId || !this.lastPlayerName) {
			return null;
		}

		if (this.isReconnecting || this.activeRoomOperation) {
			return this.activeRoomOperation;
		}

		this.isReconnecting = true;
		this.reconnectAttempts++;

		console.log(`[NetworkManager] 尝试重连 (${this.reconnectAttempts}/${this.maxReconnectAttempts}) 房间 ${this.lastRoomId}`);

		try {
			const room = await this.joinRoom(this.lastRoomId, { playerName: this.lastPlayerName });
			console.log("[NetworkManager] 重连成功");
			this.reconnectAttempts = 0;
			this.isReconnecting = false;
			return room;
		} catch (error) {
			console.warn(`[NetworkManager] 重连失败:`, error);

			if (this.reconnectAttempts < this.maxReconnectAttempts) {
				// 延迟后再次尝试
				await new Promise(resolve => setTimeout(resolve, this.reconnectDelayMs));
				this.isReconnecting = false;
				return this.attemptReconnect();
			}

			// 重连失败
			this.isReconnecting = false;
			window.dispatchEvent(new CustomEvent("stfcs-reconnect-failed", {
				detail: { roomId: this.lastRoomId, playerName: this.lastPlayerName }
			}));
			return null;
		}
	}

	/** 获取重连状态 */
	getReconnectStatus(): { isReconnecting: boolean; attempts: number; canReconnect: boolean } {
		return {
			isReconnecting: this.isReconnecting,
			attempts: this.reconnectAttempts,
			canReconnect: !!this.lastRoomId && !!this.lastPlayerName,
		};
	}

	/** 清理房间状态 */
	clearRoomState(roomId: string): void {
		if (this.currentRoom?.roomId === roomId) {
			this.currentRoom = null;
			this.gameClient = null;
			this.roomLeaveOperation = null;
		}
	}

	// ==================== 私有方法 ====================

	private async leaveCurrentRoomIfNeeded(): Promise<void> {
		if (this.roomLeaveOperation) {
			await this.roomLeaveOperation;
			return;
		}

		if (!this.currentRoom) return;

		const roomToLeave = this.currentRoom;

		this.roomLeaveOperation = (async () => {
			try {
				const leavePromise = roomToLeave.leave();
				const timeoutPromise = new Promise<void>((_, reject) =>
					setTimeout(() => reject(new Error("离开房间超时")), 5000)
				);
				await Promise.race([leavePromise, timeoutPromise]);
			} catch (error) {
				console.warn("[NetworkManager] Failed to leave previous room:", error);
			} finally {
				if (this.currentRoom === roomToLeave) {
					this.currentRoom = null;
					this.gameClient = null;
				}
				this.roomLeaveOperation = null;
			}
		})();

		await this.roomLeaveOperation;
	}

	private bindRoomLifecycle(room: Room<GameRoomState>): void {
		this.currentRoom = room;

		// 监听 identity（后端分配 shortId）
		room.onMessage("identity", (payload: unknown) => {
			if (payload && typeof payload === "object" && "shortId" in payload) {
				this.playerShortId = Number((payload as Record<string, unknown>).shortId);
			}
		});

		// 监听 role（玩家角色分配）
		room.onMessage("role", (payload: unknown) => {
			if (payload && typeof payload === "object" && "role" in payload) {
				const role = String((payload as Record<string, unknown>).role);
				window.dispatchEvent(new CustomEvent("stfcs-role-assigned", { detail: role }));
			}
		});

		// 监听 ROOM_KICKED（被踢出通知）
		room.onMessage("ROOM_KICKED", (payload: unknown) => {
			const reason =
				payload && typeof payload === "object" && "reason" in payload
					? String((payload as Record<string, unknown>).reason)
					: "被移出房间";
			window.dispatchEvent(new CustomEvent("stfcs-room-kicked", { detail: reason }));
		});

		// 监听 phase_change（阶段切换广播）
		room.onMessage("phase_change", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const phase = "phase" in payload ? String((payload as Record<string, unknown>).phase) : "";
				const turnCount = "turnCount" in payload ? Number((payload as Record<string, unknown>).turnCount) : 0;
				window.dispatchEvent(new CustomEvent("stfcs-phase-change", { detail: { phase, turnCount } }));
			}
		});

		// 监听 game_saved（游戏保存成功）
		room.onMessage("game_saved", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const saveId = "saveId" in payload ? String((payload as Record<string, unknown>).saveId) : "";
				const saveName = "saveName" in payload ? String((payload as Record<string, unknown>).saveName) : "";
				window.dispatchEvent(new CustomEvent("stfcs-game-saved", { detail: { saveId, saveName } }));
			}
		});

		// 监听 game_loaded（游戏加载成功）
		room.onMessage("game_loaded", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const saveId = "saveId" in payload ? String((payload as Record<string, unknown>).saveId) : "";
				const saveName = "saveName" in payload ? String((payload as Record<string, unknown>).saveName) : "";
				window.dispatchEvent(new CustomEvent("stfcs-game-loaded", { detail: { saveId, saveName } }));
			}
		});
		// 监听 PROFILE_UPDATED（档案更新确认）
		room.onMessage("PROFILE_UPDATED", (payload: unknown) => {
			window.dispatchEvent(new CustomEvent("stfcs-profile-updated", { detail: payload }));
		});
		// 监听 PLAYER_AVATAR（头像数据，不通过 Schema 同步）
		room.onMessage("PLAYER_AVATAR", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const data = payload as { shortId: number; avatar: string };
				window.dispatchEvent(new CustomEvent("stfcs-player-avatar", { detail: data }));
			}
		});
		// 监听业务错误
		room.onMessage("error", (payload: unknown) => {
			const message =
				payload && typeof payload === "object" && "message" in payload
					? String((payload as Record<string, unknown>).message)
					: typeof payload === "string"
						? payload
						: "未知错误";
			window.dispatchEvent(new CustomEvent("stfcs-room-error", { detail: message }));
		});

		// 监听可攻击目标查询结果（单武器）
		room.onMessage("ATTACKABLE_TARGETS_RESULT", (payload: unknown) => {
			window.dispatchEvent(new CustomEvent("stfcs-attackable-targets", { detail: payload }));
		});

		// 监听批量可攻击目标查询结果（舰船选中时）
		room.onMessage("ALL_ATTACKABLE_TARGETS_RESULT", (payload: unknown) => {
			window.dispatchEvent(new CustomEvent("stfcs-all-attackable-targets", { detail: payload }));
		});

		// 监听连接断开 - 触发自动重连
		room.onLeave(() => {
			console.log("[NetworkManager] 房间连接断开，尝试自动重连");
			this.currentRoom = null;
			this.gameClient = null;

			// 静默自动重连
			this.attemptReconnect().catch(err => {
				console.warn("[NetworkManager] 自动重连异常:", err);
			});
		});

		room.onError((code, message) => {
			console.error("[NetworkManager] 房间错误:", code, message);
			if (this.currentRoom === room) {
				this.currentRoom = null;
				this.gameClient = null;
			}
		});

		room.onDrop(() => {
			console.warn("[NetworkManager] 房间连接被丢弃");
			if (this.currentRoom === room) {
				this.currentRoom = null;
				this.gameClient = null;
			}
		});
	}

	private async withRoomOperationTimeout<T>(
		operation: Promise<T>,
		actionName: string
	): Promise<T> {
		const timeoutPromise = new Promise<T>((_, reject) =>
			setTimeout(() => reject(new Error(`${actionName}超时`)), NetworkManager.ROOM_OPERATION_TIMEOUT_MS)
		);
		return Promise.race([operation, timeoutPromise]);
	}

	// ==================== 访问器 ====================

	getCurrentRoom(): Room<GameRoomState> | null {
		return this.currentRoom;
	}

	getCurrentRoomId(): string | null {
		return this.currentRoom?.roomId ?? null;
	}

	getGameClient(): GameClient | null {
		return this.gameClient;
	}

	getShortId(): number | null {
		return this.playerShortId;
	}

	getProfile(): { nickname: string; avatar: string } | null {
		return this.playerProfile;
	}

	setProfile(profile: { nickname: string; avatar: string }): void {
		this.playerProfile = profile;
	}

	buildInviteLink(roomId: string): string {
		const url = new URL(window.location.href);
		url.searchParams.set("room", roomId);
		return url.toString();
	}

	/** 清理资源 */
	dispose(): void {
		this.roomLeaveOperation = null;
		this.lastRoomId = null;
		this.lastPlayerName = null;
		this.isReconnecting = false;
		this.reconnectAttempts = 0;

		if (this.currentRoom) {
			this.currentRoom.leave().catch(() => {});
			this.currentRoom = null;
			this.gameClient = null;
		}
	}
}