/**
 * 统一枚举常量定义
 * 
 * 所有枚举使用大写命名，作为唯一事实来源
 * 服务端、客户端、规则层均从此导入
 */

// ==================== 武器相关枚举 ====================

/** 伤害类型 - 决定对不同防御的伤害倍率 */
export const DamageType = {
  KINETIC: 'KINETIC',
  HIGH_EXPLOSIVE: 'HIGH_EXPLOSIVE',
  FRAGMENTATION: 'FRAGMENTATION',
  ENERGY: 'ENERGY',
} as const;

export type DamageTypeValue = typeof DamageType[keyof typeof DamageType];

/** 武器类别 */
export const WeaponCategory = {
  BALLISTIC: 'BALLISTIC',
  ENERGY: 'ENERGY',
  MISSILE: 'MISSILE',
  SYNERGY: 'SYNERGY',
} as const;

export type WeaponCategoryValue = typeof WeaponCategory[keyof typeof WeaponCategory];

/** 武器挂载类型 */
export const MountType = {
  FIXED: 'FIXED',
  TURRET: 'TURRET',
  HIDDEN: 'HIDDEN',
} as const;

export type MountTypeValue = typeof MountType[keyof typeof MountType];

/** 武器状态 */
export const WeaponState = {
  READY: 'READY',
  COOLDOWN: 'COOLDOWN',
  OUT_OF_AMMO: 'OUT_OF_AMMO',
  DISABLED: 'DISABLED',
} as const;

export type WeaponStateValue = typeof WeaponState[keyof typeof WeaponState];

/** 武器槽位尺寸 */
export const WeaponSlotSize = {
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
} as const;

export type WeaponSlotSizeValue = typeof WeaponSlotSize[keyof typeof WeaponSlotSize];

// ==================== 护甲护盾枚举 ====================

/** 护甲象限 - 6象限系统 */
export const ArmorQuadrant = {
  FRONT_TOP: 'FRONT_TOP',
  FRONT_BOTTOM: 'FRONT_BOTTOM',
  LEFT_TOP: 'LEFT_TOP',
  LEFT_BOTTOM: 'LEFT_BOTTOM',
  RIGHT_TOP: 'RIGHT_TOP',
  RIGHT_BOTTOM: 'RIGHT_BOTTOM',
} as const;

export type ArmorQuadrantValue = typeof ArmorQuadrant[keyof typeof ArmorQuadrant];

/** 护甲象限数组（用于遍历） */
export const ARMOR_QUADRANTS: readonly ArmorQuadrantValue[] = [
  ArmorQuadrant.FRONT_TOP,
  ArmorQuadrant.FRONT_BOTTOM,
  ArmorQuadrant.LEFT_TOP,
  ArmorQuadrant.LEFT_BOTTOM,
  ArmorQuadrant.RIGHT_TOP,
  ArmorQuadrant.RIGHT_BOTTOM,
];

/** 护盾类型 */
export const ShieldType = {
  FRONT: 'FRONT',
  OMNI: 'OMNI',
  NONE: 'NONE',
} as const;

export type ShieldTypeValue = typeof ShieldType[keyof typeof ShieldType];

/** 辐能状态 */
export const FluxStateType = {
  NORMAL: 'NORMAL',
  VENTING: 'VENTING',
  OVERLOADED: 'OVERLOADED',
} as const;

export type FluxStateValue = typeof FluxStateType[keyof typeof FluxStateType];

// ==================== 游戏状态枚举 ====================

/** 游戏阶段 */
export const GamePhaseType = {
  DEPLOYMENT: 'DEPLOYMENT',
  PLAYER_TURN: 'PLAYER_TURN',
  DM_TURN: 'DM_TURN',
  END_PHASE: 'END_PHASE',
} as const;

export type GamePhaseValue = typeof GamePhaseType[keyof typeof GamePhaseType];

/** 舰船尺寸 */
export const HullSize = {
  FIGHTER: 'FIGHTER',
  FRIGATE: 'FRIGATE',
  DESTROYER: 'DESTROYER',
  CRUISER: 'CRUISER',
  CAPITAL: 'CAPITAL',
} as const;

export type HullSizeValue = typeof HullSize[keyof typeof HullSize];

/** 舰船级别 */
export const ShipClass = {
  STRIKE: 'STRIKE',
  SUPPORT: 'SUPPORT',
  LINE: 'LINE',
  CARRIER: 'CARRIER',
  BATTLESHIP: 'BATTLESHIP',
} as const;

export type ShipClassValue = typeof ShipClass[keyof typeof ShipClass];

/** 阵营 */
export const Faction = {
  PLAYER: 'PLAYER',
  DM: 'DM',
} as const;

export type FactionValue = typeof Faction[keyof typeof Faction];

/** 玩家角色 */
export const PlayerRole = {
  DM: 'DM',
  PLAYER: 'PLAYER',
} as const;

export type PlayerRoleValue = typeof PlayerRole[keyof typeof PlayerRole];

/** 连接质量 */
export const ConnectionQuality = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  FAIR: 'FAIR',
  POOR: 'POOR',
  OFFLINE: 'OFFLINE',
} as const;

export type ConnectionQualityValue = typeof ConnectionQuality[keyof typeof ConnectionQuality];

// ==================== 移动相关枚举 ====================

/** 移动阶段 */
export const MovementPhase = {
  NONE: 0,
  PHASE_A: 1,
  TURN: 2,
  PHASE_B: 3,
} as const;

export type MovementPhaseValue = typeof MovementPhase[keyof typeof MovementPhase];

// ==================== 伤害倍率常量 ====================

/** 伤害类型对不同防御的倍率 */
export const DAMAGE_MODIFIERS: Record<DamageTypeValue, { 
  shield: number; 
  armor: number; 
  hull: number;
}> = {
  KINETIC: { 
    shield: 0.5, 
    armor: 2.0, 
    hull: 1.0,
  },
  HIGH_EXPLOSIVE: { 
    shield: 0.5, 
    armor: 2.0, 
    hull: 1.0,
  },
  FRAGMENTATION: { 
    shield: 0.25, 
    armor: 0.25, 
    hull: 0.25,
  },
  ENERGY: { 
    shield: 1.0, 
    armor: 1.0, 
    hull: 1.0,
  },
};

/** 伤害倍率类型 */
export interface DamageModifiers {
  shield: number;
  armor: number;
  hull: number;
}

// ==================== 游戏配置常量 ====================

/** 游戏全局配置 */
export const GAME_CONFIG = {
  SHIELD_UP_FLUX_COST: 10,
  OVERLOAD_BASE_DURATION: 10,
  VENT_FLUX_RATE: 30,
  OVERLOAD_FLUX_DECAY: 20,
  DEFAULT_COOLDOWN: 5,
  SHIELD_FLUX_PER_DAMAGE: 1,
  MAP_DEFAULT_WIDTH: 2000,
  MAP_DEFAULT_HEIGHT: 2000,
  MAX_PLAYERS_PER_ROOM: 8,
  RECONNECTION_TIMEOUT_MS: 60000,
} as const;