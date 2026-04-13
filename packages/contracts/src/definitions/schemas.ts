/**
 * Zod Schema 定义
 * 
 * 用于数据验证和类型推导
 * Schema 与 enums.ts 保持一致
 */

import { z } from 'zod';

// ==================== 枚举 Schema ====================

export const DamageTypeSchema = z.enum([
  'KINETIC',
  'HIGH_EXPLOSIVE',
  'FRAGMENTATION',
  'ENERGY',
]);

export const WeaponCategorySchema = z.enum([
  'BALLISTIC',
  'ENERGY',
  'MISSILE',
  'SYNERGY',
]);

export const MountTypeSchema = z.enum([
  'FIXED',
  'TURRET',
  'HIDDEN',
]);

export const WeaponStateSchema = z.enum([
  'READY',
  'COOLDOWN',
  'OUT_OF_AMMO',
  'DISABLED',
]);

export const WeaponSlotSizeSchema = z.enum([
  'SMALL',
  'MEDIUM',
  'LARGE',
]);

export const ArmorQuadrantSchema = z.enum([
  'FRONT_TOP',
  'FRONT_BOTTOM',
  'LEFT_TOP',
  'LEFT_BOTTOM',
  'RIGHT_TOP',
  'RIGHT_BOTTOM',
]);

export const ShieldTypeSchema = z.enum([
  'FRONT',
  'OMNI',
  'NONE',
]);

export const FluxStateSchema = z.enum([
  'NORMAL',
  'VENTING',
  'OVERLOADED',
]);

export const GamePhaseSchema = z.enum([
  'DEPLOYMENT',
  'PLAYER_TURN',
  'DM_TURN',
  'END_PHASE',
]);

export const HullSizeSchema = z.enum([
  'FIGHTER',
  'FRIGATE',
  'DESTROYER',
  'CRUISER',
  'CAPITAL',
]);

export const ShipClassSchema = z.enum([
  'STRIKE',
  'SUPPORT',
  'LINE',
  'CARRIER',
  'BATTLESHIP',
]);

export const FactionSchema = z.enum([
  'PLAYER',
  'DM',
]);

export const PlayerRoleSchema = z.enum([
  'DM',
  'PLAYER',
]);

export const ConnectionQualitySchema = z.enum([
  'EXCELLENT',
  'GOOD',
  'FAIR',
  'POOR',
  'OFFLINE',
]);

// ==================== 基础类型 Schema ====================

export const PointSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const TransformSchema = z.object({
  x: z.number(),
  y: z.number(),
  heading: z.number().min(0).max(360),
});

// ==================== 护甲 Schema ====================

export const ArmorInstanceStateSchema = z.object({
  maxPerQuadrant: z.number().positive(),
  quadrants: z.record(ArmorQuadrantSchema, z.number().nonnegative()),
});

// ==================== 护盾 Schema ====================

export const ShieldInstanceStateSchema = z.object({
  type: ShieldTypeSchema,
  active: z.boolean(),
  current: z.number().nonnegative(),
  max: z.number().positive(),
  radius: z.number().positive(),
  centerOffset: PointSchema,
  coverageAngle: z.number().min(0).max(360),
  facing: z.number().min(0).max(360).optional(),
  efficiency: z.number().min(0).max(1),
  maintenanceCost: z.number().nonnegative(),
});

// ==================== 辐能 Schema ====================

export const FluxInstanceStateSchema = z.object({
  current: z.number().nonnegative(),
  capacity: z.number().positive(),
  softFlux: z.number().nonnegative(),
  hardFlux: z.number().nonnegative(),
  dissipation: z.number().nonnegative(),
  ventRate: z.number().nonnegative(),
  state: FluxStateSchema,
  overloadTimeRemaining: z.number().nonnegative(),
  ventTimeRemaining: z.number().nonnegative(),
});

// ==================== 船体 Schema ====================

export const HullInstanceStateSchema = z.object({
  current: z.number().nonnegative(),
  max: z.number().positive(),
  disabled: z.boolean(),
  disabledTimeRemaining: z.number().nonnegative(),
});

// ==================== 武器 Schema ====================

export const WeaponSlotSchema = z.object({
  mountId: z.string(),
  weaponSpecId: z.string(),
  name: z.string(),
  category: WeaponCategorySchema,
  damageType: DamageTypeSchema,
  mountType: MountTypeSchema,
  
  offsetX: z.number(),
  offsetY: z.number(),
  mountFacing: z.number(),
  arcMin: z.number(),
  arcMax: z.number(),
  
  damage: z.number().nonnegative(),
  range: z.number().nonnegative(),
  fluxCost: z.number().nonnegative(),
  
  cooldownMax: z.number().nonnegative(),
  cooldownRemaining: z.number().nonnegative(),
  
  maxAmmo: z.number().nonnegative(),
  currentAmmo: z.number().nonnegative(),
  reloadTime: z.number().nonnegative(),
  
  state: WeaponStateSchema,
  ignoresShields: z.boolean(),
  hasFiredThisTurn: z.boolean(),
});

export const WeaponDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameLocalized: z.object({
    zh: z.string(),
    en: z.string(),
  }).optional(),
  description: z.string().optional(),
  
  category: WeaponCategorySchema,
  damageType: DamageTypeSchema,
  mountType: MountTypeSchema,
  
  damage: z.number().positive(),
  empDamage: z.number().nonnegative().optional(),
  range: z.number().positive(),
  arc: z.number().min(0).max(360),
  turnRate: z.number().nonnegative().optional(),
  
  fluxCost: z.number().nonnegative(),
  ammo: z.number().nonnegative().optional(),
  ammoPerShot: z.number().positive().optional(),
  
  cooldown: z.number().positive(),
  chargeTime: z.number().nonnegative().optional(),
  burstSize: z.number().positive().optional(),
  burstDelay: z.number().nonnegative().optional(),
  
  special: z.object({
    guided: z.boolean().optional(),
    homing: z.boolean().optional(),
    beam: z.boolean().optional(),
    areaEffect: z.number().positive().optional(),
  }).optional(),
  
  sprite: z.string().optional(),
  projectileSprite: z.string().optional(),
  sound: z.string().optional(),
});

// ==================== 武器槽位定义 Schema ====================

export const WeaponSlotDefinitionSchema = z.object({
  id: z.string(),
  type: MountTypeSchema,
  size: WeaponSlotSizeSchema,
  position: PointSchema,
  facing: z.number(),
  arc: z.number().min(0).max(360),
  defaultWeapon: z.string().optional(),
});

// ==================== 船体定义 Schema ====================

export const HullDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  nameLocalized: z.object({
    zh: z.string(),
    en: z.string(),
  }).optional(),
  description: z.string().optional(),
  
  size: HullSizeSchema,
  class: ShipClassSchema.optional(),
  
  sizeDimensions: z.object({
    width: z.number().positive(),
    length: z.number().positive(),
  }).optional(),
  
  hitPoints: z.number().positive(),
  
  armor: z.object({
    maxValue: z.number().positive(),
    quadrants: z.record(ArmorQuadrantSchema, z.number().positive()).optional(),
  }),
  
  flux: z.object({
    capacity: z.number().positive(),
    dissipation: z.number().positive(),
  }),
  
  shield: z.object({
    type: ShieldTypeSchema,
    radius: z.number().positive(),
    coverageAngle: z.number().min(0).max(360),
    efficiency: z.number().min(0).max(1),
    maintenanceCost: z.number().nonnegative(),
    centerOffset: PointSchema.optional(),
  }).optional(),
  
  maxSpeed: z.number().positive(),
  maxTurnRate: z.number().positive(),
  acceleration: z.number().positive(),
  
  weaponSlots: z.array(WeaponSlotDefinitionSchema),
  
  tags: z.array(z.string()).optional(),
});

// ==================== 舰船状态 Schema ====================

export const ShipStateSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  faction: FactionSchema,
  hullType: z.string(),
  hullId: z.string(),
  name: z.string(),
  
  width: z.number().positive(),
  length: z.number().positive(),
  transform: TransformSchema,
  
  hull: HullInstanceStateSchema,
  armor: ArmorInstanceStateSchema,
  shield: ShieldInstanceStateSchema.optional(),
  flux: FluxInstanceStateSchema,
  
  maxSpeed: z.number().positive(),
  maxTurnRate: z.number().positive(),
  acceleration: z.number().positive(),
  
  weapons: z.record(z.string(), WeaponSlotSchema),
  
  hasMoved: z.boolean(),
  hasFired: z.boolean(),
  isOverloaded: z.boolean(),
  overloadTime: z.number().nonnegative(),
  isDestroyed: z.boolean(),
  
  movePhaseAX: z.number().optional(),
  movePhaseAStrafe: z.number().optional(),
  movePhaseBX: z.number().optional(),
  movePhaseBStrafe: z.number().optional(),
  turnAngle: z.number().optional(),
});

// ==================== 玩家 Schema ====================

export const PlayerStateSchema = z.object({
  sessionId: z.string(),
  shortId: z.number().int().min(100000).max(999999),
  role: PlayerRoleSchema,
  name: z.string().min(1).max(32),
  nickname: z.string().max(24).optional(),
  avatar: z.string().max(4).optional(),
  isReady: z.boolean(),
  connected: z.boolean(),
  pingMs: z.number().int().nonnegative(),
  jitterMs: z.number().int().nonnegative(),
  connectionQuality: ConnectionQualitySchema,
});

// ==================== 游戏房间状态 Schema ====================

export const GameRoomStateSchema = z.object({
  currentPhase: GamePhaseSchema,
  turnCount: z.number().int().positive(),
  players: z.record(z.string(), PlayerStateSchema),
  ships: z.record(z.string(), ShipStateSchema),
  activeFaction: FactionSchema,
  mapWidth: z.number().positive(),
  mapHeight: z.number().positive(),
});

// ==================== 类型推导导出 ====================

export type Point = z.infer<typeof PointSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type ArmorInstanceState = z.infer<typeof ArmorInstanceStateSchema>;
export type ShieldInstanceState = z.infer<typeof ShieldInstanceStateSchema>;
export type FluxInstanceState = z.infer<typeof FluxInstanceStateSchema>;
export type HullInstanceState = z.infer<typeof HullInstanceStateSchema>;
export type WeaponSlot = z.infer<typeof WeaponSlotSchema>;
export type WeaponDefinition = z.infer<typeof WeaponDefinitionSchema>;
export type WeaponSlotDefinition = z.infer<typeof WeaponSlotDefinitionSchema>;
export type HullDefinition = z.infer<typeof HullDefinitionSchema>;
export type ShipState = z.infer<typeof ShipStateSchema>;
export type PlayerState = z.infer<typeof PlayerStateSchema>;
export type GameRoomState = z.infer<typeof GameRoomStateSchema>;