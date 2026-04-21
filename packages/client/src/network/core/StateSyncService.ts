/**
 * 状态同步服务
 * 
 * 处理游戏状态的增量更新，完全使用 @vt/data 中的 delta 函数
 * 提供类型安全的状态管理和变更应用
 */

import type {
    DeltaChange,
    SyncDeltaPayload,
    TokenJSON,
    WeaponJSON,
    RoomInfo,
} from "@vt/data";
import {
    deltaPlayerJoin,
    deltaPlayerLeave,
} from "@vt/data";
import { WebSocketClient, WebSocketEvent } from "./WebSocketClient.js";

/**
 * 游戏状态接口
 */
export interface GameState {
    phase?: string;
    currentPhase?: string;
    turn?: number;
    turnCount?: number;
    activeFaction?: string;
    tokens: Record<string, TokenJSON>;
    weapons: Record<string, WeaponJSON>;
    players: Record<string, any>;
    modifiers: Record<string, number>;
    room?: RoomInfo;
}

/**
 * 状态变更监听器
 */
export type StateChangeListener = (changes: DeltaChange[], newState: GameState) => void;

/**
 * 全量同步监听器
 */
export type FullSyncListener = (state: GameState) => void;

/**
 * 状态同步选项
 */
export interface StateSyncOptions {
    debounceMs?: number; // 防抖时间（毫秒）
    batchChanges?: boolean; // 是否批量处理变更
    maxBatchSize?: number; // 最大批量大小
    autoRequestFullSync?: boolean; // 是否自动请求全量同步
}

/**
 * 状态同步服务
 */
export class StateSyncService {
    private client: WebSocketClient;
    private currentState: GameState = {
        tokens: {},
        weapons: {},
        players: {},
        modifiers: {},
    };
    private changeListeners = new Set<StateChangeListener>();
    private fullSyncListeners = new Set<FullSyncListener>();
    private pendingChanges: DeltaChange[] = [];
    private options: Required<StateSyncOptions>;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private isApplyingChanges = false;

    constructor(client: WebSocketClient, options: StateSyncOptions = {}) {
        this.client = client;
        this.options = {
            debounceMs: options.debounceMs ?? 50,
            batchChanges: options.batchChanges ?? true,
            maxBatchSize: options.maxBatchSize ?? 100,
            autoRequestFullSync: options.autoRequestFullSync ?? true,
        };

        this.setupEventHandlers();
    }

    /**
     * 获取当前状态
     */
    getState(): GameState {
        return { ...this.currentState };
    }

    /**
     * 获取状态快照（深拷贝）
     */
    getSnapshot(): GameState {
        return JSON.parse(JSON.stringify(this.currentState));
    }

    /**
     * 获取特定令牌
     */
    getToken(tokenId: string): TokenJSON | undefined {
        return this.currentState.tokens[tokenId];
    }

    /**
     * 获取特定武器
     */
    getWeapon(weaponId: string): WeaponJSON | undefined {
        return this.currentState.weapons[weaponId];
    }

    /**
     * 获取特定玩家
     */
    getPlayer(playerId: string): any | undefined {
        return this.currentState.players[playerId];
    }

    /**
     * 获取所有令牌
     */
    getTokens(): TokenJSON[] {
        return Object.values(this.currentState.tokens);
    }

    /**
     * 获取所有武器
     */
    getWeapons(): WeaponJSON[] {
        return Object.values(this.currentState.weapons);
    }

    /**
     * 获取所有玩家
     */
    getPlayers(): any[] {
        return Object.values(this.currentState.players);
    }

    /**
     * 添加状态变更监听器
     */
    addChangeListener(listener: StateChangeListener): () => void {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }

    /**
     * 添加全量同步监听器
     */
    addFullSyncListener(listener: FullSyncListener): () => void {
        this.fullSyncListeners.add(listener);
        return () => {
            this.fullSyncListeners.delete(listener);
        };
    }

    /**
     * 请求全量同步
     */
    async requestFullSync(): Promise<void> {
        try {
            const response = await this.client.request("sync:request_full", {});
            if (response && typeof response === "object") {
                this.applyFullSync(response);
            }
        } catch (error) {
            console.error("Failed to request full sync:", error);
        }
    }

    /**
     * 手动应用变更
     */
    applyChanges(changes: DeltaChange[]): void {
        if (this.options.batchChanges) {
            this.pendingChanges.push(...changes);
            this.scheduleApplyChanges();
        } else {
            this.applyChangesImmediately(changes);
        }
    }

    /**
     * 重置状态
     */
    reset(): void {
        this.currentState = {
            tokens: {},
            weapons: {},
            players: {},
            modifiers: {},
        };
        this.pendingChanges = [];

        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    /**
     * 私有方法：设置事件处理器
     */
    private setupEventHandlers(): void {
        // 监听全量同步事件
        this.client.subscribe("sync:full", (state: any) => {
            this.applyFullSync(state);
        });

        // 监听增量同步事件
        this.client.subscribe("sync:delta", (delta: SyncDeltaPayload) => {
            this.applyChanges(delta.changes);
        });

        // 监听玩家加入事件
        this.client.subscribe("player:joined", (data: any) => {
            const change = deltaPlayerJoin(data.playerId, data);
            this.applyChanges([change]);
        });

        // 监听玩家离开事件
        this.client.subscribe("player:left", (data: any) => {
            const change = deltaPlayerLeave(data.playerId);
            this.applyChanges([change]);
        });

        // 自动请求全量同步
        if (this.options.autoRequestFullSync) {
            this.client.on(WebSocketEvent.CONNECT, () => {
                this.requestFullSync();
            });
        }
    }

    /**
     * 私有方法：应用全量同步
     */
    private applyFullSync(state: any): void {
        // 重置当前状态
        this.currentState = {
            tokens: {},
            weapons: {},
            players: {},
            modifiers: {},
        };

        // 应用全量状态
        if (state.tokens && Array.isArray(state.tokens)) {
            state.tokens.forEach((token: TokenJSON) => {
                if (token.$id) {
                    this.currentState.tokens[token.$id] = token;
                }
            });
        }

        if (state.weapons && Array.isArray(state.weapons)) {
            state.weapons.forEach((weapon: WeaponJSON) => {
                if (weapon.$id) {
                    this.currentState.weapons[weapon.$id] = weapon;
                }
            });
        }

        if (state.players && typeof state.players === "object") {
            this.currentState.players = { ...state.players };
        }

        // 复制其他字段
        if (state.phase) this.currentState.phase = state.phase;
        if (state.currentPhase) this.currentState.currentPhase = state.currentPhase;
        if (state.turn !== undefined) this.currentState.turn = state.turn;
        if (state.turnCount !== undefined) this.currentState.turnCount = state.turnCount;
        if (state.activeFaction) this.currentState.activeFaction = state.activeFaction;
        if (state.room) this.currentState.room = state.room;

        // 通知全量同步监听器
        this.notifyFullSyncListeners(this.currentState);
    }

    /**
     * 私有方法：立即应用变更
     */
    private applyChangesImmediately(changes: DeltaChange[]): void {
        if (this.isApplyingChanges) {
            // 如果正在应用变更，将新变更加入待处理队列
            this.pendingChanges.push(...changes);
            return;
        }

        this.isApplyingChanges = true;

        try {
            const appliedChanges: DeltaChange[] = [];

            for (const change of changes) {
                if (this.applySingleChange(change)) {
                    appliedChanges.push(change);
                }
            }

            if (appliedChanges.length > 0) {
                this.notifyListeners(appliedChanges, this.currentState);
            }
        } finally {
            this.isApplyingChanges = false;

            // 检查是否有待处理的变更
            if (this.pendingChanges.length > 0) {
                const pending = [...this.pendingChanges];
                this.pendingChanges = [];
                this.applyChangesImmediately(pending);
            }
        }
    }

    /**
     * 私有方法：应用单个变更
     */
    private applySingleChange(change: DeltaChange): boolean {
        try {
            switch (change.type) {
                case "token_add":
                    if (change.id && change.value) {
                        this.currentState.tokens[change.id] = change.value as TokenJSON;
                        return true;
                    }
                    break;

                case "token_update":
                    if (change.id && change.field && change.value !== undefined) {
                        const token = this.currentState.tokens[change.id];
                        if (token) {
                            if (change.field === "runtime" && token.runtime) {
                                // 合并 runtime 对象
                                token.runtime = { ...token.runtime, ...change.value };
                            } else {
                                // 更新其他字段
                                (token as any)[change.field] = change.value;
                            }
                            return true;
                        }
                    }
                    break;

                case "token_remove":
                case "token_destroyed":
                    if (change.id && this.currentState.tokens[change.id]) {
                        delete this.currentState.tokens[change.id];
                        return true;
                    }
                    break;

                case "player_update":
                case "player_join":
                    if (change.id && change.value) {
                        this.currentState.players[change.id] = change.value;
                        return true;
                    }
                    break;

                case "player_leave":
                    if (change.id && this.currentState.players[change.id]) {
                        delete this.currentState.players[change.id];
                        return true;
                    }
                    break;

                case "phase_change":
                    if (change.value) {
                        this.currentState.phase = change.value as string;
                        this.currentState.currentPhase = change.value as string;
                        return true;
                    }
                    break;

                case "turn_change":
                    if (typeof change.value === "number") {
                        this.currentState.turn = change.value;
                        this.currentState.turnCount = change.value;
                        return true;
                    }
                    break;

                case "faction_turn":
                    if (change.value) {
                        this.currentState.activeFaction = change.value as string;
                        return true;
                    }
                    break;

                case "host_change":
                    if (change.value && this.currentState.room) {
                        this.currentState.room.ownerId = change.value as string;
                        return true;
                    }
                    break;

                case "modifier_add":
                    if (change.field && typeof change.value === "number") {
                        this.currentState.modifiers[change.field] = change.value;
                        return true;
                    }
                    break;

                case "modifier_remove":
                    if (change.field && this.currentState.modifiers[change.field]) {
                        delete this.currentState.modifiers[change.field];
                        return true;
                    }
                    break;

                default:
                    console.warn(`Unknown change type: ${change.type}`);
            }
        } catch (error) {
            console.error(`Error applying change ${change.type}:`, error, change);
        }

        return false;
    }

    /**
     * 私有方法：调度应用变更（防抖）
     */
    private scheduleApplyChanges(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(() => {
            if (this.pendingChanges.length > 0) {
                const changes = this.pendingChanges.slice(0, this.options.maxBatchSize);
                this.pendingChanges = this.pendingChanges.slice(this.options.maxBatchSize);
                this.applyChangesImmediately(changes);

                // 如果还有待处理变更，继续调度
                if (this.pendingChanges.length > 0) {
                    this.scheduleApplyChanges();
                }
            }
            this.debounceTimer = null;
        }, this.options.debounceMs);
    }

    /**
     * 私有方法：通知监听器
     */
    private notifyListeners(changes: DeltaChange[], newState: GameState): void {
        for (const listener of this.changeListeners) {
            try {
                listener(changes, newState);
            } catch (error) {
                console.error("Error in state change listener:", error);
            }
        }
    }

    /**
     * 私有方法：通知全量同步监听器
     */
    private notifyFullSyncListeners(state: GameState): void {
        for (const listener of this.fullSyncListeners) {
            try {
                listener(state);
            } catch (error) {
                console.error("Error in full sync listener:", error);
            }
        }
    }
}

/**
 * 状态选择器工具函数
 */
export function createStateSelector<T>(
    selector: (state: GameState) => T
): (state: GameState) => T {
    return selector;
}

/**
 * 常用的状态选择器
 */
export const StateSelectors = {
    // 选择所有令牌
    tokens: createStateSelector((state) => Object.values(state.tokens)),

    // 选择所有武器
    weapons: createStateSelector((state) => Object.values(state.weapons)),

    // 选择所有玩家
    players: createStateSelector((state) => Object.values(state.players)),

    // 选择当前阶段
    currentPhase: createStateSelector((state) => state.currentPhase),

    // 选择当前回合
    currentTurn: createStateSelector((state) => state.turn),

    // 选择活跃阵营
    activeFaction: createStateSelector((state) => state.activeFaction),

    // 选择房间信息
    roomInfo: createStateSelector((state) => state.room),

    // 选择特定令牌
    tokenById: (tokenId: string) =>
        createStateSelector((state) => state.tokens[tokenId]),

    // 选择特定武器
    weaponById: (weaponId: string) =>
        createStateSelector((state) => state.weapons[weaponId]),

    // 选择特定玩家
    playerById: (playerId: string) =>
        createStateSelector((state) => state.players[playerId]),
};