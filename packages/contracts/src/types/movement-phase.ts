/**
 * 三阶段移动类型定义
 *
 * 实现基于 Starsector 的三阶段移动系统：
 * - 阶段1 (平移A)：沿当前 Heading 前进/后退（最大 2X），或沿中轴线切线横移（最大 X）
 * - 阶段2 (转向)：原地旋转，最大角度为 Y
 * - 阶段3 (平移B)：沿新朝向前进/后退或横移
 */

import { z } from 'zod';

// ==================== 移动阶段 Schema ====================

/** 移动阶段枚举 */
export const MovementPhaseSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
]);

/** 移动类型枚举 */
export const MovementTypeSchema = z.enum([
  'straight',   // 直线前进
  'strafe',     // 横移
  'rotate',     // 原地旋转
]);

/** 单次移动动作 Schema */
export const MovementActionSchema = z.object({
  /** 移动类型 */
  type: MovementTypeSchema,
  /** 移动距离（直线/横移时使用） */
  distance: z.number().min(0).optional(),
  /** 旋转角度（转向时使用） */
  angle: z.number().optional(),
  /** 移动后的X坐标 */
  newX: z.number(),
  /** 移动后的Y坐标 */
  newY: z.number(),
  /** 移动后的朝向 */
  newHeading: z.number(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 移动状态 Schema - 支持三阶段移动 */
export const MovementStateSchema = z.object({
  /** 基础航速 X */
  maxSpeed: z.number().min(0),
  /** 最大转向角度 Y */
  maxTurnRate: z.number().min(0),
  /** 当前移动阶段 (1 | 2 | 3) */
  currentPhase: MovementPhaseSchema,
  /** 阶段1是否完成（平移A） */
  phase1Complete: z.boolean().default(false),
  /** 阶段2是否完成（转向） */
  phase2Complete: z.boolean().default(false),
  /** 阶段3是否完成（平移B） */
  phase3Complete: z.boolean().default(false),
  /** 剩余移动距离 */
  remainingSpeed: z.number().min(0),
  /** 剩余转向角度 */
  remainingTurn: z.number().min(0),
  /** 当前回合的移动历史 */
  movementHistory: z.array(MovementActionSchema).default([]),
});

/** 移动阶段配置 Schema */
export const MovementPhaseConfigSchema = z.object({
  /** 阶段1最大转向角度比例（相对于maxTurnRate） */
  phase1TurnRatio: z.number().min(0).max(1).default(1),
  /** 阶段2最大移动距离比例（相对于maxSpeed） */
  phase2SpeedRatio: z.number().min(0).max(1).default(1),
  /** 阶段3最大转向角度比例（相对于maxTurnRate） */
  phase3TurnRatio: z.number().min(0).max(1).default(1),
});

// ==================== 类型推导 ====================

export type MovementPhase = z.infer<typeof MovementPhaseSchema>;
export type MovementType = z.infer<typeof MovementTypeSchema>;
export type MovementAction = z.infer<typeof MovementActionSchema>;
export type MovementState = z.infer<typeof MovementStateSchema>;
export type MovementPhaseConfig = z.infer<typeof MovementPhaseConfigSchema>;

// ==================== 工具函数 ====================

/** 创建默认移动状态 */
export function createDefaultMovementState(
  maxSpeed: number,
  maxTurnRate: number
): MovementState {
  return {
    maxSpeed,
    maxTurnRate,
    currentPhase: 1,
    phase1Complete: false,
    phase2Complete: false,
    phase3Complete: false,
    remainingSpeed: maxSpeed,
    remainingTurn: maxTurnRate,
    movementHistory: [],
  };
}

/** 重置移动状态（新回合开始时调用） */
export function resetMovementState(state: MovementState): MovementState {
  return {
    ...state,
    currentPhase: 1,
    phase1Complete: false,
    phase2Complete: false,
    phase3Complete: false,
    remainingSpeed: state.maxSpeed,
    remainingTurn: state.maxTurnRate,
    movementHistory: [],
  };
}

/** 检查是否可以执行指定阶段的移动 */
export function canExecutePhase(
  state: MovementState,
  phase: MovementPhase
): boolean {
  switch (phase) {
    case 1:
      return !state.phase1Complete;
    case 2:
      return state.phase1Complete && !state.phase2Complete;
    case 3:
      return state.phase1Complete && state.phase2Complete && !state.phase3Complete;
    default:
      return false;
  }
}

/** 获取当前可用的移动资源 */
export function getAvailableMovementResources(state: MovementState): {
  availableSpeed: number;
  availableTurn: number;
} {
  switch (state.currentPhase) {
    case 1:
      // 阶段1 (平移A)：只有移动资源
      return {
        availableSpeed: state.remainingSpeed,
        availableTurn: 0,
      };
    case 2:
      // 阶段2 (转向)：只有转向资源
      return {
        availableSpeed: 0,
        availableTurn: state.remainingTurn,
      };
    case 3:
      // 阶段3 (平移B)：只有移动资源
      return {
        availableSpeed: state.remainingSpeed,
        availableTurn: 0,
      };
    default:
      return {
        availableSpeed: 0,
        availableTurn: 0,
      };
  }
}