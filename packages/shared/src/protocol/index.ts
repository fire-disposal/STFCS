/**
 * 协议类型定义
 *
 * 用于客户端和服务端共享的类型
 */

import type { ArmorQuadrant, Point } from '../types/index.js';

// ==================== 回合阶段 ====================

export type TurnPhase = 'player_action' | 'dm_action' | 'resolution';

export type GamePhase = 'lobby' | 'deployment' | 'playing' | 'paused' | 'ended';

// ==================== 舰船行动状态 ====================

export interface ShipActionState {
  shipId: string;
  hasActed: boolean;
  movementRemaining: number;
  isOverloaded: boolean;
  // 新增属性
  hasMoved: boolean;
  hasFired: boolean;
  hasVented: boolean;
  hasToggledShield: boolean;
  hasRotated: boolean;
  overloadResetAvailable: boolean;
  remainingActions: number;
}

// ==================== 攻击预览 ====================

export interface AttackPreviewResult {
  attackerId: string;
  targetId: string;
  weaponId: string;
  quadrant: ArmorQuadrant;

  // 预计伤害
  estimatedDamage: number;
  shieldAbsorption: number;
  armorReduction: number;
  hullDamage: number;

  // 辐能影响
  attackerFluxCost: number;
  targetFluxGenerated: number;

  // 命中概率
  hitChance: number;

  // 是否可能过载
  canCauseOverload: boolean;

  // 新增属性
  canAttack: boolean;
  preview: {
    baseDamage: number;
    estimatedDamage: number;
    estimatedShieldAbsorb: number;
    estimatedArmorReduction: number;
    estimatedHullDamage: number;
    hitChance: number;
    shieldAbsorption: number;
    armorReduction: number;
    hullDamage: number;
    hitQuadrant: ArmorQuadrant;
    fluxCost: number;
    willGenerateHardFlux: boolean;
  };
  blockReason?: string;
}

// ==================== 战斗结果 ====================

export interface CombatResultPayload {
  attackerId: string;
  targetId: string;
  weaponId: string;
  quadrant: ArmorQuadrant;

  damage: number;
  shieldAbsorbed: number;
  armorReduced: number;
  hullDamage: number;

  targetDestroyed: boolean;
  targetOverloaded: boolean;
}

// ==================== 战斗交互类型 ====================

/** 攻击结果 */
export interface AttackResult {
  attackerId: string;
  targetId: string;
  weaponId: string;
  quadrant: ArmorQuadrant;
  hit: boolean;
  damage: number;
  shieldAbsorbed: number;
  armorReduced: number;
  hullDamage: number;
  targetDestroyed: boolean;
  targetOverloaded: boolean;
  timestamp: number;
}

/** 武器选择事件 */
export interface WeaponSelected {
  shipId: string;
  weaponInstanceId: string;
  weaponId: string;
  timestamp: number;
}

/** 目标选择事件 */
export interface TargetSelected {
  attackerId: string;
  targetId: string;
  timestamp: number;
}

/** 象限选择事件 */
export interface QuadrantSelected {
  attackerId: string;
  targetId: string;
  quadrant: ArmorQuadrant;
  timestamp: number;
}

// ==================== 领域事件 ====================

export interface DomainEvent<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
  source?: string;
}

export type DomainEventType = string;

export interface EventContext {
  roomId: string;
  playerId?: string;
  timestamp?: number;
}

// ==================== 事件载荷映射 ====================

export interface DomainEventPayloadMap {
  SHIP_MOVED: {
    shipId: string;
    phase: string;
    newPosition: Point;
    newHeading: number;
    timestamp: number;
  };
  SHIELD_TOGGLED: {
    shipId: string;
    isActive: boolean;
  };
  FLUX_STATE_UPDATED: {
    shipId: string;
    fluxState: string;
    currentFlux: number;
    softFlux: number;
    hardFlux: number;
  };
  PLAYER_JOINED: {
    playerId: string;
    playerName: string;
    timestamp: number;
  };
  PLAYER_LEFT: {
    playerId: string;
    reason: string;
  };
  PLAYER_DM_MODE_CHANGED: {
    playerId: string;
    playerName: string;
    isDMMode: boolean;
  };
  OBJECT_SELECTED: {
    playerId: string;
    playerName: string;
    tokenId: string;
    timestamp: number;
    forceOverride?: boolean;
  };
  OBJECT_DESELECTED: {
    playerId: string;
    tokenId: string;
    timestamp: number;
    reason?: string;
  };
  TOKEN_MOVED: {
    tokenId: string;
    previousPosition: Point;
    newPosition: Point;
    previousHeading: number;
    newHeading: number;
    timestamp: number;
  };
  TOKEN_DRAG_START: {
    tokenId: string;
    playerId: string;
    playerName: string;
    position: Point;
    heading: number;
    timestamp: number;
  };
  TOKEN_DRAGGING: {
    tokenId: string;
    playerId: string;
    playerName: string;
    position: Point;
    heading: number;
    isDragging: boolean;
    timestamp: number;
  };
  TOKEN_DRAG_END: {
    tokenId: string;
    playerId: string;
    finalPosition: Point;
    finalHeading: number;
    committed: boolean;
    timestamp: number;
  };
  WEAPON_FIRED: {
    sourceShipId: string;
    targetShipId: string;
    weaponId: string;
    mountId: string;
    timestamp: number;
  };
  DAMAGE_DEALT: {
    sourceShipId: string;
    targetShipId: string;
    hit: boolean;
    damage: number;
    shieldAbsorbed: number;
    armorReduced: number;
    hullDamage: number;
    hitQuadrant: ArmorQuadrant;
    softFluxGenerated: number;
    hardFluxGenerated: number;
    timestamp: number;
  };
  CAMERA_UPDATED: {
    playerId: string;
    playerName: string;
    centerX: number;
    centerY: number;
    zoom: number;
    rotation: number;
    timestamp: number;
  };
}

// ==================== 创建事件 ====================

export function createDomainEvent<T extends DomainEventType>(
  type: T,
  payload: T extends keyof DomainEventPayloadMap ? DomainEventPayloadMap[T] : unknown,
  source?: string
): DomainEvent {
  return {
    type,
    payload,
    timestamp: Date.now(),
    source,
  };
}