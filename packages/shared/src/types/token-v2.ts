/**
 * TokenV2 数据结构定义
 *
 * 完整的Token数据结构，包含：
 * - 基础Token信息
 * - 武器实例状态
 * - 护甲象限状态（6象限）
 * - 护盾实例状态
 * - 辐能系统状态
 * - 船体实例状态
 * - 三阶段移动状态
 * - 行动点状态
 */

import { z } from 'zod';
import { PointSchema, TokenTypeSchema, FactionIdSchema } from '../core-types.js';
import {
  MovementStateSchema,
} from './movement-phase.js';
import {
  ShipWeaponSystemSchema,
} from './weapon-instance.js';
import {
  ArmorInstanceStateSchema,
  ShieldInstanceStateSchema,
  FluxInstanceStateSchema,
  HullInstanceStateSchema,
  ActionsStateSchema,
} from './combat-state.js';

// ==================== TokenV2 Schema ====================

/** Token回合状态枚举 */
export const TokenTurnStateSchema = z.enum([
  'waiting',     // 等待回合开始
  'active',      // 回合进行中
  'phase1_done', // 阶段1完成（移动前转向）
  'phase2_done', // 阶段2完成（直线移动）
  'phase3_done', // 阶段3完成（移动后转向）
  'acted',       // 已执行行动
  'ended',       // 回合结束
]);

/** Token视觉状态 Schema */
export const TokenVisualStateSchema = z.object({
  /** 资源URL */
  assetUrl: z.string().optional(),
  /** 缩放比例 */
  scale: z.number().min(0.1).default(1),
  /** 渲染层级 */
  layer: z.number().default(0),
  /** 碰撞半径 */
  collisionRadius: z.number().min(0),
  /** 是否可见 */
  visible: z.boolean().default(true),
  /** 是否高亮 */
  highlighted: z.boolean().default(false),
  /** 自定义颜色（用于阵营等） */
  customColor: z.string().optional(),
});

/** Token基础信息 Schema */
export const TokenInfoV2Schema = z.object({
  // 基础标识
  /** Token唯一ID */
  id: z.string().min(1),
  /** 所有者ID（玩家ID） */
  ownerId: z.string(),
  /** Token类型 */
  type: TokenTypeSchema,
  /** Token名称 */
  name: z.string().optional(),

  // 位置与朝向
  /** 当前位置 */
  position: PointSchema,
  /** 当前朝向（角度，0为正上方） */
  heading: z.number(),
  /** 上一次位置（用于回退） */
  previousPosition: PointSchema.optional(),
  /** 上一次朝向 */
  previousHeading: z.number().optional(),

  // 尺寸与视觉
  /** Token尺寸 */
  size: z.number().min(0),
  /** 视觉状态 */
  visual: TokenVisualStateSchema,

  // 阵营与控制
  /** 阵营ID */
  faction: FactionIdSchema.optional(),
  /** 控制玩家ID */
  controllingPlayerId: z.string().optional(),
  /** 是否为敌方单位 */
  isEnemy: z.boolean().default(false),

  // 回合状态
  /** 回合状态 */
  turnState: TokenTurnStateSchema,
  /** 当前回合数 */
  currentRound: z.number().min(0).default(0),

  // 元数据
  /** 自定义元数据 */
  metadata: z.record(z.string(), z.unknown()).default({}),
});

/** 舰船Token Schema（完整战斗单位） */
export const ShipTokenV2Schema = TokenInfoV2Schema.extend({
  type: z.literal('ship'),

  // 船体定义引用
  /** 船体定义ID */
  hullId: z.string().min(1),
  /** 舰船定义ID */
  shipId: z.string().min(1),
  /** 舰船名称 */
  shipName: z.string().optional(),

  // 船体尺寸级别
  /** 舰船尺寸级别 */
  hullSize: z.enum(['FIGHTER', 'FRIGATE', 'DESTROYER', 'CRUISER', 'CAPITAL']),

  // 战斗状态
  /** 船体状态 */
  hull: HullInstanceStateSchema,
  /** 护甲状态 */
  armor: ArmorInstanceStateSchema,
  /** 护盾状态 */
  shield: ShieldInstanceStateSchema,
  /** 辐能状态 */
  flux: FluxInstanceStateSchema,

  // 移动状态
  /** 移动状态（三阶段移动） */
  movement: MovementStateSchema,

  // 武器系统
  /** 武器系统 */
  weapons: ShipWeaponSystemSchema,

  // 行动点
  /** 行动点状态 */
  actions: ActionsStateSchema,

  // 综合状态
  /** 是否被摧毁 */
  isDestroyed: z.boolean().default(false),
  /** 是否可行动 */
  canAct: z.boolean().default(true),
  /** 是否被禁用（EMP等） */
  isDisabled: z.boolean().default(false),
  /** 禁用剩余时间 */
  disabledTimeRemaining: z.number().min(0).default(0),
});

/** 空间站Token Schema */
export const StationTokenV2Schema = TokenInfoV2Schema.extend({
  type: z.literal('station'),

  // 空间站特有属性
  /** 空间站定义ID */
  stationId: z.string().min(1),

  // 战斗状态（简化版）
  /** 船体状态 */
  hull: HullInstanceStateSchema,
  /** 护甲状态 */
  armor: ArmorInstanceStateSchema,
  /** 护盾状态 */
  shield: ShieldInstanceStateSchema,
  /** 辐能状态 */
  flux: FluxInstanceStateSchema,

  // 武器系统
  /** 武器系统 */
  weapons: ShipWeaponSystemSchema,

  // 行动点（空间站不能移动）
  /** 行动点状态 */
  actions: ActionsStateSchema,

  // 综合状态
  /** 是否被摧毁 */
  isDestroyed: z.boolean().default(false),
  /** 是否可行动 */
  canAct: z.boolean().default(true),
});

/** 小行星Token Schema */
export const AsteroidTokenV2Schema = TokenInfoV2Schema.extend({
  type: z.literal('asteroid'),

  // 小行星特有属性
  /** 小行星尺寸 */
  asteroidSize: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
  /** 资源类型（如果有） */
  resourceType: z.string().optional(),
  /** 资源量 */
  resourceAmount: z.number().min(0).optional(),

  // 简化的战斗状态
  /** 船体状态 */
  hull: HullInstanceStateSchema.optional(),

  // 综合状态
  /** 是否被摧毁 */
  isDestroyed: z.boolean().default(false),
});

/** TokenV2 联合类型 Schema */
export const TokenV2Schema = z.discriminatedUnion('type', [
  ShipTokenV2Schema,
  StationTokenV2Schema,
  AsteroidTokenV2Schema,
]);

// ==================== Token集合 Schema ====================

/** Token集合 Schema */
export const TokenCollectionSchema = z.object({
  /** 所有Token */
  tokens: z.record(z.string(), TokenV2Schema),
  /** 按所有者索引 */
  byOwner: z.record(z.string(), z.array(z.string())),
  /** 按阵营索引 */
  byFaction: z.record(z.string(), z.array(z.string())),
  /** 按类型索引 */
  byType: z.record(z.string(), z.array(z.string())),
});

// ==================== 类型推导 ====================

export type TokenTurnState = z.infer<typeof TokenTurnStateSchema>;
export type TokenVisualState = z.infer<typeof TokenVisualStateSchema>;
export type TokenInfoV2 = z.infer<typeof TokenInfoV2Schema>;
export type ShipTokenV2 = z.infer<typeof ShipTokenV2Schema>;
export type StationTokenV2 = z.infer<typeof StationTokenV2Schema>;
export type AsteroidTokenV2 = z.infer<typeof AsteroidTokenV2Schema>;
export type TokenV2 = z.infer<typeof TokenV2Schema>;
export type TokenCollection = z.infer<typeof TokenCollectionSchema>;

// 重新导出子模块类型
export type {
  MovementPhase,
  MovementType,
  MovementAction,
  MovementState,
} from './movement-phase.js';

export type {
  WeaponInstanceState,
  WeaponMountInstance,
  WeaponGroup,
  ShipWeaponSystem,
} from './weapon-instance.js';

export type {
  ArmorInstanceState,
  ShieldInstanceState,
  FluxInstanceState,
  HullInstanceState,
  ActionType,
  ActionsState,
  CombatState,
} from './combat-state.js';

// ==================== 工具函数 ====================

import {
  createDefaultMovementState,
  resetMovementState,
} from './movement-phase.js';
import {
  createDefaultArmorState,
  createDefaultShieldState,
  createDefaultFluxState,
  createDefaultHullState,
  createDefaultActionsState,
} from './combat-state.js';
import {
  resetWeaponTurnState,
} from './weapon-instance.js';

/** 创建默认舰船Token */
export function createDefaultShipToken(
  id: string,
  ownerId: string,
  hullId: string,
  shipId: string,
  hullSize: ShipTokenV2['hullSize'],
  position: { x: number; y: number },
  heading: number,
  hullMax: number,
  armorMax: number,
  shieldMax: number,
  shieldRadius: number,
  fluxCapacity: number,
  fluxDissipation: number,
  maxSpeed: number,
  maxTurnRate: number,
  actionsPerTurn: number
): ShipTokenV2 {
  return {
    id,
    ownerId,
    type: 'ship',
    hullId,
    shipId,
    hullSize,
    position,
    heading,
    size: shieldRadius * 2,
    visual: {
      scale: 1,
      layer: 0,
      collisionRadius: shieldRadius,
      visible: true,
      highlighted: false,
    },
    isEnemy: false,
    turnState: 'waiting',
    currentRound: 0,
    metadata: {},
    hull: createDefaultHullState(hullMax),
    armor: createDefaultArmorState(armorMax),
    shield: createDefaultShieldState('FRONT', shieldMax, shieldRadius, 180),
    flux: createDefaultFluxState(fluxCapacity, fluxDissipation),
    movement: createDefaultMovementState(maxSpeed, maxTurnRate),
    weapons: {
      weapons: {},
      mounts: {},
      groups: [],
      activeGroupIndex: 0,
    },
    actions: createDefaultActionsState(actionsPerTurn),
    isDestroyed: false,
    canAct: true,
    isDisabled: false,
    disabledTimeRemaining: 0,
  };
}

/** 重置Token回合状态 */
export function resetTokenTurnState(token: ShipTokenV2): ShipTokenV2 {
  return {
    ...token,
    turnState: 'waiting',
    movement: resetMovementState(token.movement),
    actions: {
      ...token.actions,
      remainingActions: token.actions.actionsPerTurn,
      actionsTaken: [],
      turnEnded: false,
    },
    weapons: {
      ...token.weapons,
      weapons: Object.fromEntries(
        Object.entries(token.weapons.weapons).map(([id, w]) => [
          id,
          resetWeaponTurnState(w),
        ])
      ),
    },
    isDisabled: false,
    disabledTimeRemaining: 0,
  };
}

/** 检查Token是否可以行动 */
export function canTokenAct(token: TokenV2): boolean {
  if (token.type === 'asteroid') return false;

  if ('isDestroyed' in token && token.isDestroyed) return false;
  if ('canAct' in token && !token.canAct) return false;
  if ('isDisabled' in token && token.isDisabled) return false;
  if ('flux' in token && token.flux.state === 'overloaded') return false;

  return token.turnState !== 'ended';
}

/** 获取Token当前可用的行动 */
export function getAvailableActions(token: ShipTokenV2): string[] {
  const actions: string[] = [];

  if (!canTokenAct(token)) return actions;

  // 检查移动
  if (token.movement.currentPhase <= 3 && !token.movement.phase3Complete) {
    if (token.movement.currentPhase === 1 && !token.movement.phase1Complete) {
      actions.push('turn_before_move');
    }
    if (token.movement.currentPhase === 2 && !token.movement.phase2Complete) {
      actions.push('move');
    }
    if (token.movement.currentPhase === 3 && !token.movement.phase3Complete) {
      actions.push('turn_after_move');
    }
  }

  // 检查攻击
  if (token.actions.remainingActions > 0) {
    const readyWeapons = Object.values(token.weapons.weapons).filter(
      (w) => w.state === 'ready' && !w.hasFiredThisTurn
    );
    if (readyWeapons.length > 0) {
      actions.push('attack');
    }
  }

  // 检查护盾
  if (token.shield.type !== 'NONE' && token.flux.state === 'normal') {
    actions.push('toggle_shield');
  }

  // 检查散热
  if (
    token.flux.state === 'normal' &&
    token.flux.current > 0 &&
    token.flux.ventRate > 0
  ) {
    actions.push('vent_flux');
  }

  return actions;
}

/** 更新Token位置 */
export function updateTokenPosition(
  token: TokenV2,
  newPosition: { x: number; y: number },
  newHeading?: number
): TokenV2 {
  return {
    ...token,
    previousPosition: token.position,
    previousHeading: token.heading,
    position: newPosition,
    ...(newHeading !== undefined && { heading: newHeading }),
  };
}

/** 检查Token是否在指定范围内 */
export function isTokenInRange(
  token: TokenV2,
  target: { x: number; y: number },
  range: number
): boolean {
  const dx = token.position.x - target.x;
  const dy = token.position.y - target.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance <= range;
}

/** 获取Token的碰撞半径 */
export function getTokenCollisionRadius(token: TokenV2): number {
  return token.visual.collisionRadius;
}

/** 检查两个Token是否碰撞 */
export function areTokensColliding(token1: TokenV2, token2: TokenV2): boolean {
  const dx = token1.position.x - token2.position.x;
  const dy = token1.position.y - token2.position.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const combinedRadius =
    getTokenCollisionRadius(token1) + getTokenCollisionRadius(token2);
  return distance < combinedRadius;
}