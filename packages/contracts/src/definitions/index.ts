/**
 * 定义层统一导出
 * 
 * 所有类型、枚举、Schema、接口均从此导出
 */

// ==================== 枚举和常量 ====================

export {
  // 武器相关
  DamageType,
  WeaponCategory,
  MountType,
  WeaponState,
  WeaponSlotSize,
  type DamageTypeValue,
  type WeaponCategoryValue,
  type MountTypeValue,
  type WeaponStateValue,
  type WeaponSlotSizeValue,
  
  // 护甲护盾
  ArmorQuadrant,
  ShieldType,
  FluxStateType,
  ARMOR_QUADRANTS,
  type ArmorQuadrantValue,
  type ShieldTypeValue,
  type FluxStateValue,
  
  // 游戏状态
  GamePhaseType,
  HullSize,
  ShipClass,
  Faction,
  PlayerRole,
  ConnectionQuality,
  MovementPhase,
  type GamePhaseValue,
  type HullSizeValue,
  type ShipClassValue,
  type FactionValue,
  type PlayerRoleValue,
  type ConnectionQualityValue,
  type MovementPhaseValue,
  
  // 常量
  DAMAGE_MODIFIERS,
  GAME_CONFIG,
} from './enums.js';

// ==================== Zod Schema ====================

export {
  // 枚举 Schema
  DamageTypeSchema,
  WeaponCategorySchema,
  MountTypeSchema,
  WeaponStateSchema,
  WeaponSlotSizeSchema,
  ArmorQuadrantSchema,
  ShieldTypeSchema,
  FluxStateSchema,
  GamePhaseSchema,
  HullSizeSchema,
  ShipClassSchema,
  FactionSchema,
  PlayerRoleSchema,
  ConnectionQualitySchema,
  
  // 基础类型 Schema
  PointSchema,
  TransformSchema,
  
  // 状态 Schema
  ArmorInstanceStateSchema,
  ShieldInstanceStateSchema,
  FluxInstanceStateSchema,
  HullInstanceStateSchema,
  WeaponSlotSchema,
  WeaponDefinitionSchema,
  WeaponSlotDefinitionSchema,
  HullDefinitionSchema,
  ShipStateSchema,
  PlayerStateSchema,
  GameRoomStateSchema,
  
  // 推导类型
  type Point,
  type Transform,
} from './schemas.js';

// ==================== 接口 ====================

export {
  // 基础类型
  type Point as PointInterface,
  type Transform as TransformInterface,
  
  // 状态接口
  type ArmorInstanceState as ArmorInstanceStateInterface,
  type ShieldInstanceState as ShieldInstanceStateInterface,
  type FluxInstanceState as FluxInstanceStateInterface,
  type HullInstanceState as HullInstanceStateInterface,
  type WeaponSlot as WeaponSlotInterface,
  type WeaponDefinition as WeaponDefinitionInterface,
  type WeaponSlotDefinition as WeaponSlotDefinitionInterface,
  type HullDefinition as HullDefinitionInterface,
  type ShipState as ShipStateInterface,
  type PlayerState as PlayerStateInterface,
  type GameRoomState as GameRoomStateInterface,
  
  // 命令
  ClientCommand,
  type ClientCommandValue,
} from './interfaces.js';

// 重新导出主要接口（不带 Interface 后缀）
export type {
  ArmorInstanceState,
  ShieldInstanceState,
  FluxInstanceState,
  HullInstanceState,
  WeaponSlot,
  WeaponDefinition,
  WeaponSlotDefinition,
  HullDefinition,
  ShipState,
  PlayerState,
  GameRoomState,
} from './interfaces.js';

// ==================== 护甲工具 ====================

export {
  // 常量
  ARMOR_QUADRANT_NAMES,
  
  // 函数
  getQuadrantFromAngle,
  createDefaultArmorState,
  createArmorStateWithDistribution,
  arrayToArmorState,
  armorStateToArray,
  calculateArmorDamageReduction,
  applyArmorDamage,
  isArmorDepleted,
  getArmorPercent,
  getAverageArmorPercent,
  repairArmor,
  setArmorQuadrant,
} from './armor.js';