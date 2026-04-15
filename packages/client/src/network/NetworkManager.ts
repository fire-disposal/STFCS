/**
 * 网络管理器
 *
 * 纯 WebSocket 版本：
 * - 所有通信通过 WebSocket
 * - 房间列表通过 SystemService 获取
 * - 存档管理通过 SaveService 处理
 * - 用户管理通过 UserService 处理
 */

import { userService } from "@/services/UserService";
import { Client, Room } from "@colyseus/sdk";
import type { GameRoomState } from "@vt/types";

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
	private activeRoomOperation: Promise<Room<GameRoomState>> | null = null;
	private roomLeaveOperation: Promise<void> | null = null;
	private static readonly ROOM_OPERATION_TIMEOUT_MS = 12000;

	constructor(serverUrl: string) {
		this.serverUrl = serverUrl;
		this.client = new Client(serverUrl);
	}

	// ==================== 房间操作 ====================

	/**
	 * 创建房间
	 *
	 * 直接通过 WebSocket 创建，后端会进行权威验证
	 */
	async createRoom(
		options: { roomName?: string; maxPlayers?: number } = {}
	): Promise<Room<GameRoomState>> {
		if (this.activeRoomOperation) {
			return this.activeRoomOperation;
		}

		const profile = userService.getProfile();
		const shortId = userService.getShortId();
		const userName = userService.getUserName();

		console.log("[NetworkManager] Creating room...", {
			options,
			profile,
			shortId,
		});

		this.activeRoomOperation = (async () => {
			// 等待前一个房间完全离开后再创建新房间
			await this.leaveCurrentRoomIfNeeded();

			// 确保有默认值
			const createOptions = {
				playerName: userName || undefined,
				shortId: shortId || undefined,
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

		const profile = userService.getProfile();
		const shortId = userService.getShortId();
		const userName = userService.getUserName();

		console.log("[NetworkManager] Joining room:", roomId, { profile, shortId });

		this.activeRoomOperation = (async () => {
			// 等待前一个房间完全离开后再加入新房间
			await this.leaveCurrentRoomIfNeeded();

			const joinOptions = {
				playerName: userName || undefined,
				shortId: shortId || undefined,
			};

			const room = await this.withRoomOperationTimeout(
				this.client.joinById<GameRoomState>(roomId, joinOptions),
				"加入房间"
			);

			console.log("[NetworkManager] Joined room:", room.roomId);

			if (!room?.roomId) {
				throw new Error("服务器返回无效的房间对象");
			}

			this.bindRoomLifecycle(room);
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
	 */
	async leaveRoom(): Promise<void> {
		if (!this.currentRoom) {
			console.log("[NetworkManager] leaveRoom: no current room");
			return;
		}

		console.log("[NetworkManager] leaveRoom: leaving", this.currentRoom.roomId);
		try {
			await this.currentRoom.leave();
			console.log("[NetworkManager] leaveRoom: completed");
		} catch (error) {
			console.warn("[NetworkManager] leaveRoom: error:", error);
		}
	}

	/**
	 * 删除房间 - 通过 WebSocket 消息
	 *
	 * 房主发送 ROOM_DISSOLVE 消息，服务器验证后断开房间
	 */
	async deleteRoom(): Promise<void> {
		if (!this.currentRoom) {
			throw new Error("当前没有房间");
		}

		// 发送 WS 消息，服务器会自动断开连接
		this.currentRoom.send("ROOM_DISSOLVE");

		// 等待 onLeave 触发 cleanup
		return new Promise((resolve) => {
			setTimeout(() => {
				// 确保清理状态
				this.currentRoom = null;
				resolve();
			}, 500);
		});
	}

	/**
	 * 清理房间状态
	 *
	 * 用于远程删除房间后清理本地状态
	 */
	clearRoomState(roomId: string): void {
		if (this.currentRoom?.roomId === roomId) {
			console.log("[NetworkManager] Clearing room state for:", roomId);
			this.currentRoom = null;
			this.roomLeaveOperation = null;
		}
	}

	/**
	 * 离开当前房间（如果需要）
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
				console.log("[NetworkManager] Calling room.leave()...");

				// 添加超时保护，防止房间已断开时卡住
				const leavePromise = roomToLeave.leave();
				const timeoutPromise = new Promise<void>((_, reject) => {
					setTimeout(() => {
						reject(new Error("离开房间超时"));
					}, 5000);
				});

				await Promise.race([leavePromise, timeoutPromise]);

				console.log("[NetworkManager] room.leave() completed");
			} catch (error) {
				console.warn("[NetworkManager] Failed to leave previous room:", error);
			} finally {
				// 清理状态（无论成功与否都清理）
				if (this.currentRoom === roomToLeave) {
					console.log("[NetworkManager] Clearing current room state");
					this.currentRoom = null;
				}
				this.roomLeaveOperation = null;
				console.log("[NetworkManager] Clearing roomLeaveOperation");
			}
		})();

		await this.roomLeaveOperation;
	}

	private bindRoomLifecycle(room: Room<GameRoomState>): void {
		this.currentRoom = room;
		console.log("[NetworkManager] Binding lifecycle to room:", room.roomId);

		// 消息处理
		room.onMessage("role", (payload: unknown) => {
			console.log("[NetworkManager] Role message received:", payload);
		});

		room.onMessage("identity", (payload: unknown) => {
			console.log("[NetworkManager] Identity message received:", payload);
		});

		// 监听业务错误消息（如：已拥有房间、房间已满等）
		room.onMessage("error", (payload: unknown) => {
			let message = "未知错误";
			if (payload && typeof payload === "object" && "message" in payload) {
				message = String((payload as Record<string, unknown>).message);
			} else if (typeof payload === "string") {
				message = payload;
			}

			console.log("[NetworkManager] Business error received:", message);

			// 派发自定义事件，App.tsx 监听后显示通知
			window.dispatchEvent(new CustomEvent("stfcs-room-error", { detail: message }));
		});

		// 发送玩家配置
		const profile = userService.getProfile();
		room.send("ROOM_UPDATE_PROFILE", profile);

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
	 * 获取当前房间 ID
	 */
	getCurrentRoomId(): string | null {
		return this.currentRoom?.roomId ?? null;
	}

	/**
	 * 获取玩家档案（从 UserService）
	 */
	getProfile(): { nickname: string; avatar: string } {
		return userService.getProfile();
	}

	/**
	 * 设置玩家档案（同步到 UserService）
	 */
	setProfile(profile: { nickname?: string; avatar?: string }): void {
		userService.setProfile(profile);
		// 如果在房间中，发送到服务器
		this.currentRoom?.send("ROOM_UPDATE_PROFILE", profile);
	}

	/**
	 * 获取玩家短 ID（从 UserService）
	 */
	getShortId(): number | null {
		return userService.getShortId();
	}

	/**
	 * 设置用户（委托给 UserService）
	 */
	setUser(username: string): void {
		userService.setUser(username);
	}

	/**
	 * 登出（委托给 UserService）
	 */
	logout(): void {
		userService.logout();
	}

	/**
	 * 清理资源
	 */
	dispose(): void {
		console.log("[NetworkManager] Disposing...");
		this.roomLeaveOperation = null;
		if (this.currentRoom) {
			console.log("[NetworkManager] Leaving current room during dispose");
			this.currentRoom.leave().catch(() => {});
			this.currentRoom = null;
		}
	}
}
