/**
 * 战斗交互消息协议
 *
 * 定义战斗阶段的所有消息类型：
 * - 目标选择
 * - 武器选择
 * - 象限选择
 * - 攻击预览与确认
 * - 伤害结果
 */

import { z } from 'zod';
import { PointSchema, ArmorQuadrantSchema } from '../core-types.js';
import { DamageTypeSchema } from '../config/schemas.js';

// ==================== 战斗消息类型常量 ====================

export const COMBAT_MESSAGE_TYPES = {
  // 目标选择
  SELECT_TARGET: 'SELECT_TARGET',
  TARGET_SELECTED: 'TARGET_SELECTED',
  CLEAR_TARGET: 'CLEAR_TARGET',

  // 武器选择
  SELECT_WEAPON: 'SELECT_WEAPON',
  WEAPON_SELECTED: 'WEAPON_SELECTED',
  CLEAR_WEAPON: 'CLEAR_WEAPON',

  // 象限选择
  SELECT_QUADRANT: 'SELECT_QUADRANT',
  QUADRANT_SELECTED: 'QUADRANT_SELECTED',
  CLEAR_QUADRANT: 'CLEAR_QUADRANT',

  // 攻击流程
  ATTACK_PREVIEW_REQUEST: 'ATTACK_PREVIEW_REQUEST',
  ATTACK_PREVIEW_RESULT: 'ATTACK_PREVIEW_RESULT',
  CONFIRM_ATTACK: 'CONFIRM_ATTACK',
  ATTACK_RESULT: 'ATTACK_RESULT',

  // 伤害事件
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  SHIP_DESTROYED: 'SHIP_DESTROYED',

  // 辐能系统
  VENT_FLUX: 'VENT_FLUX',
  VENT_FLUX_RESULT: 'VENT_FLUX_RESULT',
  OVERLOAD_TRIGGERED: 'OVERLOAD_TRIGGERED',
  OVERLOAD_RECOVERED: 'OVERLOAD_RECOVERED',

  // 护盾控制
  TOGGLE_SHIELD: 'TOGGLE_SHIELD',
  SHIELD_TOGGLED: 'SHIELD_TOGGLED',
} as const;

export type CombatMessageType = typeof COMBAT_MESSAGE_TYPES[keyof typeof COMBAT_MESSAGE_TYPES];

// ==================== 目标选择 Schema ====================

/** 目标选择请求 Schema */
export const SelectTargetRequestSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 目标Token ID */
  targetId: z.string().min(1),
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 目标选中消息 Schema */
export const TargetSelectedSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 目标Token ID */
  targetId: z.string().min(1),
  /** 目标信息 */
  targetInfo: z.object({
    id: z.string(),
    name: z.string().optional(),
    hullSize: z.enum(['FIGHTER', 'FRIGATE', 'DESTROYER', 'CRUISER', 'CAPITAL']).optional(),
    position: PointSchema,
    heading: z.number(),
    distance: z.number(),
  }).optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 清除目标 Schema */
export const ClearTargetSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 武器选择 Schema ====================

/** 武器选择请求 Schema */
export const SelectWeaponRequestSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string().min(1),
  /** 武器实例ID */
  weaponInstanceId: z.string().min(1),
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 武器选中消息 Schema */
export const WeaponSelectedSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string().min(1),
  /** 武器实例ID */
  weaponInstanceId: z.string().min(1),
  /** 武器信息 */
  weaponInfo: z.object({
    instanceId: z.string(),
    weaponId: z.string(),
    name: z.string(),
    damageType: DamageTypeSchema,
    baseDamage: z.number(),
    range: z.number(),
    arc: z.number(),
    fluxCostPerShot: z.number(),
    state: z.enum(['ready', 'cooldown', 'charging', 'reloading', 'disabled', 'out_of_ammo']),
    canFire: z.boolean(),
  }).optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 清除武器选择 Schema */
export const ClearWeaponSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string().min(1),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 象限选择 Schema ====================

/** 象限选择请求 Schema */
export const SelectQuadrantRequestSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 目标Token ID */
  targetId: z.string().min(1),
  /** 选择的象限 */
  quadrant: ArmorQuadrantSchema,
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 象限选中消息 Schema */
export const QuadrantSelectedSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 目标Token ID */
  targetId: z.string().min(1),
  /** 选择的象限 */
  quadrant: ArmorQuadrantSchema,
  /** 象限信息 */
  quadrantInfo: z.object({
    quadrant: ArmorQuadrantSchema,
    currentArmor: z.number(),
    maxArmor: z.number(),
    armorPercent: z.number(),
  }).optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 清除象限选择 Schema */
export const ClearQuadrantSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 攻击预览 Schema ====================

/** 攻击预览请求 Schema */
export const AttackPreviewRequestSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 目标Token ID */
  targetId: z.string().min(1),
  /** 武器实例ID */
  weaponInstanceId: z.string().min(1),
  /** 目标象限（可选，不指定则自动计算） */
  targetQuadrant: ArmorQuadrantSchema.optional(),
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 攻击预览结果 Schema */
export const AttackPreviewResultSchema = z.object({
  /** 是否可以攻击 */
  canAttack: z.boolean(),
  /** 攻击者ID */
  attackerId: z.string(),
  /** 目标ID */
  targetId: z.string(),
  /** 武器实例ID */
  weaponInstanceId: z.string(),

  // 预览数据
  preview: z.object({
    /** 基础伤害 */
    baseDamage: z.number(),
    /** 预计护盾吸收 */
    estimatedShieldAbsorb: z.number(),
    /** 预计护甲减免 */
    estimatedArmorReduction: z.number(),
    /** 预计船体伤害 */
    estimatedHullDamage: z.number(),
    /** 命中象限 */
    hitQuadrant: ArmorQuadrantSchema,
    /** 辐能消耗 */
    fluxCost: z.number(),
    /** 是否会产生硬辐能 */
    willGenerateHardFlux: z.boolean(),
    /** 预计硬辐能 */
    estimatedHardFlux: z.number().optional(),
  }).optional(),

  // 阻止原因
  blockReason: z.enum([
    'OUT_OF_RANGE',
    'NOT_IN_ARC',
    'WEAPON_NOT_READY',
    'NOT_ENOUGH_FLUX_CAPACITY',
    'TARGET_IS_ALLY',
    'SHIP_IS_OVERLOADED',
    'SHIP_IS_VENTING',
    'ALREADY_FIRED_THIS_TURN',
  ]).optional(),

  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 攻击确认与结果 Schema ====================

/** 确认攻击请求 Schema */
export const ConfirmAttackRequestSchema = z.object({
  /** 攻击者Token ID */
  attackerId: z.string().min(1),
  /** 目标Token ID */
  targetId: z.string().min(1),
  /** 武器实例ID */
  weaponInstanceId: z.string().min(1),
  /** 目标象限（可选） */
  targetQuadrant: ArmorQuadrantSchema.optional(),
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 攻击结果 Schema */
export const AttackResultSchema = z.object({
  /** 攻击是否成功 */
  success: z.boolean(),
  /** 攻击者ID */
  attackerId: z.string(),
  /** 目标ID */
  targetId: z.string(),
  /** 武器实例ID */
  weaponInstanceId: z.string(),

  // 伤害详情
  damage: z.object({
    /** 是否命中 */
    hit: z.boolean(),
    /** 基础伤害 */
    baseDamage: z.number(),
    /** 护盾吸收 */
    shieldAbsorbed: z.number(),
    /** 护甲减免 */
    armorReduced: z.number(),
    /** 船体伤害 */
    hullDamage: z.number(),
    /** EMP伤害 */
    empDamage: z.number().optional(),
    /** 命中象限 */
    hitQuadrant: ArmorQuadrantSchema.optional(),
  }).optional(),

  // 辐能变化
  flux: z.object({
    /** 攻击者产生的软辐能 */
    attackerSoftFlux: z.number(),
    /** 目标产生的硬辐能（护盾吸收） */
    targetHardFlux: z.number().optional(),
  }).optional(),

  // 目标状态变化
  targetState: z.object({
    /** 护盾HP变化 */
    shieldChange: z.number().optional(),
    /** 护甲变化（按象限） */
    armorChanges: z.record(z.string(), z.number()).optional(),
    /** 船体HP变化 */
    hullChange: z.number().optional(),
    /** 是否被摧毁 */
    destroyed: z.boolean().optional(),
  }).optional(),

  // 错误信息
  error: z.string().optional(),

  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 伤害事件 Schema ====================

/** 伤害事件 Schema */
export const DamageDealtEventSchema = z.object({
  /** 来源Token ID */
  sourceId: z.string(),
  /** 目标Token ID */
  targetId: z.string(),
  /** 武器实例ID */
  weaponInstanceId: z.string(),
  /** 武器定义ID */
  weaponId: z.string(),
  /** 伤害类型 */
  damageType: DamageTypeSchema,
  /** 是否命中 */
  hit: z.boolean(),
  /** 基础伤害 */
  baseDamage: z.number().optional(),
  /** 护盾吸收 */
  shieldAbsorbed: z.number(),
  /** 护甲减免 */
  armorReduced: z.number(),
  /** 船体伤害 */
  hullDamage: z.number(),
  /** 命中象限 */
  hitQuadrant: ArmorQuadrantSchema.optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 舰船摧毁事件 Schema */
export const ShipDestroyedEventSchema = z.object({
  /** 被摧毁的Token ID */
  tokenId: z.string(),
  /** 击杀者Token ID */
  killerId: z.string().optional(),
  /** 击杀者阵营 */
  killerFaction: z.string().optional(),
  /** 摧毁原因 */
  reason: z.enum(['hull_destroyed', 'explosion', 'scenario']),
  /** 最终一击的伤害来源 */
  finalBlow: z.object({
    weaponId: z.string(),
    damageType: DamageTypeSchema,
    damage: z.number(),
  }).optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 辐能系统 Schema ====================

/** 散热请求 Schema */
export const VentFluxRequestSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string().min(1),
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 散热结果 Schema */
export const VentFluxResultSchema = z.object({
  success: z.boolean(),
  /** 舰船Token ID */
  shipId: z.string(),
  /** 当前辐能 */
  currentFlux: z.number().optional(),
  /** 散热速度 */
  ventRate: z.number().optional(),
  /** 预计散热时间 */
  estimatedDuration: z.number().optional(),
  /** 错误原因 */
  error: z.enum([
    'NO_FLUX_TO_VENT',
    'ALREADY_VENTING',
    'OVERLOADED',
    'NOT_YOUR_SHIP',
  ]).optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 过载触发事件 Schema */
export const OverloadTriggeredEventSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string(),
  /** 过载时的辐能值 */
  fluxAtOverload: z.number(),
  /** 过载持续时间 */
  overloadDuration: z.number(),
  /** 时间戳 */
  timestamp: z.number(),
});

/** 过载恢复事件 Schema */
export const OverloadRecoveredEventSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string(),
  /** 恢复后的辐能值 */
  fluxAfterRecovery: z.number(),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 护盾控制 Schema ====================

/** 护盾切换请求 Schema */
export const ToggleShieldRequestSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string().min(1),
  /** 目标状态（可选，不指定则切换） */
  targetState: z.enum(['on', 'off']).optional(),
  /** 请求者ID */
  requesterId: z.string().min(1),
});

/** 护盾切换结果 Schema */
export const ShieldToggledEventSchema = z.object({
  /** 舰船Token ID */
  shipId: z.string(),
  /** 护盾是否激活 */
  active: z.boolean(),
  /** 护盾类型 */
  shieldType: z.enum(['FRONT', 'OMNI', 'NONE']),
  /** 护盾HP */
  shieldHp: z.number().optional(),
  /** 最大护盾HP */
  maxShieldHp: z.number().optional(),
  /** 时间戳 */
  timestamp: z.number(),
});

// ==================== 类型推导 ====================

export type SelectTargetRequest = z.infer<typeof SelectTargetRequestSchema>;
export type TargetSelected = z.infer<typeof TargetSelectedSchema>;
export type ClearTarget = z.infer<typeof ClearTargetSchema>;
export type SelectWeaponRequest = z.infer<typeof SelectWeaponRequestSchema>;
export type WeaponSelected = z.infer<typeof WeaponSelectedSchema>;
export type ClearWeapon = z.infer<typeof ClearWeaponSchema>;
export type SelectQuadrantRequest = z.infer<typeof SelectQuadrantRequestSchema>;
export type QuadrantSelected = z.infer<typeof QuadrantSelectedSchema>;
export type ClearQuadrant = z.infer<typeof ClearQuadrantSchema>;
export type AttackPreviewRequest = z.infer<typeof AttackPreviewRequestSchema>;
export type AttackPreviewResult = z.infer<typeof AttackPreviewResultSchema>;
export type ConfirmAttackRequest = z.infer<typeof ConfirmAttackRequestSchema>;
export type AttackResult = z.infer<typeof AttackResultSchema>;
export type DamageDealtEvent = z.infer<typeof DamageDealtEventSchema>;
export type ShipDestroyedEvent = z.infer<typeof ShipDestroyedEventSchema>;
export type VentFluxRequest = z.infer<typeof VentFluxRequestSchema>;
export type VentFluxResult = z.infer<typeof VentFluxResultSchema>;
export type OverloadTriggeredEvent = z.infer<typeof OverloadTriggeredEventSchema>;
export type OverloadRecoveredEvent = z.infer<typeof OverloadRecoveredEventSchema>;
export type ToggleShieldRequest = z.infer<typeof ToggleShieldRequestSchema>;
export type ShieldToggledEvent = z.infer<typeof ShieldToggledEventSchema>;

// ==================== 消息定义 ====================

/** 战斗消息目录 */
export const CombatMessageDirectory = {
  // 目标选择
  selectTarget: {
    operation: 'combat.selectTarget',
    requestSchema: SelectTargetRequestSchema,
    responseSchema: TargetSelectedSchema,
    description: '选择攻击目标',
  },
  clearTarget: {
    operation: 'combat.clearTarget',
    requestSchema: z.object({ attackerId: z.string() }),
    responseSchema: ClearTargetSchema,
    description: '清除目标选择',
  },

  // 武器选择
  selectWeapon: {
    operation: 'combat.selectWeapon',
    requestSchema: SelectWeaponRequestSchema,
    responseSchema: WeaponSelectedSchema,
    description: '选择武器',
  },
  clearWeapon: {
    operation: 'combat.clearWeapon',
    requestSchema: z.object({ shipId: z.string() }),
    responseSchema: ClearWeaponSchema,
    description: '清除武器选择',
  },

  // 象限选择
  selectQuadrant: {
    operation: 'combat.selectQuadrant',
    requestSchema: SelectQuadrantRequestSchema,
    responseSchema: QuadrantSelectedSchema,
    description: '选择攻击象限',
  },
  clearQuadrant: {
    operation: 'combat.clearQuadrant',
    requestSchema: z.object({ attackerId: z.string() }),
    responseSchema: ClearQuadrantSchema,
    description: '清除象限选择',
  },

  // 攻击流程
  requestAttackPreview: {
    operation: 'combat.attackPreview',
    requestSchema: AttackPreviewRequestSchema,
    responseSchema: AttackPreviewResultSchema,
    description: '请求攻击预览',
  },
  confirmAttack: {
    operation: 'combat.confirmAttack',
    requestSchema: ConfirmAttackRequestSchema,
    responseSchema: AttackResultSchema,
    description: '确认攻击',
  },

  // 辐能系统
  ventFlux: {
    operation: 'combat.ventFlux',
    requestSchema: VentFluxRequestSchema,
    responseSchema: VentFluxResultSchema,
    description: '开始散热',
  },

  // 护盾控制
  toggleShield: {
    operation: 'combat.toggleShield',
    requestSchema: ToggleShieldRequestSchema,
    responseSchema: ShieldToggledEventSchema,
    description: '切换护盾状态',
  },

  // 广播消息
  damageDealt: {
    type: 'DAMAGE_DEALT',
    schema: DamageDealtEventSchema,
    direction: 'broadcast' as const,
    description: '伤害事件',
  },
  shipDestroyed: {
    type: 'SHIP_DESTROYED',
    schema: ShipDestroyedEventSchema,
    direction: 'broadcast' as const,
    description: '舰船摧毁事件',
  },
  overloadTriggered: {
    type: 'OVERLOAD_TRIGGERED',
    schema: OverloadTriggeredEventSchema,
    direction: 'broadcast' as const,
    description: '过载触发事件',
  },
  overloadRecovered: {
    type: 'OVERLOAD_RECOVERED',
    schema: OverloadRecoveredEventSchema,
    direction: 'broadcast' as const,
    description: '过载恢复事件',
  },
} as const;

// ==================== 工具函数 ====================

/** 伤害类型修正系数 */
export const DAMAGE_MODIFIERS = {
  KINETIC: {
    shield: 2.0,
    armor: 0.5,
    hull: 1.0,
    armorPenetration: 0.5,
  },
  HIGH_EXPLOSIVE: {
    shield: 0.5,
    armor: 2.0,
    hull: 1.0,
    armorPenetration: 2.0,
  },
  FRAGMENTATION: {
    shield: 0.25,
    armor: 0.25,
    hull: 1.0,
    armorPenetration: 0.25,
  },
  ENERGY: {
    shield: 1.0,
    armor: 1.0,
    hull: 1.0,
    armorPenetration: 1.0,
  },
} as const;

/** 最大减伤比例 */
export const MAX_DAMAGE_REDUCTION = 0.85;

/** 最小伤害比例 */
export const MIN_DAMAGE_RATIO = 0.15;

/** 计算伤害修正 */
export function calculateDamageModifier(
  damageType: keyof typeof DAMAGE_MODIFIERS,
  target: 'shield' | 'armor' | 'hull'
): number {
  return DAMAGE_MODIFIERS[damageType]?.[target] ?? 1.0;
}

/** 计算护甲减伤 */
export function calculateArmorDamageReduction(
  armorValue: number,
  incomingDamage: number,
  armorPenetration: number
): number {
  const effectiveDamage = incomingDamage * armorPenetration;
  const reduction = armorValue / (armorValue + effectiveDamage);
  return Math.min(reduction, MAX_DAMAGE_REDUCTION);
}