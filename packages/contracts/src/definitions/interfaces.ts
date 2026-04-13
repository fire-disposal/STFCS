/**
 * TypeScript 接口定义
 * 
 * 用于运行时类型声明，服务端 Schema 和客户端 Redux 共用
 * 与 schemas.ts 保持一致
 * 
 * 注意：ShipState 和 WeaponSlot 使用服务端兼容的结构（直接属性，非嵌套对象）
 */

import type {
  DamageTypeValue,
  WeaponCategoryValue,
  MountTypeValue,
  WeaponStateValue,
  WeaponSlotSizeValue,
  ArmorQuadrantValue,
  ShieldTypeValue,
  FluxStateValue,
  GamePhaseValue,
  HullSizeValue,
  ShipClassValue,
  FactionValue,
  PlayerRoleValue,
  ConnectionQualityValue,
} from './enums.js';

// ==================== 基础类型 ====================

export interface Point {
  x: number;
  y: number;
}

export interface Transform {
  x: number;
  y: number;
  heading: number;
}

// ==================== 护甲状态 ====================

export interface ArmorInstanceState {
  maxPerQuadrant: number;
  quadrants: Record<ArmorQuadrantValue, number>;
}

// ==================== 护盾状态 ====================

export interface ShieldInstanceState {
  type: ShieldTypeValue;
  active: boolean;
  current: number;
  max: number;
  radius: number;
  centerOffset: Point;
  coverageAngle: number;
  facing?: number;
  efficiency: number;
  maintenanceCost: number;
}

// ==================== 辐能状态 ====================

export interface FluxInstanceState {
  current: number;
  capacity: number;
  softFlux: number;
  hardFlux: number;
  dissipation: number;
  ventRate: number;
  state: FluxStateValue;
  overloadTimeRemaining: number;
  ventTimeRemaining: number;
}

// ==================== 船体状态 ====================

export interface HullInstanceState {
  current: number;
  max: number;
  disabled: boolean;
  disabledTimeRemaining: number;
}

// ==================== 武器槽位（服务端兼容） ====================

export interface WeaponSlot {
  mountId: string;
  weaponSpecId: string;
  name: string;
  category: WeaponCategoryValue;
  damageType: DamageTypeValue;
  mountType: MountTypeValue;
  
  offsetX: number;
  offsetY: number;
  mountFacing: number;
  arcMin: number;
  arcMax: number;
  
  damage: number;
  range: number;
  fluxCost: number;
  
  cooldownMax: number;
  cooldownRemaining: number;
  
  maxAmmo: number;
  currentAmmo: number;
  reloadTime: number;
  
  state: WeaponStateValue;
  ignoresShields: boolean;
  hasFiredThisTurn: boolean;
  
  [key: string]: unknown;
}

// ==================== 武器定义 ====================

export interface WeaponDefinition {
  id: string;
  name: string;
  nameLocalized?: { zh: string; en: string };
  description?: string;
  
  category: WeaponCategoryValue;
  damageType: DamageTypeValue;
  mountType: MountTypeValue;
  
  damage: number;
  empDamage?: number;
  range: number;
  arc: number;
  turnRate?: number;
  
  fluxCost: number;
  ammo?: number;
  ammoPerShot?: number;
  
  cooldown: number;
  chargeTime?: number;
  burstSize?: number;
  burstDelay?: number;
  
  special?: {
    guided?: boolean;
    homing?: boolean;
    beam?: boolean;
    areaEffect?: number;
  };
  
  sprite?: string;
  projectileSprite?: string;
  sound?: string;
}

// ==================== 武器槽位定义 ====================

export interface WeaponSlotDefinition {
  id: string;
  type: MountTypeValue;
  size: WeaponSlotSizeValue;
  position: Point;
  facing: number;
  arc: number;
  defaultWeapon?: string;
}

// ==================== 船体定义 ====================

export interface HullDefinition {
  id: string;
  name: string;
  nameLocalized?: { zh: string; en: string };
  description?: string;
  
  size: HullSizeValue;
  class?: ShipClassValue;
  
  sizeDimensions?: {
    width: number;
    length: number;
  };
  
  hitPoints: number;
  
  armor: {
    maxValue: number;
    quadrants?: Record<ArmorQuadrantValue, number>;
  };
  
  flux: {
    capacity: number;
    dissipation: number;
  };
  
  shield?: {
    type: ShieldTypeValue;
    radius: number;
    coverageAngle: number;
    efficiency: number;
    maintenanceCost: number;
    centerOffset?: Point;
  };
  
  maxSpeed: number;
  maxTurnRate: number;
  acceleration: number;
  
  weaponSlots: WeaponSlotDefinition[];
  
  tags?: string[];
}

// ==================== 舰船状态（服务端兼容） ====================
// 使用直接属性而非嵌套对象，与服务端 Colyseus Schema 保持一致

export interface ShipState {
  id: string;
  ownerId: string;
  faction: FactionValue;
  hullType: string;
  hullId?: string;
  name: string;
  
  width: number;
  length: number;
  transform: Transform;
  
  // 船体状态（直接属性）
  hullCurrent: number;
  hullMax: number;
  
  // 护甲状态（数组形式，兼容服务端）
  armorCurrent: number[];
  armorMax: number[];
  // 新增：对象形式护甲（逐步迁移）
  armor?: ArmorInstanceState;
  
  // 辐能状态（直接属性）
  fluxMax: number;
  fluxDissipation: number;
  fluxHard: number;
  fluxSoft: number;
  
  // 护盾状态（直接属性）
  isShieldUp: boolean;
  shieldOrientation: number;
  shieldArc: number;
  shieldRadius: number;
  
  // 状态标记
  isOverloaded: boolean;
  overloadTime: number;
  isDestroyed: boolean;
  
  // 移动参数
  maxSpeed: number;
  maxTurnRate: number;
  acceleration: number;
  
  // 三阶段移动
  movePhaseAX?: number;
  movePhaseAStrafe?: number;
  movePhaseBX?: number;
  movePhaseBStrafe?: number;
  turnAngle?: number;
  
  // 武器（Colyseus MapSchema 或 Map）
  weapons: Map<string, WeaponSlot>;
  
  // 行动状态
  hasMoved: boolean;
  hasFired: boolean;
  
  [key: string]: unknown;
}

// ==================== 舰船状态（新设计，逐步迁移） ====================
// 使用嵌套对象结构，更清晰的组织

export interface ShipStateData {
  id: string;
  ownerId: string;
  faction: FactionValue;
  hullType: string;
  hullId: string;
  name: string;
  
  width: number;
  length: number;
  transform: Transform;
  
  hull: HullInstanceState;
  armor: ArmorInstanceState;
  shield?: ShieldInstanceState;
  flux: FluxInstanceState;
  
  maxSpeed: number;
  maxTurnRate: number;
  acceleration: number;
  
  weapons: Map<string, WeaponSlot> | Record<string, WeaponSlot>;
  
  hasMoved: boolean;
  hasFired: boolean;
  isOverloaded: boolean;
  overloadTime: number;
  isDestroyed: boolean;
  
  movePhaseAX?: number;
  movePhaseAStrafe?: number;
  movePhaseBX?: number;
  movePhaseBStrafe?: number;
  turnAngle?: number;
}

// ==================== 玩家状态 ====================

export interface PlayerState {
  sessionId: string;
  shortId: number;
  role: PlayerRoleValue;
  name: string;
  nickname?: string;
  avatar?: string;
  isReady: boolean;
  connected: boolean;
  pingMs: number;
  jitterMs: number;
  connectionQuality: ConnectionQualityValue;
  
  [key: string]: unknown;
}

// ==================== 游戏房间状态 ====================

export interface GameRoomState {
  currentPhase: GamePhaseValue;
  turnCount: number;
  players: Map<string, PlayerState> | Record<string, PlayerState>;
  ships: Map<string, ShipState> | Record<string, ShipState>;
  activeFaction: FactionValue;
  mapWidth: number;
  mapHeight: number;
  
  [key: string]: unknown;
}

// ==================== 客户端命令 ====================

export const ClientCommand = {
  CMD_MOVE_TOKEN: 'CMD_MOVE_TOKEN',
  CMD_TOGGLE_SHIELD: 'CMD_TOGGLE_SHIELD',
  CMD_FIRE_WEAPON: 'CMD_FIRE_WEAPON',
  CMD_VENT_FLUX: 'CMD_VENT_FLUX',
  CMD_ASSIGN_SHIP: 'CMD_ASSIGN_SHIP',
  CMD_TOGGLE_READY: 'CMD_TOGGLE_READY',
  CMD_NEXT_PHASE: 'CMD_NEXT_PHASE',
} as const;

export type ClientCommandValue = typeof ClientCommand[keyof typeof ClientCommand];