/**
 * 房间服务
 * 
 * 提供房间管理相关的网络操作，完全基于 @vt/data 中的权威定义
 * 使用 WebSocketClient 进行类型安全的通信
 */

import type {
    RoomCreatePayload,
    RoomJoinPayload,
    RoomActionPayload,
    RoomInfo,
} from "@vt/data";
import { WebSocketClient } from "../core/WebSocketClient.js";

/**
 * 房间服务配置
 */
export interface RoomServiceConfig {
    autoRefreshRoomList?: boolean;
    refreshInterval?: number;
}

/**
 * 房间服务事件
 */
export enum RoomServiceEvent {
    ROOM_JOINED = "room:joined",
    ROOM_LEFT = "room:left",
    ROOM_UPDATED = "room:updated",
    PLAYER_JOINED = "player:joined",
    PLAYER_LEFT = "player:left",
    ROOM_LIST_UPDATED = "room:list:updated",
}

/**
 * 房间服务
 */
export class RoomService {
    private client: WebSocketClient;
    private config: Required<RoomServiceConfig>;
    private currentRoomId: string | null = null;
    private roomList: RoomInfo[] = [];
    private refreshTimer: ReturnType<typeof setInterval> | null = null;
    private eventHandlers = new Map<RoomServiceEvent, Set<Function>>();

    constructor(client: WebSocketClient, config: RoomServiceConfig = {}) {
        this.client = client;
        this.config = {
            autoRefreshRoomList: config.autoRefreshRoomList ?? true,
            refreshInterval: config.refreshInterval ?? 10000, // 10秒
        };

        // 设置事件处理器
        this.setupEventHandlers();

        // 自动刷新房间列表
        if (this.config.autoRefreshRoomList) {
            this.startRoomListRefresh();
        }
    }

    /**
     * 获取当前房间ID
     */
    getCurrentRoomId(): string | null {
        return this.currentRoomId;
    }

    /**
     * 检查是否在房间中
     */
    isInRoom(): boolean {
        return this.currentRoomId !== null;
    }

    /**
     * 获取房间列表
     */
    getRoomList(): RoomInfo[] {
        return [...this.roomList];
    }

    /**
     * 获取特定房间信息
     */
    getRoom(roomId: string): RoomInfo | undefined {
        return this.roomList.find(room => room.roomId === roomId);
    }

    /**
     * 获取当前房间信息
     */
    getCurrentRoom(): RoomInfo | undefined {
        if (!this.currentRoomId) {
            return undefined;
        }
        return this.getRoom(this.currentRoomId);
    }

    /**
     * 创建房间
     * @param name 房间名称
     * @param options 创建选项
     * @returns 房间信息
     */
    async createRoom(name: string, options?: {
        maxPlayers?: number;
        mapWidth?: number;
        mapHeight?: number;
    }): Promise<RoomInfo> {
        const payload: RoomCreatePayload = {
            name,
            maxPlayers: options?.maxPlayers,
            mapWidth: options?.mapWidth,
            mapHeight: options?.mapHeight,
        };

        const response = await this.client.request<RoomInfo>("room:create", payload);

        // 更新当前房间ID
        this.currentRoomId = response.roomId;

        // 触发房间加入事件
        this.emit(RoomServiceEvent.ROOM_JOINED, response);

        return response;
    }

    /**
     * 加入房间
     * @param roomId 房间ID
     * @returns 房间信息
     */
    async joinRoom(roomId: string): Promise<RoomInfo> {
        const payload: RoomJoinPayload = { roomId };

        const response = await this.client.request<RoomInfo>("room:join", payload);

        // 更新当前房间ID
        this.currentRoomId = response.roomId;

        // 触发房间加入事件
        this.emit(RoomServiceEvent.ROOM_JOINED, response);

        return response;
    }

    /**
     * 离开房间
     */
    async leaveRoom(): Promise<void> {
        if (!this.isInRoom()) {
            return;
        }

        const previousRoomId = this.currentRoomId;

        try {
            await this.client.request("room:leave", {});
        } finally {
            // 无论请求成功与否，都清除当前房间状态
            this.currentRoomId = null;

            // 触发房间离开事件
            if (previousRoomId) {
                this.emit(RoomServiceEvent.ROOM_LEFT, { roomId: previousRoomId });
            }
        }
    }

    /**
     * 获取房间列表
     */
    async fetchRoomList(): Promise<RoomInfo[]> {
        const response = await this.client.request<RoomInfo[]>("room:list", {});

        // 更新房间列表
        this.roomList = response;

        // 触发房间列表更新事件
        this.emit(RoomServiceEvent.ROOM_LIST_UPDATED, response);

        return response;
    }

    /**
     * 执行房间操作
     * @param action 操作类型
     * @param targetId 目标玩家ID（可选）
     */
    async performRoomAction(action: "ready" | "start" | "kick" | "transfer_host", targetId?: string): Promise<void> {
        const payload: RoomActionPayload = {
            action,
            targetId,
        };

        await this.client.request("room:action", payload);
    }

    /**
     * 设置事件处理器
     */
    private setupEventHandlers(): void {
        // 监听玩家加入事件
        this.client.subscribe("player:joined", (data: any) => {
            this.emit(RoomServiceEvent.PLAYER_JOINED, data);
        });

        // 监听玩家离开事件
        this.client.subscribe("player:left", (data: any) => {
            this.emit(RoomServiceEvent.PLAYER_LEFT, data);
        });

        // 监听房间更新事件
        this.client.subscribe("room:updated", (room: RoomInfo) => {
            // 更新房间列表中的房间信息
            const index = this.roomList.findIndex(r => r.roomId === room.roomId);
            if (index !== -1) {
                this.roomList[index] = room;
            }

            // 如果是当前房间，触发更新事件
            if (this.currentRoomId === room.roomId) {
                this.emit(RoomServiceEvent.ROOM_UPDATED, room);
            }
        });
    }

    /**
     * 开始自动刷新房间列表
     */
    private startRoomListRefresh(): void {
        // 立即获取一次房间列表
        this.fetchRoomList().catch(error => {
            console.error("Failed to fetch initial room list:", error);
        });

        // 设置定时刷新
        this.refreshTimer = setInterval(() => {
            this.fetchRoomList().catch(error => {
                console.error("Failed to refresh room list:", error);
            });
        }, this.config.refreshInterval);
    }

    /**
     * 停止自动刷新房间列表
     */
    private stopRoomListRefresh(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    /**
     * 添加事件监听器
     */
    on<T = any>(event: RoomServiceEvent, handler: (data: T) => void): () => void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }

        const handlers = this.eventHandlers.get(event)!;
        handlers.add(handler);

        return () => {
            handlers.delete(handler);
            if (handlers.size === 0) {
                this.eventHandlers.delete(event);
            }
        };
    }

    /**
     * 触发事件
     */
    private emit<T = any>(event: RoomServiceEvent, data: T): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in ${event} handler:`, error);
                }
            }
        }
    }

    /**
     * 销毁服务
     */
    destroy(): void {
        // 停止自动刷新
        this.stopRoomListRefresh();

        // 离开当前房间
        if (this.isInRoom()) {
            this.leaveRoom().catch(error => {
                console.error("Error leaving room during destroy:", error);
            });
        }

        // 清除事件处理器
        this.eventHandlers.clear();

        // 清除状态
        this.currentRoomId = null;
        this.roomList = [];
    }
}

/**
 * 创建房间服务实例
 */
export function createRoomService(client: WebSocketClient, config?: RoomServiceConfig): RoomService {
    return new RoomService(client, config);
}