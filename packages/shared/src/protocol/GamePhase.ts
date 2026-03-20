/**
 * 游戏阶段定义
 *
 * 定义游戏流程状态机和阶段转换
 */

import { z } from 'zod';
import { FactionIdSchema } from '../core-types.js';

// ==================== 游戏阶段 Schema ====================

/**
 * 游戏主阶段
 */
export const GamePhaseSchema = z.enum([
  'lobby',       // 大厅等待
  'deployment',  // 部署阶段
  'playing',     // 游戏进行中
  'paused',      // 暂停
  'ended',       // 游戏结束
]);

/**
 * 回合内阶段
 */
export const TurnPhaseSchema = z.enum([
  'player_action',   // 玩家行动阶段
  'dm_action',       // DM操作敌人行动阶段
  'resolution',      // 回合结算阶段
]);

/**
 * 行动类型
 */
export const ShipActionTypeSchema = z.enum([
  'move',            // 移动
  'rotate',          // 转向
  'fire',            // 开火
  'shield_toggle',   // 护盾切换
  'vent',            // 主动排散
  'overload_reset',  // 解除过载
]);

/**
 * 行动限制原因
 */
export const ActionRestrictionReasonSchema = z.enum([
  'overloaded',           // 过载中
  'venting',              // 主动排散中
  'fired_this_turn',      // 本回合已开火（影响排散）
  'not_your_turn',        // 不是你的回合
  'not_your_ship',        // 不是你的舰船
  'no_actions_remaining', // 无剩余行动次数
  'shield_active',        // 护盾已激活（影响排散）
]);

// ==================== 游戏状态 Schema ====================

/**
 * 游戏流程状态
 */
export const GameFlowStateSchema = z.object({
  phase: GamePhaseSchema,
  turnPhase: TurnPhaseSchema,
  roundNumber: z.number().int().min(1),
  currentFaction: FactionIdSchema.optional(),
  deploymentReady: z.record(FactionIdSchema, z.boolean()), // 各阵营部署完成状态
  startedAt: z.number(),
  pausedAt: z.number().optional(),
  endedAt: z.number().optional(),
  winner: FactionIdSchema.optional(),
});

/**
 * 舰船行动状态
 */
export const ShipActionStateSchema = z.object({
  shipId: z.string(),
  hasMoved: z.boolean(),
  hasRotated: z.boolean(),
  hasFired: z.boolean(),
  hasToggledShield: z.boolean(),
  hasVented: z.boolean(),
  isOverloaded: z.boolean(),
  overloadResetAvailable: z.boolean(), // 是否可解除过载
  remainingActions: z.number().int().min(0),
  movementRemaining: z.number().min(0),
});

/**
 * 行动请求
 */
export const ActionRequestSchema = z.object({
  shipId: z.string(),
  actionType: ShipActionTypeSchema,
  actionData: z.record(z.string(), z.unknown()).optional(),
});

/**
 * 行动结果
 */
export const ActionResultSchema = z.object({
  success: z.boolean(),
  actionType: ShipActionTypeSchema,
  shipId: z.string(),
  newState: ShipActionStateSchema.optional(),
  error: z.string().optional(),
  restrictionReason: ActionRestrictionReasonSchema.optional(),
});

// ==================== 类型推导 ====================

export type GamePhase = z.infer<typeof GamePhaseSchema>;
export type TurnPhase = z.infer<typeof TurnPhaseSchema>;
export type ShipActionType = z.infer<typeof ShipActionTypeSchema>;
export type ActionRestrictionReason = z.infer<typeof ActionRestrictionReasonSchema>;
export type GameFlowState = z.infer<typeof GameFlowStateSchema>;
export type ShipActionState = z.infer<typeof ShipActionStateSchema>;
export type ActionRequest = z.infer<typeof ActionRequestSchema>;
export type ActionResult = z.infer<typeof ActionResultSchema>;

// ==================== 阶段转换规则 ====================

/**
 * 有效阶段转换映射
 */
export const VALID_PHASE_TRANSITIONS: Record<GamePhase, GamePhase[]> = {
  lobby: ['deployment'],
  deployment: ['playing', 'lobby'],
  playing: ['paused', 'ended'],
  paused: ['playing', 'ended'],
  ended: [],
};

/**
 * 回合内阶段转换顺序
 */
export const TURN_PHASE_ORDER: TurnPhase[] = [
  'player_action',
  'dm_action',
  'resolution',
];

/**
 * 检查阶段转换是否有效
 */
export function isValidPhaseTransition(from: GamePhase, to: GamePhase): boolean {
  return VALID_PHASE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * 获取下一个回合阶段
 */
export function getNextTurnPhase(current: TurnPhase): TurnPhase | null {
  const currentIndex = TURN_PHASE_ORDER.indexOf(current);
  if (currentIndex === -1 || currentIndex >= TURN_PHASE_ORDER.length - 1) {
    return null;
  }
  return TURN_PHASE_ORDER[currentIndex + 1];
}

// ==================== 行动限制规则 ====================

/**
 * 行动限制规则定义
 */
export const ACTION_RESTRICTIONS: Record<ShipActionType, {
  requiresNormalState: boolean;
  blockedByOverload: boolean;
  blockedByVenting: boolean;
  blocksOtherActions: ShipActionType[];
}> = {
  move: {
    requiresNormalState: true,
    blockedByOverload: true,
    blockedByVenting: true,
    blocksOtherActions: [],
  },
  rotate: {
    requiresNormalState: true,
    blockedByOverload: true,
    blockedByVenting: true,
    blocksOtherActions: [],
  },
  fire: {
    requiresNormalState: true,
    blockedByOverload: true,
    blockedByVenting: true,
    blocksOtherActions: ['vent'], // 开火后禁用主动排散
  },
  shield_toggle: {
    requiresNormalState: false,
    blockedByOverload: true, // 过载时护盾强制关闭
    blockedByVenting: true,  // 排散时禁用护盾
    blocksOtherActions: [],
  },
  vent: {
    requiresNormalState: true,
    blockedByOverload: true,
    blockedByVenting: false,
    blocksOtherActions: ['fire', 'shield_toggle'], // 排散时禁用开火和护盾
  },
  overload_reset: {
    requiresNormalState: false,
    blockedByOverload: false, // 专门用于解除过载
    blockedByVenting: true,
    blocksOtherActions: [],
  },
};

/**
 * 检查行动是否被限制
 */
export function isActionRestricted(
  actionType: ShipActionType,
  shipState: {
    isOverloaded: boolean;
    isVenting: boolean;
    hasFiredThisTurn: boolean;
  }
): { restricted: boolean; reason?: ActionRestrictionReason } {
  const rules = ACTION_RESTRICTIONS[actionType];

  if (rules.blockedByOverload && shipState.isOverloaded) {
    // 解除过载是唯一允许的行动
    if (actionType !== 'overload_reset') {
      return { restricted: true, reason: 'overloaded' };
    }
  }

  if (rules.blockedByVenting && shipState.isVenting) {
    return { restricted: true, reason: 'venting' };
  }

  // 开火后禁用主动排散
  if (actionType === 'vent' && shipState.hasFiredThisTurn) {
    return { restricted: true, reason: 'fired_this_turn' };
  }

  return { restricted: false };
}