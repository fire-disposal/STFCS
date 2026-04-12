/**
 * 战斗状态类型定义
 *
 * 定义战斗相关的状态类型，包括：
 * - 护甲实例状态（6象限）
 * - 护盾实例状态
 * - 辐能系统状态
 * - 船体实例状态
 * - 行动点状态
 */

import { z } from 'zod';
import { ArmorQuadrantSchema } from '../core-types.js';

// ==================== 护甲实例 Schema ====================

/** 护甲象限枚举（重新导出以保持一致性） */
export const ArmorQuadrantInstanceSchema = ArmorQuadrantSchema;

/** 护甲实例状态 Schema - 支持6象限 */
export const ArmorInstanceStateSchema = z.object({
  /** 每象限最大护甲值 */
  maxPerQuadrant: z.number().min(0),
  /** 各象限当前护甲值 */
  quadrants: z.object({
    FRONT_TOP: z.number().min(0),
    FRONT_BOTTOM: z.number().min(0),
    LEFT_TOP: z.number().min(0),
    LEFT_BOTTOM: z.number().min(0),
    RIGHT_TOP: z.number().min(0),
    RIGHT_BOTTOM: z.number().min(0),
  }),
  /** 基础护甲值（用于计算伤害减免） */
  baseArmorRating: z.number().min(0).optional(),
});

// ==================== 护盾实例 Schema ====================

/** 护盾类型枚举 */
export const ShieldTypeInstanceSchema = z.enum([
  'FRONT',  // 前向护盾
  'OMNI',   // 全向护盾
  'NONE',   // 无护盾
]);

/** 护盾实例状态 Schema */
export const ShieldInstanceStateSchema = z.object({
  /** 护盾类型 */
  type: ShieldTypeInstanceSchema,
  /** 是否激活 */
  active: z.boolean().default(false),
  /** 当前护盾HP */
  current: z.number().min(0),
  /** 最大护盾HP */
  max: z.number().min(0),
  /** 护盾半径 */
  radius: z.number().min(0),
  /** 护盾中心偏移 */
  centerOffset: z.object({
    x: z.number(),
    y: z.number(),
  }).default({ x: 0, y: 0 }),
  /** 覆盖角度（前向护盾） */
  coverageAngle: z.number().min(0).max(360),
  /** 当前朝向（全向护盾） */
  facing: z.number().optional(),
  /** 护盾效率（伤害吸收率） */
  efficiency: z.number().min(0).max(2).default(1),
  /** 维护flux消耗（每秒） */
  maintenanceCost: z.number().min(0).default(0),
  /** 转向速度（全向护盾） */
  turnRate: z.number().min(0).optional(),
});

// ==================== 辐能系统 Schema ====================

/** 辐能状态枚举 */
export const FluxStateSchema = z.enum([
  'normal',     // 正常
  'venting',    // 散热中
  'overloaded', // 过载
]);

/** 辐能实例状态 Schema */
export const FluxInstanceStateSchema = z.object({
  /** 当前总辐能 */
  current: z.number().min(0),
  /** 辐能容量 */
  capacity: z.number().min(0),
  /** 软辐能（可快速消散） */
  softFlux: z.number().min(0),
  /** 硬辐能（需要主动散热） */
  hardFlux: z.number().min(0),
  /** 辐能消散率（每秒） */
  dissipation: z.number().min(0),
  /** 主动散热速度 */
  ventRate: z.number().min(0),
  /** 当前状态 */
  state: FluxStateSchema,
  /** 过载剩余时间（秒） */
  overloadTimeRemaining: z.number().min(0).default(0),
  /** 散热剩余时间（秒） */
  ventTimeRemaining: z.number().min(0).default(0),
  /** 过载持续时间（秒） */
  overloadDuration: z.number().min(0).default(0),
});

// ==================== 船体实例 Schema ====================

/** 船体实例状态 Schema */
export const HullInstanceStateSchema = z.object({
  /** 当前船体HP */
  current: z.number().min(0),
  /** 最大船体HP */
  max: z.number().min(0),
  /** 是否被禁用（0 HP或EMP效果） */
  disabled: z.boolean().default(false),
  /** 禁用剩余时间（秒） */
  disabledTimeRemaining: z.number().min(0).default(0),
});

// ==================== 行动点 Schema ====================

/** 行动类型枚举 */
export const ActionTypeSchema = z.enum([
  'move',       // 移动
  'attack',     // 攻击
  'shield',     // 护盾操作
  'vent',       // 散热
  'special',    // 特殊能力
  'system',     // 舰船系统
]);

/** 行动点状态 Schema */
export const ActionsStateSchema = z.object({
  /** 每回合行动点数 */
  actionsPerTurn: z.number().min(0).int(),
  /** 剩余行动点数 */
  remainingActions: z.number().min(0).int(),
  /** 已执行的行动 */
  actionsTaken: z.array(z.object({
    type: ActionTypeSchema,
    timestamp: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })).default([]),
  /** 是否已结束回合 */
  turnEnded: z.boolean().default(false),
});

// ==================== 综合战斗状态 Schema ====================

/** Token战斗状态 Schema */
export const CombatStateSchema = z.object({
  /** 船体状态 */
  hull: HullInstanceStateSchema,
  /** 护甲状态 */
  armor: ArmorInstanceStateSchema,
  /** 护盾状态 */
  shield: ShieldInstanceStateSchema,
  /** 辐能状态 */
  flux: FluxInstanceStateSchema,
  /** 行动点状态 */
  actions: ActionsStateSchema,
  /** 是否被摧毁 */
  isDestroyed: z.boolean().default(false),
  /** 是否可行动 */
  canAct: z.boolean().default(true),
});

// ==================== 类型推导 ====================

export type ArmorQuadrantInstance = z.infer<typeof ArmorQuadrantInstanceSchema>;
export type ArmorInstanceState = z.infer<typeof ArmorInstanceStateSchema>;
export type ShieldTypeInstance = z.infer<typeof ShieldTypeInstanceSchema>;
export type ShieldInstanceState = z.infer<typeof ShieldInstanceStateSchema>;
export type FluxState = z.infer<typeof FluxStateSchema>;
export type FluxInstanceState = z.infer<typeof FluxInstanceStateSchema>;
export type HullInstanceState = z.infer<typeof HullInstanceStateSchema>;
export type ActionType = z.infer<typeof ActionTypeSchema>;
export type ActionsState = z.infer<typeof ActionsStateSchema>;
export type CombatState = z.infer<typeof CombatStateSchema>;

// ==================== 工具函数 ====================

/** 创建默认护甲状态 */
export function createDefaultArmorState(
  maxPerQuadrant: number,
  baseArmorRating?: number
): ArmorInstanceState {
  return {
    maxPerQuadrant,
    quadrants: {
      FRONT_TOP: maxPerQuadrant,
      FRONT_BOTTOM: maxPerQuadrant,
      LEFT_TOP: maxPerQuadrant,
      LEFT_BOTTOM: maxPerQuadrant,
      RIGHT_TOP: maxPerQuadrant,
      RIGHT_BOTTOM: maxPerQuadrant,
    },
    baseArmorRating,
  };
}

/** 创建默认护盾状态 */
export function createDefaultShieldState(
  type: ShieldTypeInstance,
  max: number,
  radius: number,
  coverageAngle: number,
  efficiency: number = 1,
  maintenanceCost: number = 0
): ShieldInstanceState {
  return {
    type,
    active: false,
    current: max,
    max,
    radius,
    centerOffset: { x: 0, y: 0 },
    coverageAngle,
    efficiency,
    maintenanceCost,
  };
}

/** 创建默认辐能状态 */
export function createDefaultFluxState(
  capacity: number,
  dissipation: number,
  ventRate: number = 0
): FluxInstanceState {
  return {
    current: 0,
    capacity,
    softFlux: 0,
    hardFlux: 0,
    dissipation,
    ventRate,
    state: 'normal',
    overloadTimeRemaining: 0,
    ventTimeRemaining: 0,
    overloadDuration: 0,
  };
}

/** 创建默认船体状态 */
export function createDefaultHullState(max: number): HullInstanceState {
  return {
    current: max,
    max,
    disabled: false,
    disabledTimeRemaining: 0,
  };
}

/** 创建默认行动点状态 */
export function createDefaultActionsState(actionsPerTurn: number): ActionsState {
  return {
    actionsPerTurn,
    remainingActions: actionsPerTurn,
    actionsTaken: [],
    turnEnded: false,
  };
}

/** 根据角度获取护甲象限 */
export function getArmorQuadrantFromAngle(
  angle: number,
  isTop: boolean
): keyof ArmorInstanceState['quadrants'] {
  // 标准化角度到 -180 到 180
  let normalizedAngle = ((angle % 360) + 360) % 360;
  if (normalizedAngle > 180) normalizedAngle -= 360;

  // 根据角度确定象限
  // 前方: -60 到 60 度
  // 左侧: 60 到 180 度
  // 右侧: -180 到 -60 度
  if (normalizedAngle >= -60 && normalizedAngle <= 60) {
    return isTop ? 'FRONT_TOP' : 'FRONT_BOTTOM';
  } else if (normalizedAngle > 60 && normalizedAngle <= 180) {
    return isTop ? 'LEFT_TOP' : 'LEFT_BOTTOM';
  } else {
    return isTop ? 'RIGHT_TOP' : 'RIGHT_BOTTOM';
  }
}

/** 计算护甲伤害减免 */
export function calculateArmorDamageReduction(
  armor: ArmorInstanceState,
  quadrant: keyof ArmorInstanceState['quadrants'],
  incomingDamage: number
): number {
  const quadrantArmor = armor.quadrants[quadrant];
  const baseArmor = armor.baseArmorRating ?? quadrantArmor;

  // Starsector 护甲伤害减免公式
  // 伤害减免 = armor / (armor + damage * 0.5)
  // 但至少造成 10% 伤害
  const reduction = baseArmor / (baseArmor + incomingDamage * 0.5);
  const maxReduction = 0.9; // 最多减免 90%

  return Math.min(reduction, maxReduction);
}

/** 检查是否可以开始散热 */
export function canStartVenting(flux: FluxInstanceState): boolean {
  return (
    flux.state === 'normal' &&
    flux.current > 0 &&
    !flux.overloadTimeRemaining
  );
}

/** 检查是否过载 */
export function isOverloaded(flux: FluxInstanceState): boolean {
  return flux.state === 'overloaded' || flux.overloadTimeRemaining > 0;
}

/** 重置行动点状态 */
export function resetActionsState(state: ActionsState): ActionsState {
  return {
    ...state,
    remainingActions: state.actionsPerTurn,
    actionsTaken: [],
    turnEnded: false,
  };
}