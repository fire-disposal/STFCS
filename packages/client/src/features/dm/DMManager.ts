/**
 * DM管理服务
 *
 * 提供DM专属功能：
 * - 游戏流程控制
 * - 敌方单位管理
 * - 全局设置
 * - 事件触发
 */

import type { Point } from '@vt/shared/core-types';
import type { FactionId } from '@vt/shared/types';
import type { GamePhase, TurnPhase } from '@vt/shared/protocol';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';

/**
 * 敌方单位信息
 */
export interface EnemyUnit {
  id: string;
  name: string;
  type: 'ship' | 'station' | 'asteroid';
  factionId: FactionId;
  position: Point;
  heading: number;
  hull: { current: number; max: number };
  flux: { current: number; capacity: number };
  shield: { active: boolean; hp: number; maxHp: number };
  actions: string[];
  isSelected?: boolean;
}

/**
 * DM权限
 */
export type DMPermission =
  | 'control_game_flow'    // 控制游戏流程
  | 'create_enemies'       // 创建敌方单位
  | 'control_enemies'      // 控制敌方单位
  | 'modify_stats'         // 修改单位属性
  | 'trigger_events'       // 触发事件
  | 'manage_players';      // 管理玩家

/**
 * DM状态
 */
export interface DMState {
  isDM: boolean;
  permissions: DMPermission[];
  gamePhase: GamePhase;
  turnPhase: TurnPhase;
  isPaused: boolean;
  enemyUnits: EnemyUnit[];
  selectedEnemyId: string | null;
  globalModifiers: {
    damageMultiplier: number;
    rangeMultiplier: number;
    fluxMultiplier: number;
  };
}

/**
 * DM管理器配置
 */
export interface DMManagerConfig {
  roomId: string;
  playerId: string;
  onStateChange?: (state: DMState) => void;
  onError?: (error: string) => void;
}

/**
 * DM管理器
 */
export class DMManager {
  private config: DMManagerConfig;
  private state: DMState;

  constructor(config: DMManagerConfig) {
    this.config = config;
    this.state = {
      isDM: false,
      permissions: [],
      gamePhase: 'lobby',
      turnPhase: 'player_action',
      isPaused: false,
      enemyUnits: [],
      selectedEnemyId: null,
      globalModifiers: {
        damageMultiplier: 1.0,
        rangeMultiplier: 1.0,
        fluxMultiplier: 1.0,
      },
    };
    this.setupWebSocketHandlers();
  }

  /**
   * 获取当前状态
   */
  getState(): DMState {
    return { ...this.state };
  }

  /**
   * 设置DM模式
   */
  async setDMMode(enabled: boolean): Promise<void> {
    try {
      const result = await websocketService.sendRequest('dm.setMode', {
        roomId: this.config.roomId,
        playerId: this.config.playerId,
        enabled,
      });

      this.state.isDM = enabled;
      this.state.permissions = result.permissions || [];
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  // ==================== 游戏流程控制 ====================

  /**
   * 暂停游戏
   */
  async pauseGame(): Promise<void> {
    if (!this.hasPermission('control_game_flow')) {
      throw new Error('没有权限控制游戏流程');
    }

    try {
      await websocketService.sendRequest('game.pause', {
        roomId: this.config.roomId,
      });

      this.state.isPaused = true;
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 恢复游戏
   */
  async resumeGame(): Promise<void> {
    if (!this.hasPermission('control_game_flow')) {
      throw new Error('没有权限控制游戏流程');
    }

    try {
      await websocketService.sendRequest('game.resume', {
        roomId: this.config.roomId,
      });

      this.state.isPaused = false;
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 结束游戏
   */
  async endGame(winner?: FactionId): Promise<void> {
    if (!this.hasPermission('control_game_flow')) {
      throw new Error('没有权限控制游戏流程');
    }

    try {
      await websocketService.sendRequest('game.end', {
        roomId: this.config.roomId,
        winner,
      });

      this.state.gamePhase = 'ended';
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 推进阶段
   */
  async advancePhase(): Promise<void> {
    if (!this.hasPermission('control_game_flow')) {
      throw new Error('没有权限控制游戏流程');
    }

    try {
      await websocketService.sendRequest('game.advancePhase', {
        roomId: this.config.roomId,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  // ==================== 敌方单位管理 ====================

  /**
   * 创建敌方单位
   */
  async createEnemyUnit(params: {
    shipDefinitionId: string;
    position: Point;
    heading: number;
    factionId: FactionId;
    name?: string;
  }): Promise<EnemyUnit> {
    if (!this.hasPermission('create_enemies')) {
      throw new Error('没有权限创建敌方单位');
    }

    try {
      const result = await websocketService.sendRequest('dm.createEnemy', {
        roomId: this.config.roomId,
        ...params,
      });

      const unit = result as EnemyUnit;
      this.state.enemyUnits.push(unit);
      this.config.onStateChange?.(this.state);

      return unit;
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 删除敌方单位
   */
  async deleteEnemyUnit(unitId: string): Promise<void> {
    if (!this.hasPermission('control_enemies')) {
      throw new Error('没有权限控制敌方单位');
    }

    try {
      await websocketService.sendRequest('dm.deleteEnemy', {
        roomId: this.config.roomId,
        unitId,
      });

      this.state.enemyUnits = this.state.enemyUnits.filter(u => u.id !== unitId);
      if (this.state.selectedEnemyId === unitId) {
        this.state.selectedEnemyId = null;
      }
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 控制敌方单位移动
   */
  async moveEnemyUnit(unitId: string, position: Point, heading: number): Promise<void> {
    if (!this.hasPermission('control_enemies')) {
      throw new Error('没有权限控制敌方单位');
    }

    try {
      await websocketService.sendRequest('dm.moveEnemy', {
        roomId: this.config.roomId,
        unitId,
        position,
        heading,
      });

      const unit = this.state.enemyUnits.find(u => u.id === unitId);
      if (unit) {
        unit.position = position;
        unit.heading = heading;
      }
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 控制敌方单位攻击
   */
  async enemyAttack(unitId: string, targetId: string, weaponId?: string): Promise<void> {
    if (!this.hasPermission('control_enemies')) {
      throw new Error('没有权限控制敌方单位');
    }

    try {
      await websocketService.sendRequest('dm.enemyAttack', {
        roomId: this.config.roomId,
        unitId,
        targetId,
        weaponId,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 选择敌方单位
   */
  selectEnemyUnit(unitId: string | null): void {
    this.state.selectedEnemyId = unitId;
    this.state.enemyUnits.forEach(u => {
      u.isSelected = u.id === unitId;
    });
    this.config.onStateChange?.(this.state);
  }

  // ==================== 全局设置 ====================

  /**
   * 设置全局伤害倍率
   */
  async setDamageMultiplier(multiplier: number): Promise<void> {
    if (!this.hasPermission('modify_stats')) {
      throw new Error('没有权限修改全局设置');
    }

    try {
      await websocketService.sendRequest('dm.setGlobalModifier', {
        roomId: this.config.roomId,
        type: 'damage',
        value: multiplier,
      });

      this.state.globalModifiers.damageMultiplier = multiplier;
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 设置全局射程倍率
   */
  async setRangeMultiplier(multiplier: number): Promise<void> {
    if (!this.hasPermission('modify_stats')) {
      throw new Error('没有权限修改全局设置');
    }

    try {
      await websocketService.sendRequest('dm.setGlobalModifier', {
        roomId: this.config.roomId,
        type: 'range',
        value: multiplier,
      });

      this.state.globalModifiers.rangeMultiplier = multiplier;
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 设置全局辐能倍率
   */
  async setFluxMultiplier(multiplier: number): Promise<void> {
    if (!this.hasPermission('modify_stats')) {
      throw new Error('没有权限修改全局设置');
    }

    try {
      await websocketService.sendRequest('dm.setGlobalModifier', {
        roomId: this.config.roomId,
        type: 'flux',
        value: multiplier,
      });

      this.state.globalModifiers.fluxMultiplier = multiplier;
      this.config.onStateChange?.(this.state);
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  // ==================== 事件触发 ====================

  /**
   * 触发事件
   */
  async triggerEvent(eventType: string, data: Record<string, unknown>): Promise<void> {
    if (!this.hasPermission('trigger_events')) {
      throw new Error('没有权限触发事件');
    }

    try {
      await websocketService.sendRequest('dm.triggerEvent', {
        roomId: this.config.roomId,
        eventType,
        data,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  // ==================== 玩家管理 ====================

  /**
   * 踢出玩家
   */
  async kickPlayer(playerId: string): Promise<void> {
    if (!this.hasPermission('manage_players')) {
      throw new Error('没有权限管理玩家');
    }

    try {
      await websocketService.sendRequest('dm.kickPlayer', {
        roomId: this.config.roomId,
        playerId,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  /**
   * 转移房主
   */
  async transferOwner(newOwnerId: string): Promise<void> {
    if (!this.hasPermission('manage_players')) {
      throw new Error('没有权限管理玩家');
    }

    try {
      await websocketService.sendRequest('dm.transferOwner', {
        roomId: this.config.roomId,
        newOwnerId,
      });
    } catch (error: any) {
      this.config.onError?.(error.message);
      throw error;
    }
  }

  // ==================== 辅助方法 ====================

  /**
   * 检查权限
   */
  private hasPermission(permission: DMPermission): boolean {
    return this.state.permissions.includes(permission);
  }

  /**
   * 设置WebSocket处理器
   */
  private setupWebSocketHandlers(): void {
    // 监听游戏状态更新
    websocketService.on(WS_MESSAGE_TYPES.GAME_STATE_UPDATE, (payload: unknown) => {
      const data = payload as {
        phase?: GamePhase;
        turnPhase?: TurnPhase;
        isPaused?: boolean;
      };

      if (data.phase) this.state.gamePhase = data.phase;
      if (data.turnPhase) this.state.turnPhase = data.turnPhase;
      if (data.isPaused !== undefined) this.state.isPaused = data.isPaused;

      this.config.onStateChange?.(this.state);
    });

    // 监听敌方单位更新
    websocketService.on(WS_MESSAGE_TYPES.ENEMY_UNITS_UPDATE, (payload: unknown) => {
      const data = payload as { units: EnemyUnit[] };
      if (data.units) {
        this.state.enemyUnits = data.units;
        this.config.onStateChange?.(this.state);
      }
    });
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    websocketService.off(WS_MESSAGE_TYPES.GAME_STATE_UPDATE, () => {});
    websocketService.off(WS_MESSAGE_TYPES.ENEMY_UNITS_UPDATE, () => {});
    this.config.onStateChange = undefined;
    this.config.onError = undefined;
  }
}

export default DMManager;