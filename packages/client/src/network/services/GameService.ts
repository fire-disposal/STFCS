/**
 * 游戏服务
 * 
 * 提供游戏操作相关的网络功能，完全基于 @vt/data 中的权威定义
 * 使用 WebSocketClient 进行类型安全的通信
 */

import type {
    GameActionPayload,
    GameQueryPayload,
    TokenJSON,
    WeaponJSON,
} from "@vt/data";
import { WebSocketClient } from "../core/WebSocketClient.js";
import { StateSyncService, type GameState } from "../core/StateSyncService.js";

/**
 * 游戏服务配置
 */
export interface GameServiceConfig {
    enableStateSync?: boolean;
    stateSyncOptions?: {
        debounceMs?: number;
        batchChanges?: boolean;
        autoRequestFullSync?: boolean;
    };
}

/**
 * 游戏服务事件
 */
export enum GameServiceEvent {
    STATE_UPDATED = "state:updated",
    STATE_FULL_SYNC = "state:full_sync",
    TURN_CHANGED = "turn:changed",
    PHASE_CHANGED = "phase:changed",
    PLAYER_ACTION = "player:action",
    GAME_ERROR = "game:error",
}

/**
 * 移动参数
 */
export interface MoveParams {
    tokenId: string;
    forward: number;
    strafe: number;
}

/**
 * 旋转参数
 */
export interface RotateParams {
    tokenId: string;
    angle: number;
}

/**
 * 攻击参数
 */
export interface AttackParams {
    tokenId: string;
    allocations: Array<{
        mountId: string;
        targets: Array<{
            targetId: string;
            shots: number;
            quadrant?: number;
        }>;
    }>;
}

/**
 * 护盾参数
 */
export interface ShieldParams {
    tokenId: string;
    active: boolean;
}

/**
 * 游戏服务
 */
export class GameService {
    private client: WebSocketClient;
    private config: Required<GameServiceConfig>;
    private stateSyncService: StateSyncService | null = null;
    private eventHandlers = new Map<GameServiceEvent, Set<Function>>();

    constructor(client: WebSocketClient, config: GameServiceConfig = {}) {
        this.client = client;
        this.config = {
            enableStateSync: config.enableStateSync ?? true,
            stateSyncOptions: config.stateSyncOptions ?? {},
        };

        // 初始化状态同步服务
        if (this.config.enableStateSync) {
            this.stateSyncService = new StateSyncService(client, this.config.stateSyncOptions);

            // 设置状态同步监听器
            this.setupStateSyncHandlers();
        }
    }

    /**
     * 获取状态同步服务
     */
    getStateSyncService(): StateSyncService | null {
        return this.stateSyncService;
    }

    /**
     * 获取当前游戏状态
     */
    getState(): GameState | null {
        return this.stateSyncService?.getState() ?? null;
    }

    /**
     * 获取状态快照
     */
    getSnapshot(): GameState | null {
        return this.stateSyncService?.getSnapshot() ?? null;
    }

    /**
     * 移动令牌
     */
    async move(params: MoveParams): Promise<void> {
        const payload: GameActionPayload = {
            action: "move",
            tokenId: params.tokenId,
            forward: params.forward,
            strafe: params.strafe,
        };

        await this.client.request("game:action", payload);
        this.emit(GameServiceEvent.PLAYER_ACTION, { type: "move", ...params });
    }

    /**
     * 旋转令牌
     */
    async rotate(params: RotateParams): Promise<void> {
        const payload: GameActionPayload = {
            action: "rotate",
            tokenId: params.tokenId,
            angle: params.angle,
        };

        await this.client.request("game:action", payload);
        this.emit(GameServiceEvent.PLAYER_ACTION, { type: "rotate", ...params });
    }

    /**
     * 攻击
     */
    async attack(params: AttackParams): Promise<void> {
        const payload: GameActionPayload = {
            action: "attack",
            tokenId: params.tokenId,
            allocations: params.allocations,
        };

        await this.client.request("game:action", payload);
        this.emit(GameServiceEvent.PLAYER_ACTION, { type: "attack", ...params });
    }

    /**
     * 切换护盾
     */
    async shield(params: ShieldParams): Promise<void> {
        const payload: GameActionPayload = {
            action: "shield",
            tokenId: params.tokenId,
            active: params.active,
        };

        await this.client.request("game:action", payload);
        this.emit(GameServiceEvent.PLAYER_ACTION, { type: "shield", ...params });
    }

    /**
     * 排放通量
     */
    async vent(tokenId: string): Promise<void> {
        const payload: GameActionPayload = {
            action: "vent",
            tokenId,
        };

        await this.client.request("game:action", payload);
        this.emit(GameServiceEvent.PLAYER_ACTION, { type: "vent", tokenId });
    }

    /**
     * 结束回合
     */
    async endTurn(tokenId: string): Promise<void> {
        const payload: GameActionPayload = {
            action: "end_turn",
            tokenId,
        };

        await this.client.request("game:action", payload);
        this.emit(GameServiceEvent.PLAYER_ACTION, { type: "end_turn", tokenId });
    }

    /**
     * 推进阶段
     */
    async advancePhase(): Promise<void> {
        const payload: GameActionPayload = {
            action: "advance_phase",
            tokenId: "", // 需要令牌ID，但实际可能不需要
        };

        await this.client.request("game:action", payload);
        this.emit(GameServiceEvent.PLAYER_ACTION, { type: "advance_phase" });
    }

    /**
     * 查询游戏信息
     */
    async query<T = any>(type: "targets" | "movement" | "ownership" | "combat_state", tokenId: string): Promise<T> {
        const payload: GameQueryPayload = {
            type,
            tokenId,
        };

        return await this.client.request<T>("game:query", payload);
    }

    /**
     * 查询目标
     */
    async queryTargets(tokenId: string): Promise<any> {
        return this.query("targets", tokenId);
    }

    /**
     * 查询移动范围
     */
    async queryMovement(tokenId: string): Promise<any> {
        return this.query("movement", tokenId);
    }

    /**
     * 查询所有权
     */
    async queryOwnership(tokenId: string): Promise<any> {
        return this.query("ownership", tokenId);
    }

    /**
     * 查询战斗状态
     */
    async queryCombatState(tokenId: string): Promise<any> {
        return this.query("combat_state", tokenId);
    }

    /**
     * 请求全量同步
     */
    async requestFullSync(): Promise<void> {
        if (this.stateSyncService) {
            await this.stateSyncService.requestFullSync();
        }
    }

    /**
     * 添加状态变更监听器
     */
    addStateChangeListener(listener: (changes: any[], newState: GameState) => void): () => void {
        if (!this.stateSyncService) {
            return () => { };
        }

        return this.stateSyncService.addChangeListener(listener);
    }

    /**
     * 添加全量同步监听器
     */
    addFullSyncListener(listener: (state: GameState) => void): () => void {
        if (!this.stateSyncService) {
            return () => { };
        }

        return this.stateSyncService.addFullSyncListener(listener);
    }

    /**
     * 设置状态同步处理器
     */
    private setupStateSyncHandlers(): void {
        if (!this.stateSyncService) {
            return;
        }

        // 监听增量更新
        this.stateSyncService.addChangeListener((changes, newState) => {
            this.emit(GameServiceEvent.STATE_UPDATED, { changes, newState });

            // 检查是否有回合变更
            const turnChange = changes.find(change => change.type === "turn_change");
            if (turnChange) {
                this.emit(GameServiceEvent.TURN_CHANGED, { turn: turnChange.value });
            }

            // 检查是否有阶段变更
            const phaseChange = changes.find(change => change.type === "phase_change");
            if (phaseChange) {
                this.emit(GameServiceEvent.PHASE_CHANGED, { phase: phaseChange.value });
            }
        });

        // 监听全量同步
        this.stateSyncService.addFullSyncListener((state) => {
            this.emit(GameServiceEvent.STATE_FULL_SYNC, state);
        });
    }

    /**
     * 添加事件监听器
     */
    on<T = any>(event: GameServiceEvent, handler: (data: T) => void): () => void {
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
    private emit<T = any>(event: GameServiceEvent, data: T): void {
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
        // 清除事件处理器
        this.eventHandlers.clear();

        // 销毁状态同步服务
        if (this.stateSyncService) {
            // 注意：StateSyncService 目前没有 destroy 方法，但可以重置状态
            this.stateSyncService.reset();
        }
    }
}

/**
 * 创建游戏服务实例
 */
export function createGameService(client: WebSocketClient, config?: GameServiceConfig): GameService {
    return new GameService(client, config);
}