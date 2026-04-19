/**
 * 全局修正系统管理 - 基于 @vt/data 权威设计
 */

import { getGameRules } from "@vt/data";

/** 修正类型 */
export type ModifierType = 
  | "RANGE"
  | "DAMAGE"
  | "ARMOR"
  | "SHIELD"
  | "SPEED"
  | "TURN_RATE"
  | "FLUX_CAPACITY"
  | "FLUX_DISSIPATION"
  | "ACCURACY"
  | "COOLDOWN";

/** 修正目标 */
export type ModifierTarget = 
  | "ALL"
  | "FACTION"
  | "PLAYER"
  | "SHIP_CLASS"
  | "SHIP_SIZE"
  | "WEAPON_TYPE"
  | "SPECIFIC_SHIP";

/** 修正应用范围 */
export interface ModifierScope {
  target: ModifierTarget;
  targetId?: string; // 特定目标ID
  faction?: string; // 阵营
  shipClass?: string; // 舰船类别
  shipSize?: string; // 舰船尺寸
  weaponType?: string; // 武器类型
}

/** 修正效果 */
export interface ModifierEffect {
  type: ModifierType;
  value: number; // 百分比修正（如 0.1 表示 +10%）
  isMultiplicative: boolean; // true: 乘法修正, false: 加法修正
  maxValue?: number; // 最大值限制
  minValue?: number; // 最小值限制
}

/** 修正器定义 */
export interface Modifier {
  id: string;
  name: string;
  description?: string;
  scope: ModifierScope;
  effects: ModifierEffect[];
  duration?: number; // 持续时间（回合数），undefined表示永久
  stackable: boolean; // 是否可叠加
  maxStacks?: number; // 最大叠加层数
  priority: number; // 优先级（越高越先应用）
}

/** 激活的修正器 */
export interface ActiveModifier {
  modifierId: string;
  scope: ModifierScope;
  effects: ModifierEffect[];
  appliedAt: number; // 应用时间戳
  expiresAt?: number; // 过期时间戳
  stacks: number; // 当前叠加层数
  source?: string; // 来源（如技能ID、装备ID等）
}

/** 修正系统管理器 */
export class ModifierSystem {
  private modifiers: Map<string, Modifier> = new Map();
  private activeModifiers: Map<string, ActiveModifier[]> = new Map(); // key: targetId

  constructor() {
    this.initializeDefaultModifiers();
  }

  /**
   * 初始化默认修正器
   */
  private initializeDefaultModifiers(): void {
    // 从data包获取游戏规则
    const gameRules = getGameRules();
    const defaultModifiers = gameRules.modifiers || [];

    for (const modifier of defaultModifiers) {
      this.addModifier(modifier);
    }

    // 添加一些基础修正器
    this.addModifier({
      id: "range_penalty_far",
      name: "远距离惩罚",
      description: "远距离射击精度下降",
      scope: { target: "ALL" },
      effects: [{
        type: "ACCURACY",
        value: -0.3,
        isMultiplicative: true,
        minValue: 0.1,
      }],
      stackable: true,
      priority: 10,
    });

    this.addModifier({
      id: "range_bonus_near",
      name: "近距离奖励",
      description: "近距离射击精度提升",
      scope: { target: "ALL" },
      effects: [{
        type: "ACCURACY",
        value: 0.2,
        isMultiplicative: true,
        maxValue: 2.0,
      }],
      stackable: true,
      priority: 10,
    });

    this.addModifier({
      id: "overload_penalty",
      name: "过载惩罚",
      description: "舰船过载时所有系统效率下降",
      scope: { target: "ALL" },
      effects: [
        { type: "SPEED", value: -0.5, isMultiplicative: true },
        { type: "TURN_RATE", value: -0.5, isMultiplicative: true },
        { type: "ACCURACY", value: -0.7, isMultiplicative: true },
      ],
      stackable: false,
      priority: 100,
    });
  }

  /**
   * 添加修正器
   */
  addModifier(modifier: Modifier): void {
    this.modifiers.set(modifier.id, modifier);
  }

  /**
   * 根据ID获取修正器
   */
  getModifierById(modifierId: string): Modifier | null {
    return this.modifiers.get(modifierId) || null;
  }

  /**
   * 应用修正器到目标
   */
  applyModifier(targetId: string, modifierId: string, source?: string): boolean {
    const modifier = this.getModifierById(modifierId);
    if (!modifier) return false;

    const activeMods = this.activeModifiers.get(targetId) || [];
    
    // 检查是否已存在相同修正器
    const existingIndex = activeMods.findIndex(m => m.modifierId === modifierId);
    
    if (existingIndex >= 0) {
      const existing = activeMods[existingIndex];
      
      if (modifier.stackable) {
        // 可叠加：增加层数
        const maxStacks = modifier.maxStacks || 1;
        if (existing.stacks < maxStacks) {
          existing.stacks++;
          
          // 更新过期时间
          if (modifier.duration) {
            existing.expiresAt = Date.now() + modifier.duration * 1000;
          }
          
          return true;
        }
        return false; // 达到最大叠加层数
      } else {
        // 不可叠加：更新现有修正器
        activeMods[existingIndex] = this.createActiveModifier(modifier, source);
        this.activeModifiers.set(targetId, activeMods);
        return true;
      }
    } else {
      // 新修正器
      const activeMod = this.createActiveModifier(modifier, source);
      activeMods.push(activeMod);
      
      // 按优先级排序
      activeMods.sort((a, b) => {
        const modA = this.getModifierById(a.modifierId)!;
        const modB = this.getModifierById(b.modifierId)!;
        return modB.priority - modA.priority;
      });
      
      this.activeModifiers.set(targetId, activeMods);
      return true;
    }
  }

  /**
   * 创建激活的修正器
   */
  private createActiveModifier(modifier: Modifier, source?: string): ActiveModifier {
    const now = Date.now();
    
    return {
      modifierId: modifier.id,
      scope: modifier.scope,
      effects: modifier.effects,
      appliedAt: now,
      expiresAt: modifier.duration ? now + modifier.duration * 1000 : undefined,
      stacks: 1,
      source,
    };
  }

  /**
   * 移除目标的修正器
   */
  removeModifier(targetId: string, modifierId: string): boolean {
    const activeMods = this.activeModifiers.get(targetId);
    if (!activeMods) return false;

    const initialLength = activeMods.length;
    const filtered = activeMods.filter(m => m.modifierId !== modifierId);
    
    if (filtered.length < initialLength) {
      this.activeModifiers.set(targetId, filtered);
      return true;
    }
    
    return false;
  }

  /**
   * 清除目标的所有修正器
   */
  clearAllModifiers(targetId: string): void {
    this.activeModifiers.delete(targetId);
  }

  /**
   * 获取目标的所有修正器
   */
  getTargetModifiers(targetId: string): ActiveModifier[] {
    return this.activeModifiers.get(targetId) || [];
  }

  /**
   * 计算修正后的数值
   */
  calculateModifiedValue(
    baseValue: number,
    targetId: string,
    modifierType: ModifierType
  ): number {
    const modifiers = this.getTargetModifiers(targetId);
    let result = baseValue;

    // 先应用加法修正
    for (const activeMod of modifiers) {
      for (const effect of activeMod.effects) {
        if (effect.type === modifierType && !effect.isMultiplicative) {
          const modifierValue = effect.value * activeMod.stacks;
          result += baseValue * modifierValue;
        }
      }
    }

    // 再应用乘法修正
    for (const activeMod of modifiers) {
      for (const effect of activeMod.effects) {
        if (effect.type === modifierType && effect.isMultiplicative) {
          const modifierValue = 1 + (effect.value * activeMod.stacks);
          result *= modifierValue;
        }
      }
    }

    return result;
  }

  /**
   * 检查目标是否匹配修正器范围
   */
  checkScopeMatch(
    scope: ModifierScope,
    targetInfo: {
      faction?: string;
      shipClass?: string;
      shipSize?: string;
      weaponType?: string;
    }
  ): boolean {
    if (scope.target === "ALL") return true;
    if (scope.target === "FACTION" && scope.faction === targetInfo.faction) return true;
    if (scope.target === "SHIP_CLASS" && scope.shipClass === targetInfo.shipClass) return true;
    if (scope.target === "SHIP_SIZE" && scope.shipSize === targetInfo.shipSize) return true;
    if (scope.target === "WEAPON_TYPE" && scope.weaponType === targetInfo.weaponType) return true;
    
    return false;
  }

  /**
   * 清理过期的修正器
   */
  cleanupExpiredModifiers(): void {
    const now = Date.now();
    
    for (const [targetId, activeMods] of this.activeModifiers.entries()) {
      const validMods = activeMods.filter(mod => 
        !mod.expiresAt || mod.expiresAt > now
      );
      
      if (validMods.length === 0) {
        this.activeModifiers.delete(targetId);
      } else if (validMods.length < activeMods.length) {
        this.activeModifiers.set(targetId, validMods);
      }
    }
  }

  /**
   * 获取所有修正器
   */
  getAllModifiers(): Modifier[] {
    return Array.from(this.modifiers.values());
  }

  /**
   * 按类型筛选修正器
   */
  getModifiersByType(type: ModifierType): Modifier[] {
    return this.getAllModifiers().filter(modifier =>
      modifier.effects.some(effect => effect.type === type)
    );
  }
}

// 导出单例实例
export const modifierSystem = new ModifierSystem();