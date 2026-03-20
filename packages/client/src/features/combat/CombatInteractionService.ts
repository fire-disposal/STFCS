/**
 * 战斗交互服务
 *
 * 处理战斗系统的交互逻辑：
 * - 目标选择
 * - 武器选择
 * - 象限选择
 * - 攻击预览
 * - 攻击确认
 * - 伤害计算
 */

import type { Point } from '@vt/shared/core-types';
import type { DamageType, ArmorQuadrant } from '@vt/shared/config';
import type {
  AttackPreviewResult,
  AttackResult,
  WeaponSelected,
  TargetSelected,
  QuadrantSelected,
} from '@vt/shared/protocol';
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';

/**
 * 战斗阶段
 */
export type CombatPhase =
  | 'idle'           // 空闲
  | 'select_target'  // 选择目标
  | 'select_weapon'  // 选择武器
  | 'select_quadrant' // 选择象限
  | 'preview'        // 预览攻击
  | 'confirm'        // 确认攻击
  | 'executing';     // 执行中

/**
 * 战斗状态
 */
export interface CombatState {
  phase: CombatPhase;
  attackerId: string | null;
  targetId: string | null;
  weaponInstanceId: string | null;
  targetQuadrant: ArmorQuadrant | null;
  preview: AttackPreviewResult | null;
  isAttacking: boolean;
  error: string | null;
}

/**
 * 武器信息
 */
export interface WeaponInfo {
  instanceId: string;
  weaponId: string;
  name: string;
  damageType: DamageType;
  baseDamage: number;
  range: number;
  arc: number;
  fluxCostPerShot: number;
  state: 'ready' | 'cooldown' | 'charging' | 'reloading' | 'disabled' | 'out_of_ammo';
  canFire: boolean;
}

/**
 * 目标信息
 */
export interface TargetInfo {
  id: string;
  name: string;
  hullSize?: 'FIGHTER' | 'FRIGATE' | 'DESTROYER' | 'CRUISER' | 'CAPITAL';
  position: Point;
  heading: number;
  distance: number;
  isEnemy: boolean;
  shieldActive: boolean;
  hullPercent: number;
}

/**
 * 战斗交互服务配置
 */
export interface CombatInteractionConfig {
  attackerId: string;
  onStateChange?: (state: CombatState) => void;
  onPreviewUpdate?: (preview: AttackPreviewResult | null) => void;
  onAttackComplete?: (result: AttackResult) => void;
  onError?: (error: string) => void;
}

/**
 * 战斗交互服务
 */
export class CombatInteractionService {
  private config: CombatInteractionConfig;
  private state: CombatState;

  constructor(config: CombatInteractionConfig) {
    this.config = config;
    this.state = {
      phase: 'idle',
      attackerId: config.attackerId,
      targetId: null,
      weaponInstanceId: null,
      targetQuadrant: null,
      preview: null,
      isAttacking: false,
      error: null,
    };
  }

  /**
   * 获取当前状态
   */
  getState(): CombatState {
    return { ...this.state };
  }

  /**
   * 开始攻击流程
   */
  startAttack(): void {
    this.updateState({ phase: 'select_target' });
  }

  /**
   * 取消攻击流程
   */
  cancelAttack(): void {
    this.updateState({
      phase: 'idle',
      targetId: null,
      weaponInstanceId: null,
      targetQuadrant: null,
      preview: null,
      error: null,
    });
  }

  /**
   * 选择目标
   */
  selectTarget(targetId: string): Promise<TargetSelected> {
    return new Promise((resolve, reject) => {
      if (this.state.phase !== 'select_target') {
        reject(new Error('当前阶段不能选择目标'));
        return;
      }

      this.updateState({ targetId, phase: 'select_weapon' });

      // 发送目标选择请求
      websocketService.sendRequest('combat.selectTarget', {
        attackerId: this.state.attackerId,
        targetId,
        requesterId: this.state.attackerId,
      })
        .then((result) => {
          resolve(result as TargetSelected);
        })
        .catch((error) => {
          this.updateState({ error: error.message });
          reject(error);
        });
    });
  }

  /**
   * 选择武器
   */
  selectWeapon(weaponInstanceId: string): Promise<WeaponSelected> {
    return new Promise((resolve, reject) => {
      if (this.state.phase !== 'select_weapon') {
        reject(new Error('当前阶段不能选择武器'));
        return;
      }

      this.updateState({ weaponInstanceId, phase: 'select_quadrant' });

      // 发送武器选择请求
      websocketService.sendRequest('combat.selectWeapon', {
        shipId: this.state.attackerId,
        weaponInstanceId,
        requesterId: this.state.attackerId,
      })
        .then((result) => {
          resolve(result as WeaponSelected);
        })
        .catch((error) => {
          this.updateState({ error: error.message });
          reject(error);
        });
    });
  }

  /**
   * 选择象限
   */
  selectQuadrant(quadrant: ArmorQuadrant): Promise<QuadrantSelected> {
    return new Promise((resolve, reject) => {
      if (this.state.phase !== 'select_quadrant') {
        reject(new Error('当前阶段不能选择象限'));
        return;
      }

      this.updateState({ targetQuadrant: quadrant, phase: 'preview' });

      // 发送象限选择请求
      websocketService.sendRequest('combat.selectQuadrant', {
        attackerId: this.state.attackerId,
        targetId: this.state.targetId!,
        quadrant,
        requesterId: this.state.attackerId,
      })
        .then((result) => {
          resolve(result as QuadrantSelected);
          // 自动请求攻击预览
          this.requestAttackPreview();
        })
        .catch((error) => {
          this.updateState({ error: error.message });
          reject(error);
        });
    });
  }

  /**
   * 请求攻击预览
   */
  async requestAttackPreview(): Promise<AttackPreviewResult> {
    if (!this.state.targetId || !this.state.weaponInstanceId) {
      throw new Error('缺少目标或武器信息');
    }

    try {
      const result = await websocketService.sendRequest('combat.attackPreview', {
        attackerId: this.state.attackerId,
        targetId: this.state.targetId,
        weaponInstanceId: this.state.weaponInstanceId,
        targetQuadrant: this.state.targetQuadrant,
        requesterId: this.state.attackerId,
      });

      const preview = result as AttackPreviewResult;
      this.updateState({ preview, phase: 'confirm' });
      this.config.onPreviewUpdate?.(preview);

      return preview;
    } catch (error: any) {
      this.updateState({ error: error.message });
      throw error;
    }
  }

  /**
   * 确认攻击
   */
  async confirmAttack(): Promise<AttackResult> {
    if (this.state.phase !== 'confirm') {
      throw new Error('当前阶段不能确认攻击');
    }

    if (!this.state.preview?.canAttack) {
      throw new Error('无法攻击：' + (this.state.preview?.blockReason || '未知原因'));
    }

    this.updateState({ isAttacking: true, phase: 'executing' });

    try {
      const result = await websocketService.sendRequest('combat.confirmAttack', {
        attackerId: this.state.attackerId,
        targetId: this.state.targetId!,
        weaponInstanceId: this.state.weaponInstanceId!,
        targetQuadrant: this.state.targetQuadrant,
        requesterId: this.state.attackerId,
      });

      const attackResult = result as AttackResult;

      // 重置状态
      this.updateState({
        phase: 'idle',
        targetId: null,
        weaponInstanceId: null,
        targetQuadrant: null,
        preview: null,
        isAttacking: false,
      });

      this.config.onAttackComplete?.(attackResult);
      return attackResult;
    } catch (error: any) {
      this.updateState({
        isAttacking: false,
        phase: 'confirm',
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * 快速攻击（自动选择最佳象限）
   */
  async quickAttack(targetId: string, weaponInstanceId: string): Promise<AttackResult> {
    // 开始攻击流程
    this.startAttack();

    // 选择目标
    await this.selectTarget(targetId);

    // 选择武器
    await this.selectWeapon(weaponInstanceId);

    // 自动选择最佳象限（或让服务器决定）
    // 这里我们跳过象限选择，直接请求预览
    this.updateState({ phase: 'preview' });
    const preview = await this.requestAttackPreview();

    if (!preview.canAttack) {
      throw new Error('无法攻击：' + (preview.blockReason || '未知原因'));
    }

    // 确认攻击
    return this.confirmAttack();
  }

  /**
   * 计算距离
   */
  static calculateDistance(from: Point, to: Point): number {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 检查是否在射程内
   */
  static isInRange(attackerPos: Point, targetPos: Point, range: number): boolean {
    return this.calculateDistance(attackerPos, targetPos) <= range;
  }

  /**
   * 检查是否在射界内
   */
  static isInArc(
    attackerPos: Point,
    attackerHeading: number,
    targetPos: Point,
    arcAngle: number
  ): boolean {
    const dx = targetPos.x - attackerPos.x;
    const dy = targetPos.y - attackerPos.y;
    const angleToTarget = (Math.atan2(dy, dx) * 180) / Math.PI;

    // 计算角度差
    let angleDiff = angleToTarget - attackerHeading;
    while (angleDiff > 180) angleDiff -= 360;
    while (angleDiff < -180) angleDiff += 360;

    return Math.abs(angleDiff) <= arcAngle / 2;
  }

  /**
   * 获取命中象限
   */
  static getHitQuadrant(
    targetHeading: number,
    attackAngle: number
  ): ArmorQuadrant {
    // 计算相对于目标的攻击角度
    let relativeAngle = attackAngle - targetHeading;
    while (relativeAngle < 0) relativeAngle += 360;
    while (relativeAngle >= 360) relativeAngle -= 360;

    // 根据角度确定象限
    if (relativeAngle >= 330 || relativeAngle < 30) {
      return 'FRONT_TOP';
    } else if (relativeAngle >= 30 && relativeAngle < 90) {
      return 'FRONT_BOTTOM';
    } else if (relativeAngle >= 90 && relativeAngle < 150) {
      return 'RIGHT_TOP';
    } else if (relativeAngle >= 150 && relativeAngle < 210) {
      return 'RIGHT_BOTTOM';
    } else if (relativeAngle >= 210 && relativeAngle < 270) {
      return 'LEFT_TOP';
    } else {
      return 'LEFT_BOTTOM';
    }
  }

  /**
   * 更新状态
   */
  private updateState(updates: Partial<CombatState>): void {
    this.state = { ...this.state, ...updates };
    this.config.onStateChange?.(this.state);
  }

  /**
   * 销毁服务
   */
  destroy(): void {
    this.config.onStateChange = undefined;
    this.config.onPreviewUpdate = undefined;
    this.config.onAttackComplete = undefined;
    this.config.onError = undefined;
  }
}

export default CombatInteractionService;