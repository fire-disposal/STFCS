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
import type { DamageType } from '@vt/shared/config';
import type { ArmorQuadrant } from '@vt/shared/types';
import type {
  AttackPreviewResult,
  AttackResult,
  WeaponSelected,
  TargetSelected,
  QuadrantSelected,
} from '@vt/shared/protocol';
import type { RoomClient, OperationMap } from '@/room';

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
  client: RoomClient<OperationMap>;
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
  private client: RoomClient<OperationMap>;

  constructor(config: CombatInteractionConfig) {
    this.config = config;
    this.client = config.client;
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
  async selectTarget(targetId: string): Promise<TargetSelected> {
    if (this.state.phase !== 'select_target') {
      throw new Error('当前阶段不能选择目标');
    }

    if (!this.state.attackerId) {
      throw new Error('攻击者ID未设置');
    }

    this.updateState({ targetId, phase: 'select_weapon' });

    try {
      await this.client.call('selectTarget', targetId);
      return {
        targetId,
        timestamp: Date.now(),
      } as TargetSelected;
    } catch (error) {
      this.updateState({ error: error instanceof Error ? error.message : '选择目标失败' });
      throw error;
    }
  }

  /**
   * 选择武器
   */
  async selectWeapon(weaponInstanceId: string): Promise<WeaponSelected> {
    if (this.state.phase !== 'select_weapon') {
      throw new Error('当前阶段不能选择武器');
    }

    if (!this.state.attackerId) {
      throw new Error('攻击者ID未设置');
    }

    this.updateState({ weaponInstanceId, phase: 'select_quadrant' });

    try {
      await this.client.call('selectWeapon', weaponInstanceId);
      return {
        weaponInstanceId,
        timestamp: Date.now(),
      } as WeaponSelected;
    } catch (error) {
      this.updateState({ error: error instanceof Error ? error.message : '选择武器失败' });
      throw error;
    }
  }

  /**
   * 选择象限
   */
  async selectQuadrant(quadrant: ArmorQuadrant): Promise<QuadrantSelected> {
    if (this.state.phase !== 'select_quadrant') {
      throw new Error('当前阶段不能选择象限');
    }

    if (!this.state.attackerId || !this.state.targetId) {
      throw new Error('攻击者ID或目标ID未设置');
    }

    this.updateState({ targetQuadrant: quadrant, phase: 'preview' });

    try {
      await this.client.call('selectQuadrant', quadrant);
      // 自动请求攻击预览
      await this.requestAttackPreview();
      return {
        quadrant,
        timestamp: Date.now(),
      } as QuadrantSelected;
    } catch (error) {
      this.updateState({ error: error instanceof Error ? error.message : '选择象限失败' });
      throw error;
    }
  }

  /**
   * 请求攻击预览
   */
  async requestAttackPreview(): Promise<AttackPreviewResult> {
    if (!this.state.attackerId || !this.state.targetId || !this.state.weaponInstanceId) {
      throw new Error('缺少攻击者、目标或武器信息');
    }

    // 本地计算预览（简化版）
    const preview: AttackPreviewResult = {
      canAttack: true,
      attackerId: this.state.attackerId,
      targetId: this.state.targetId,
      weaponId: this.state.weaponInstanceId || '',
      quadrant: this.state.targetQuadrant ?? 'FRONT_TOP',
      estimatedDamage: 20,
      shieldAbsorption: 0,
      armorReduction: 0,
      hullDamage: 20,
      attackerFluxCost: 10,
      targetFluxGenerated: 0,
      hitChance: 0.8,
      canCauseOverload: false,
      preview: {
        baseDamage: 20,
        estimatedDamage: 20,
        estimatedShieldAbsorb: 0,
        estimatedArmorReduction: 0,
        estimatedHullDamage: 20,
        hitChance: 0.8,
        shieldAbsorption: 0,
        armorReduction: 0,
        hullDamage: 20,
        hitQuadrant: this.state.targetQuadrant ?? 'FRONT_TOP',
        fluxCost: 10,
        willGenerateHardFlux: false,
      },
    };

    this.updateState({ preview, phase: 'confirm' });
    this.config.onPreviewUpdate?.(preview);

    return preview;
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
      const result = await this.client.call(
        'attack',
        this.state.attackerId!,
        this.state.targetId!,
        this.state.weaponInstanceId!,
        this.state.targetQuadrant ?? 'FRONT_TOP'
      );

      // 重置状态
      this.updateState({
        phase: 'idle',
        targetId: null,
        weaponInstanceId: null,
        targetQuadrant: null,
        preview: null,
        isAttacking: false,
      });

      const attackResult = result as AttackResult;
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