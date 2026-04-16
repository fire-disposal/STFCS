/**
 * 网络管理器
 *
 * 职责：
 * - WebSocket 连接管理
 * - 房间创建/加入/离开
 * - 连接状态维护
 *
 * 不负责：
 * - 用户管理（由 UserService 处理）
 * - 命令发送（由 GameClient 处理）
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
		if (!this.currentRoom) return;

		try {
			await this.currentRoom.leave();
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

		// 清理回调
		const cleanup = () => {
			if (this.currentRoom === room) {
				this.currentRoom = null;
				this.gameClient = null;
			}
		};

		room.onLeave(cleanup);
		room.onError(cleanup);
		room.onDrop(cleanup);
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