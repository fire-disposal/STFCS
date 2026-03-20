/**
 * 回合阶段管理服务
 *
 * 管理回合制游戏流程：
 * - 阶段转换
 * - 回合结算
 * - 状态同步
 */

import type { FactionId } from '@vt/shared/types';
import type { GamePhase, TurnPhase, ShipActionState } from '@vt/shared/protocol';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';

/**
 * 回合结算结果
 */
export interface TurnResolutionResult {
  roundNumber: number;
  fluxDissipation: Array<{
    shipId: string;
    previousFlux: number;
    newFlux: number;
  }>;
  overloadResets: string[];
  ventCompletions: string[];
  events: TurnEvent[];
}

/**
 * 回合事件
 */
export interface TurnEvent {
  type: 'flux_dissipate' | 'overload_end' | 'vent_complete' | 'shield_maintenance' | 'cooldown';
  shipId: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/**
 * 回合阶段管理器配置
 */
export interface TurnPhaseManagerConfig {
  roomId: string;
  playerId: string;
  isDM: boolean;
  onPhaseChange?: (phase: TurnPhase) => void;
  onRoundChange?: (round: number) => void;
  onResolution?: (result: TurnResolutionResult) => void;
  onError?: (error: string) => void;
}

/**
 * 回合阶段管理器
 */
export class TurnPhaseManager {
  private config: TurnPhaseManagerConfig;
  private currentPhase: TurnPhase = 'player_action';
  private currentRound: number = 1;
  private currentFaction: FactionId | null = null;
  private shipActionStates: Record<string, ShipActionState> = {};
  private isProcessing: boolean = false;

  constructor(config: TurnPhaseManagerConfig) {
    this.config = config;
    this.setupWebSocketHandlers();
  }

  /**
   * 获取当前回合阶段
   */
  getCurrentPhase(): TurnPhase {
    return this.currentPhase;
  }

  /**
   * 获取当前回合数
   */
  getCurrentRound(): number {
    return this.currentRound;
  }

  /**
   * 获取当前行动阵营
   */
  getCurrentFaction(): FactionId | null {
    return this.currentFaction;
  }

  /**
   * 获取舰船行动状态
   */
  getShipActionStates(): Record<string, ShipActionState> {
    return { ...this.shipActionStates };
  }

  /**
   * 获取指定舰船的行动状态
   */
  getShipActionState(shipId: string): ShipActionState | undefined {
    return this.shipActionStates[shipId];
  }

  /**
   * 更新舰船行动状态
   */
  updateShipActionState(shipId: string, updates: Partial<ShipActionState>): void {
    if (this.shipActionStates[shipId]) {
      this.shipActionStates[shipId] = {
        ...this.shipActionStates[shipId],
        ...updates,
      };
    } else {
      this.shipActionStates[shipId] = {
        shipId,
        hasMoved: false,
        hasRotated: false,
        hasFired: false,
        hasToggledShield: false,
        hasVented: false,
        isOverloaded: false,
        overloadResetAvailable: false,
        remainingActions: 0,
        movementRemaining: 0,
        ...updates,
      };
    }
  }

  /**
   * 推进到下一阶段
   */
  async advancePhase(): Promise<void> {
    if (this.isProcessing) {
      throw new Error('正在处理中，请等待');
    }

    if (!this.config.isDM) {
      throw new Error('只有DM可以推进阶段');
    }

    this.isProcessing = true;

    try {
      await websocketService.sendRequest('game.advancePhase', {
        roomId: this.config.roomId,
        playerId: this.config.playerId,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 结束回合
   */
  async endTurn(): Promise<TurnResolutionResult> {
    if (this.isProcessing) {
      throw new Error('正在处理中，请等待');
    }

    this.isProcessing = true;

    try {
      const result = await websocketService.sendRequest('game.endTurn', {
        roomId: this.config.roomId,
        playerId: this.config.playerId,
      });

      const resolutionResult = result as TurnResolutionResult;
      this.handleResolution(resolutionResult);

      return resolutionResult;
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 结束玩家回合（玩家使用）
   */
  async endPlayerTurn(): Promise<void> {
    if (this.isProcessing) {
      throw new Error('正在处理中，请等待');
    }

    this.isProcessing = true;

    try {
      await websocketService.sendRequest('game.endPlayerTurn', {
        roomId: this.config.roomId,
        playerId: this.config.playerId,
        faction: this.currentFaction,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 解除过载
   */
  async resetOverload(shipId: string): Promise<void> {
    if (!this.shipActionStates[shipId]?.overloadResetAvailable) {
      throw new Error('该舰船无法解除过载');
    }

    try {
      await websocketService.sendRequest('ship.resetOverload', {
        shipId,
        playerId: this.config.playerId,
      });

      // 更新本地状态
      this.updateShipActionState(shipId, {
        isOverloaded: false,
        overloadResetAvailable: false,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 处理回合结算
   */
  private handleResolution(result: TurnResolutionResult): void {
    // 更新舰船状态
    for (const { shipId, newFlux } of result.fluxDissipation) {
      if (this.shipActionStates[shipId]) {
        // 重置行动状态
        this.shipActionStates[shipId].hasMoved = false;
        this.shipActionStates[shipId].hasRotated = false;
        this.shipActionStates[shipId].hasFired = false;
        this.shipActionStates[shipId].hasToggledShield = false;
        this.shipActionStates[shipId].hasVented = false;
      }
    }

    // 处理过载解除
    for (const shipId of result.overloadResets) {
      if (this.shipActionStates[shipId]) {
        this.shipActionStates[shipId].isOverloaded = false;
        this.shipActionStates[shipId].overloadResetAvailable = false;
      }
    }

    // 处理主动排散完成
    for (const shipId of result.ventCompletions) {
      if (this.shipActionStates[shipId]) {
        this.shipActionStates[shipId].hasVented = false;
      }
    }

    // 更新回合数
    this.currentRound = result.roundNumber;

    // 回调
    this.config.onResolution?.(result);
    this.config.onRoundChange?.(result.roundNumber);
  }

  /**
   * 设置WebSocket处理器
   */
  private setupWebSocketHandlers(): void {
    // 监听阶段变化
    websocketService.on(WS_MESSAGE_TYPES.GAME_STATE_UPDATE, (payload: unknown) => {
      const data = payload as { turnPhase?: TurnPhase; roundNumber?: number; currentFaction?: FactionId };
      if (data.turnPhase && data.turnPhase !== this.currentPhase) {
        this.currentPhase = data.turnPhase;
        this.config.onPhaseChange?.(data.turnPhase);
      }
      if (data.roundNumber && data.roundNumber !== this.currentRound) {
        this.currentRound = data.roundNumber;
        this.config.onRoundChange?.(data.roundNumber);
      }
      if (data.currentFaction !== undefined) {
        this.currentFaction = data.currentFaction;
      }
    });

    // 监听舰船状态更新
    websocketService.on(WS_MESSAGE_TYPES.SHIP_STATE_UPDATE, (payload: unknown) => {
      const data = payload as { shipId: string; state: Partial<ShipActionState> };
      if (data.shipId && data.state) {
        this.updateShipActionState(data.shipId, data.state);
      }
    });
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    websocketService.off(WS_MESSAGE_TYPES.GAME_STATE_UPDATE, () => {});
    websocketService.off(WS_MESSAGE_TYPES.SHIP_STATE_UPDATE, () => {});
    this.config.onPhaseChange = undefined;
    this.config.onRoundChange = undefined;
    this.config.onResolution = undefined;
    this.config.onError = undefined;
  }
}

export default TurnPhaseManager;