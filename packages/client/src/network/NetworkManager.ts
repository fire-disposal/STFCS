/**
 * 网络管理器
 *
 * 职责：
 * - WebSocket 连接管理
 * - 房间创建/加入/离开
 * - 连接状态维护
 *
 * 注意：不支持自动重连，玩家离开后需手动重新加入房间
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

			// 保存重连信息（已禁用）
			// this.lastRoomId = room.roomId;
			// this.lastPlayerName = options.playerName || null;

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

			// 保存重连信息（已禁用）
			// this.lastRoomId = room.roomId;
			// this.lastPlayerName = options.playerName || null;

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
		// 立即清除状态
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

		// 监听玩家加入事件
		room.onMessage("player_joined", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const data = payload as { sessionId: string; shortId: number; name: string; role: string; isNew: boolean };
				window.dispatchEvent(new CustomEvent("stfcs-player-joined", { detail: data }));
			}
		});

		// 监听玩家离线事件
		room.onMessage("player_left", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const data = payload as { sessionId: string; shortId: number; name: string; role: string };
				window.dispatchEvent(new CustomEvent("stfcs-player-left", { detail: data }));
			}
		});

		// 监听房主离开事件（启动5分钟计时器）
		room.onMessage("owner_left", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const data = payload as { name: string; shortId: number; waitTimeSeconds: number };
				window.dispatchEvent(new CustomEvent("stfcs-owner-left", { detail: data }));
			}
		});

		// 监听房主重新加入事件
		room.onMessage("owner_rejoined", (payload: unknown) => {
			if (payload && typeof payload === "object") {
				const data = payload as { sessionId: string; shortId: number; name: string };
				window.dispatchEvent(new CustomEvent("stfcs-owner-rejoined", { detail: data }));
			}
		});

		// 监听房间解散事件（房主5分钟内未重新加入）
		room.onMessage("room_dissolved", (payload: unknown) => {
			const reason = payload && typeof payload === "object" && "reason" in payload
				? String((payload as Record<string, unknown>).reason)
				: "房间已解散";
			window.dispatchEvent(new CustomEvent("stfcs-room-dissolved", { detail: reason }));
			// 清理本地状态
			this.currentRoom = null;
			this.gameClient = null;
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

		// 监听连接断开（不支持自动重连）
		room.onLeave(() => {
			console.log("[NetworkManager] 房间连接断开");
			this.currentRoom = null;
			this.gameClient = null;
			// 广播断开事件，让UI层处理
			window.dispatchEvent(new CustomEvent("stfcs-room-left"));
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

		if (this.currentRoom) {
			this.currentRoom.leave().catch(() => {});
			this.currentRoom = null;
			this.gameClient = null;
		}
	}
}