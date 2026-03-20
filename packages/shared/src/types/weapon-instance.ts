/**
 * 武器实例类型定义
 *
 * 定义舰船上装备的武器实例状态，包括：
 * - 武器配置引用
 * - 当前状态（冷却、弹药等）
 * - 射击能力
 */

import { z } from 'zod';
import {
  WeaponCategorySchema,
  DamageTypeSchema,
  MountTypeSchema,
} from '../config/schemas.js';

// ==================== 武器实例 Schema ====================

/** 武器状态枚举 */
export const WeaponStatusSchema = z.enum([
  'ready',      // 就绪，可以射击
  'cooldown',   // 冷却中
  'charging',   // 充能中（光束武器等）
  'reloading',  // 装填中（弹药类武器）
  'disabled',   // 被禁用（EMP等）
  'out_of_ammo', // 弹药耗尽
]);

/** 武器挂载点实例 Schema */
export const WeaponMountInstanceSchema = z.object({
  /** 挂载点唯一ID */
  id: z.string().min(1),
  /** 挂载点类型 */
  mountType: MountTypeSchema,
  /** 挂载点位置（相对于舰船中心） */
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  /** 当前朝向（角度） */
  facing: z.number(),
  /** 射界最小角度 */
  arcMin: z.number(),
  /** 射界最大角度 */
  arcMax: z.number(),
  /** 射界范围 */
  arc: z.number().min(0).max(360),
});

/** 武器实例 Schema */
export const WeaponInstanceStateSchema = z.object({
  /** 武器实例唯一ID */
  instanceId: z.string().min(1),
  /** 武器定义ID（引用 WeaponDefinition） */
  weaponId: z.string().min(1),
  /** 挂载点ID */
  mountId: z.string().min(1),

  // 武器属性快照（从定义复制，可能被改装件修改）
  /** 武器名称 */
  name: z.string().min(1),
  /** 武器类别 */
  category: WeaponCategorySchema,
  /** 伤害类型 */
  damageType: DamageTypeSchema,
  /** 基础伤害 */
  baseDamage: z.number().min(0),
  /** EMP伤害 */
  empDamage: z.number().min(0).default(0),
  /** 射程 */
  range: z.number().min(0),
  /** 射界 */
  arc: z.number().min(0).max(360),
  /** 炮塔转向速度 */
  turnRate: z.number().min(0).default(0),

  // 资源消耗
  /** 每次射击flux消耗 */
  fluxCostPerShot: z.number().min(0),
  /** 最大弹药（导弹/弹道武器） */
  maxAmmo: z.number().min(0).optional(),
  /** 每次射击消耗弹药 */
  ammoPerShot: z.number().min(1).default(1),

  // 射击参数
  /** 冷却时间（秒） */
  cooldown: z.number().min(0),
  /** 充能时间（秒） */
  chargeTime: z.number().min(0).default(0),
  /** 连发数量 */
  burstSize: z.number().min(1).default(1),
  /** 连发间隔（秒） */
  burstDelay: z.number().min(0).default(0),

  // 当前状态
  /** 武器状态 */
  state: WeaponStatusSchema,
  /** 当前冷却剩余时间（秒） */
  cooldownRemaining: z.number().min(0).default(0),
  /** 当前充能进度 (0-1) */
  chargeProgress: z.number().min(0).max(1).default(0),
  /** 当前弹药量 */
  currentAmmo: z.number().min(0).optional(),
  /** 当前朝向（角度） */
  currentFacing: z.number(),
  /** 目标朝向（角度，用于炮塔转向） */
  targetFacing: z.number().optional(),

  // 特殊效果
  /** 是否制导 */
  isGuided: z.boolean().default(false),
  /** 是否追踪 */
  isHoming: z.boolean().default(false),
  /** 是否光束武器 */
  isBeam: z.boolean().default(false),
  /** 范围伤害半径 */
  areaEffectRadius: z.number().min(0).default(0),

  // 本回合状态
  /** 本回合是否已射击 */
  hasFiredThisTurn: z.boolean().default(false),
  /** 本回合射击次数 */
  shotsFiredThisTurn: z.number().min(0).default(0),
});

/** 武器组 Schema */
export const WeaponGroupSchema = z.object({
  /** 武器组ID */
  id: z.string().min(1),
  /** 武器组名称 */
  name: z.string().min(1),
  /** 包含的武器实例ID列表 */
  weaponInstanceIds: z.array(z.string()).default([]),
  /** 是否自动开火 */
  autoFire: z.boolean().default(false),
  /** 交替射击模式 */
  alternating: z.boolean().default(false),
});

/** 舰船武器系统 Schema */
export const ShipWeaponSystemSchema = z.object({
  /** 所有武器实例 */
  weapons: z.record(z.string(), WeaponInstanceStateSchema),
  /** 所有挂载点 */
  mounts: z.record(z.string(), WeaponMountInstanceSchema),
  /** 武器组配置 */
  groups: z.array(WeaponGroupSchema).default([]),
  /** 当前选中的武器组索引 */
  activeGroupIndex: z.number().min(0).default(0),
});

// ==================== 类型推导 ====================

export type WeaponStatus = z.infer<typeof WeaponStatusSchema>;
export type WeaponInstanceState = z.infer<typeof WeaponInstanceStateSchema>;
export type WeaponMountInstance = z.infer<typeof WeaponMountInstanceSchema>;
export type WeaponGroup = z.infer<typeof WeaponGroupSchema>;
export type ShipWeaponSystem = z.infer<typeof ShipWeaponSystemSchema>;

// ==================== 工具函数 ====================

/** 创建默认武器实例 */
export function createDefaultWeaponInstance(
  instanceId: string,
  weaponId: string,
  mountId: string,
  name: string,
  category: z.infer<typeof WeaponCategorySchema>,
  damageType: z.infer<typeof DamageTypeSchema>,
  baseDamage: number,
  range: number,
  arc: number,
  fluxCostPerShot: number,
  cooldown: number,
  initialFacing: number
): WeaponInstanceState {
  return {
    instanceId,
    weaponId,
    mountId,
    name,
    category,
    damageType,
    baseDamage,
    empDamage: 0,
    range,
    arc,
    turnRate: 0,
    fluxCostPerShot,
    ammoPerShot: 1,
    cooldown,
    chargeTime: 0,
    burstSize: 1,
    burstDelay: 0,
    state: 'ready',
    cooldownRemaining: 0,
    chargeProgress: 0,
    currentFacing: initialFacing,
    isGuided: false,
    isHoming: false,
    isBeam: false,
    areaEffectRadius: 0,
    hasFiredThisTurn: false,
    shotsFiredThisTurn: 0,
  };
}

/** 检查武器是否可以射击 */
export function canWeaponFire(weapon: WeaponInstanceState): boolean {
  if (weapon.state !== 'ready') return false;
  if (weapon.hasFiredThisTurn) return false;
  if (weapon.currentAmmo !== undefined && weapon.currentAmmo <= 0) return false;
  return true;
}

/** 计算武器对目标的伤害 */
export function calculateWeaponDamage(
  weapon: WeaponInstanceState,
  shieldEfficiency: number = 1,
  armorEfficiency: number = 1,
  hullEfficiency: number = 1
): {
  shieldDamage: number;
  armorDamage: number;
  hullDamage: number;
  empDamage: number;
} {
  return {
    shieldDamage: weapon.baseDamage * shieldEfficiency,
    armorDamage: weapon.baseDamage * armorEfficiency,
    hullDamage: weapon.baseDamage * hullEfficiency,
    empDamage: weapon.empDamage,
  };
}

/** 重置武器回合状态 */
export function resetWeaponTurnState(weapon: WeaponInstanceState): WeaponInstanceState {
  return {
    ...weapon,
    hasFiredThisTurn: false,
    shotsFiredThisTurn: 0,
  };
}