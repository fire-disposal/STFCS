/**
 * 认证服务
 *
 * 提供用户认证相关的网络操作，完全基于 @vt/data 中的权威定义
 * 使用 WebSocketClient 进行类型安全的通信
 */

import type {
    AuthLoginPayload,
    AuthLoginResponse,
} from "@vt/data";
import { WebSocketClient, WebSocketEvent } from "../core/WebSocketClient.js";

/**
 * 认证服务配置
 */
export interface AuthServiceConfig {
    autoReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
}

/**
 * 认证服务
 */
export class AuthService {
    private client: WebSocketClient;
    private config: Required<AuthServiceConfig>;
    private currentPlayerId: string | null = null;
    private currentPlayerName: string | null = null;
    private disconnectUnsubscribe: (() => void) | null = null;
    private reconnectUnsubscribe: (() => void) | null = null;

    constructor(client: WebSocketClient, config: AuthServiceConfig = {}) {
        this.client = client;
        this.config = {
            autoReconnect: config.autoReconnect ?? true,
            reconnectDelay: config.reconnectDelay ?? 3000,
            maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
        };

        // 监听连接状态变化
        this.setupConnectionHandlers();
    }

    /**
     * 获取当前玩家ID
     */
    getPlayerId(): string | null {
        return this.currentPlayerId;
    }

    /**
     * 获取当前玩家名称
     */
    getPlayerName(): string | null {
        return this.currentPlayerName;
    }

    /**
     * 检查是否已认证
     */
    isAuthenticated(): boolean {
        return this.currentPlayerId !== null;
    }

    /**
     * 登录
     * @param playerName 玩家名称
     * @returns 认证响应
     */
    async login(playerName: string): Promise<AuthLoginResponse> {
        const payload: AuthLoginPayload = { playerName };

        try {
            const response = await this.client.request<AuthLoginResponse>("auth:login", payload);

            // 保存认证信息
            this.currentPlayerId = response.playerId;
            this.currentPlayerName = response.playerName;

            return response;
        } catch (error) {
            // 重置认证状态
            this.currentPlayerId = null;
            this.currentPlayerName = null;

            throw error;
        }
    }

    /**
     * 登出
     */
    async logout(): Promise<void> {
        if (!this.isAuthenticated()) {
            return;
        }

        try {
            await this.client.request("auth:logout", {});
        } catch (error) {
            console.warn("Logout request failed:", error);
        } finally {
            // 无论请求成功与否，都清除本地认证状态
            this.currentPlayerId = null;
            this.currentPlayerName = null;
        }
    }

    /**
     * 获取认证状态
     */
    async getAuthStatus(): Promise<{ authenticated: boolean; playerId?: string; playerName?: string }> {
        if (!this.isAuthenticated()) {
            return { authenticated: false };
        }

        return {
            authenticated: true,
            playerId: this.currentPlayerId!,
            playerName: this.currentPlayerName!,
        };
    }

    /**
     * 设置连接处理器
     */
    private setupConnectionHandlers(): void {
        // 连接断开时清除认证状态
        this.disconnectUnsubscribe = this.client.on(WebSocketEvent.DISCONNECT, () => {
            this.currentPlayerId = null;
            this.currentPlayerName = null;
        });

        // 重新连接时尝试重新认证（如果之前已认证）
        if (this.config.autoReconnect) {
            this.reconnectUnsubscribe = this.client.on(WebSocketEvent.RECONNECT, async () => {
                if (this.currentPlayerName) {
                    try {
                        await this.login(this.currentPlayerName);
                        console.log("Auto-reauthenticated after reconnect");
                    } catch (error) {
                        console.error("Failed to reauthenticate after reconnect:", error);
                    }
                }
            });
        }
    }

    /**
     * 销毁服务
     */
    destroy(): void {
        // 清除所有事件监听器
        if (this.disconnectUnsubscribe) {
            this.disconnectUnsubscribe();
            this.disconnectUnsubscribe = null;
        }

        if (this.reconnectUnsubscribe) {
            this.reconnectUnsubscribe();
            this.reconnectUnsubscribe = null;
        }

        // 清除认证状态
        this.currentPlayerId = null;
        this.currentPlayerName = null;
    }
}

/**
 * 创建认证服务实例
 */
export function createAuthService(client: WebSocketClient, config?: AuthServiceConfig): AuthService {
    return new AuthService(client, config);
}