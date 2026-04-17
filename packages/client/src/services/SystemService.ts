/**
 * 系统服务 - WebSocket 版本
 *
 * 通过 WebSocket 与 SystemRoom 通信，处理系统级操作：
 * - 获取房间列表（实时推送）
 * - 远程删除房间（房主可通过此服务删除自己创建的房间）
 * - 玩家档案更新（全局功能，与房间无关）
 */

import type { RoomInfo } from "@/network/NetworkManager";
import { Client, Room } from "@colyseus/sdk";

interface RoomListResponse {
	rooms: RoomInfo[];
}

interface RoomDeleteResponse {
	success: boolean;
	roomId?: string;
	error?: string;
}

interface ProfileUpdateResponse {
	success: boolean;
	nickname?: string;
	avatar?: string;
	error?: string;
}

interface ProfileGetResponse {
	success: boolean;
	nickname?: string;
	avatar?: string;
	error?: string;
}

interface SystemError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

export class SystemService {
	private client: Client;
	private systemRoom: Room | null = null;
	private messageHandlers = new Map<string, Set<(payload: unknown) => void>>();
	private connectPromise: Promise<void> | null = null;
	private roomsCache: RoomInfo[] = [];
	private roomsListeners: Set<(rooms: RoomInfo[]) => void> = new Set();

	constructor(client: Client) {
		this.client = client;
	}

	/**
	 * 连接到系统房间
	 */
	async connect(): Promise<void> {
		if (this.systemRoom) {
			return;
		}

		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = (async () => {
			try {
				this.systemRoom = await this.client.joinOrCreate("system");
				this.setupMessageHandlers();
				console.log("[SystemService] Connected to SystemRoom");
			} catch (error) {
				console.error("[SystemService] Failed to connect to SystemRoom:", error);
				throw error;
			} finally {
				this.connectPromise = null;
			}
		})();

		return this.connectPromise;
	}

	/**
	 * 设置消息处理器
	 */
	private setupMessageHandlers(): void {
		if (!this.systemRoom) return;

		const setupHandler = (type: string) => {
			this.systemRoom!.onMessage(type, (payload: unknown) => {
				if (type === "ROOM_LIST_RESPONSE") {
					// 更新缓存
					if (payload && typeof payload === "object" && "rooms" in payload) {
						this.roomsCache = (payload as RoomListResponse).rooms;
						// 通知所有监听器
						this.notifyRoomsListeners();
					}
				}
				if (type === "PROFILE_UPDATED") {
					// 触发全局事件（兼容 App.tsx 的事件监听）
					if (payload && typeof payload === "object") {
						window.dispatchEvent(new CustomEvent("stfcs-profile-updated", { detail: payload }));
					}
				}
				this.emit(type, payload);
			});
		};

		setupHandler("ROOM_LIST_RESPONSE");
		setupHandler("ROOM_DELETE_RESPONSE");
		setupHandler("PROFILE_UPDATE_RESPONSE");
		setupHandler("PROFILE_GET_RESPONSE");
		setupHandler("PROFILE_UPDATED");
		setupHandler("ERROR");
	}

	/**
	 * 获取房间列表
	 *
	 * SystemRoom 会定期推送房间列表，所以这里返回缓存的数据
	 */
	getRooms(): RoomInfo[] {
		return this.roomsCache;
	}

	/**
	 * 主动请求房间列表
	 */
	async requestRooms(): Promise<RoomInfo[]> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const timeoutMs = 10000;

			const handler = (payload: unknown) => {
				if (payload && typeof payload === "object" && "rooms" in payload) {
					resolve((payload as RoomListResponse).rooms);
				} else {
					reject(new Error("无效的房间列表"));
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as SystemError;
				reject(new Error(error.message || "获取房间列表失败"));
			};

			this.once("ROOM_LIST_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.systemRoom!.send("ROOM_LIST_REQUEST");

			setTimeout(() => {
				this.off("ROOM_LIST_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				if (!this.systemRoom) {
					reject(new Error("连接已断开"));
				}
			}, timeoutMs);
		});
	}

	/**
	 * 远程删除房间
	 *
	 * 房主可以通过此方法远程删除自己创建的房间，无需连接到房间
	 */
	async deleteRoom(roomId: string, ownerShortId: number): Promise<void> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const timeoutMs = 10000;

			const handler = (payload: unknown) => {
				const response = payload as RoomDeleteResponse;
				if (response.success) {
					resolve();
				} else {
					reject(new Error(response.error || "删除房间失败"));
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as SystemError;
				reject(new Error(error.message || "删除房间失败"));
			};

			this.once("ROOM_DELETE_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.systemRoom!.send("ROOM_DELETE_REQUEST", { roomId, ownerShortId });

			setTimeout(() => {
				this.off("ROOM_DELETE_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				if (!this.systemRoom) {
					reject(new Error("连接已断开"));
				}
			}, timeoutMs);
		});
	}

	/**
	 * 订阅房间列表更新
	 *
	 * SystemRoom 会定期推送房间列表，当房间状态变化时自动更新
	 */
	subscribeRooms(listener: (rooms: RoomInfo[]) => void): () => void {
		this.roomsListeners.add(listener);
		listener(this.roomsCache);

		return () => {
			this.roomsListeners.delete(listener);
		};
	}

	/**
	 * 更新玩家档案（全局功能，与房间无关）
	 *
	 * @param playerId 玩家标识（当前使用 nickname）
	 * @param profile 档案更新内容
	 * @returns 更新后的档案信息
	 */
	async updateProfile(
		playerId: string,
		profile: { nickname?: string; avatar?: string }
	): Promise<{ success: boolean; nickname: string; avatar: string }> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const timeoutMs = 10000;

			const handler = (payload: unknown) => {
				const response = payload as ProfileUpdateResponse;
				if (response.success) {
					resolve({
						success: true,
						nickname: response.nickname || "",
						avatar: response.avatar || "",
					});
				} else {
					reject(new Error(response.error || "更新档案失败"));
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as SystemError;
				reject(new Error(error.message || "更新档案失败"));
			};

			this.once("PROFILE_UPDATE_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.systemRoom!.send("PROFILE_UPDATE_REQUEST", { playerId, ...profile });

			setTimeout(() => {
				this.off("PROFILE_UPDATE_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				if (!this.systemRoom) {
					reject(new Error("连接已断开"));
				}
			}, timeoutMs);
		});
	}

	/**
	 * 获取玩家档案
	 *
	 * @param playerId 玩家标识
	 * @returns 档案信息
	 */
	async getProfile(playerId: string): Promise<{ nickname: string; avatar: string }> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const timeoutMs = 10000;

			const handler = (payload: unknown) => {
				const response = payload as ProfileGetResponse;
				if (response.success) {
					resolve({
						nickname: response.nickname || "",
						avatar: response.avatar || "",
					});
				} else {
					reject(new Error(response.error || "获取档案失败"));
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as SystemError;
				reject(new Error(error.message || "获取档案失败"));
			};

			this.once("PROFILE_GET_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.systemRoom!.send("PROFILE_GET_REQUEST", { playerId });

			setTimeout(() => {
				this.off("PROFILE_GET_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				if (!this.systemRoom) {
					reject(new Error("连接已断开"));
				}
			}, timeoutMs);
		});
	}

	/**
	 * 断开连接
	 */
	disconnect(): void {
		if (this.systemRoom) {
			this.systemRoom.leave();
			this.systemRoom = null;
			this.messageHandlers.clear();
			this.roomsCache = [];
			this.roomsListeners.clear();
			console.log("[SystemService] Disconnected from SystemRoom");
		}
	}

	/**
	 * 确保已连接
	 */
	private async ensureConnected(): Promise<void> {
		if (!this.systemRoom) {
			await this.connect();
		}
	}

	/**
	 * 通知所有房间列表监听器
	 */
	private notifyRoomsListeners(): void {
		this.roomsListeners.forEach((listener) => listener(this.roomsCache));
	}

	/**
	 * 事件发射器辅助方法
	 */
	private emit(type: string, payload: unknown): void {
		const handlers = this.messageHandlers.get(type);
		handlers?.forEach((h) => h(payload));
	}

	private once(type: string, handler: (payload: unknown) => void): void {
		const wrapped = (payload: unknown) => {
			handler(payload);
			this.off(type, wrapped);
		};
		this.on(type, wrapped);
	}

	private on(type: string, handler: (payload: unknown) => void): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, new Set());
		}
		this.messageHandlers.get(type)!.add(handler);
	}

	private off(type: string, handler: (payload: unknown) => void): void {
		this.messageHandlers.get(type)?.delete(handler);
	}
}
