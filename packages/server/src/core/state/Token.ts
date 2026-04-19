/**
 * Token状态结构
 * 基于 @vt/data 权威设计 - ship.schema.json
 */

import type { ShipJSON, ShipRuntime, ShipSpec, FactionType } from "@vt/data";
import type { Point } from "../types/common.js";

/**
 * Token类型 - 基于schema设计
 */
export type TokenType = "SHIP" | "STATION" | "ASTEROID" | "PROJECTILE" | "EFFECT";

/**
 * Token状态接口 - 基于schema的ShipJSON扩展
 */
export interface TokenState {
  // 基础标识
  id: string;
  type: TokenType;
  
  // 几何属性
  position: Point;
  heading: number; // 朝向角度（0-360度）
  scale: number;
  
  // 显示属性
  visible: boolean;
  selected: boolean;
  locked: boolean;
  
  // 引用数据
  dataRef: string; // 引用到data包中的JSON数据ID
  
  // 运行时状态（对于舰船类型）
  runtime?: ShipRuntime;
  
  // 元数据
  metadata: TokenMetadata;
}

/**
 * Token元数据
 */
export interface TokenMetadata {
  name: string;
  description?: string;
  faction?: FactionType;
  ownerId?: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  customData?: Record<string, any>;
}

/**
 * 舰船Token状态 - 基于ShipJSON schema
 */
export interface ShipTokenState extends TokenState {
  type: "SHIP";
  
  // 完整的舰船JSON数据
  shipJson: ShipJSON;
  
  // 运行时状态（从shipJson.runtime复制，便于访问）
  runtime: ShipRuntime;
  
  // 派生的战斗状态（从runtime计算）
  combatState: CombatState;
  
  // 派生的移动状态（从runtime计算）
  movementState: MovementState;
}

/**
 * 战斗状态（从ShipRuntime派生）
 */
export interface CombatState {
  // 生命值相关
  hull: number;
  maxHull: number;
  hullPercentage: number;
  
  // 护甲相关
  armor: number[];
  maxArmor: number;
  armorPercentages: number[];
  
  // 辐能相关
  fluxSoft: number;
  fluxHard: number;
  totalFlux: number;
  fluxCapacity: number;
  fluxPercentage: number;
  fluxState: "NORMAL" | "HIGH" | "OVERLOADED" | "VENTING";
  
  // 护盾相关
  shieldActive: boolean;
  shieldValue: number;
  maxShield: number;
  shieldPercentage: number;
  
  // 状态标志
  overloaded: boolean;
  overloadTime: number;
  destroyed: boolean;
  hasFired: boolean;
  
  // 武器状态
  weaponsReady: number;
  weaponsTotal: number;
  weaponsPercentage: number;
}

/**
 * 移动状态（从ShipRuntime派生）
 */
export interface MovementState {
  hasMoved: boolean;
  phaseAUsed: number;
  turnAngleUsed: number;
  phaseCUsed: number;
  maxSpeed: number;
  maxTurnRate: number;
  
  // 可用移动力计算
  phaseAAvailable: number;
  phaseCAvailable: number;
  turnAngleAvailable: number;
  
  // 百分比
  movePercentage: number;
  turnPercentage: number;
}

/**
 * 创建Token状态
 */
export function createTokenState(
  id: string,
  type: TokenType,
  position: Point,
  dataRef: string,
  metadata: Partial<TokenMetadata> = {}
): TokenState {
  const now = Date.now();
  
  return {
    id,
    type,
    position,
    heading: 0,
    scale: 1.0,
    visible: true,
    selected: false,
    locked: false,
    dataRef,
    metadata: {
      name: `Token_${id.substring(0, 8)}`,
      createdAt: now,
      updatedAt: now,
      tags: [],
      ...metadata,
    },
  };
}

/**
 * 创建舰船Token状态 - 基于ShipJSON schema
 */
export function createShipTokenState(
  id: string,
  shipJson: ShipJSON,
  position: Point,
  heading: number = 0,
  faction?: Faction,
  ownerId?: string
): ShipTokenState {
  const spec = shipJson.ship;
  
  // 确保runtime存在
  const runtime: ShipRuntime = shipJson.runtime || {
    position,
    heading,
    hull: spec.maxHitPoints,
    armor: Array(6).fill(spec.armorMaxPerQuadrant),
    fluxSoft: 0,
    fluxHard: 0,
    shield: spec.shield ? { active: false, value: spec.shield.radius } : undefined,
    overloaded: false,
    overloadTime: 0,
    destroyed: false,
    movement: {
      hasMoved: false,
      phaseAUsed: 0,
      turnAngleUsed: 0,
      phaseCUsed: 0,
    },
    hasFired: false,
    faction: faction || "NEUTRAL",
    ownerId,
  };

  // 创建基础Token状态
  const baseToken = createTokenState(
    id,
    "SHIP",
    position,
    shipJson.$id,
    {
      name: shipJson.metadata.name || `Ship_${id.substring(0, 8)}`,
      description: shipJson.metadata.description,
      faction: runtime.faction,
      ownerId: runtime.ownerId,
      tags: shipJson.metadata.tags || [],
    }
  );

  // 计算战斗状态
  const combatState = calculateCombatState(spec, runtime);
  
  // 计算移动状态
  const movementState = calculateMovementState(spec, runtime.movement);

  return {
    ...baseToken,
    heading,
    shipJson,
    runtime,
    combatState,
    movementState,
  };
}

/**
 * 计算战斗状态
 */
function calculateCombatState(spec: ShipSpec, runtime: ShipRuntime): CombatState {
  const totalFlux = (runtime.fluxSoft || 0) + (runtime.fluxHard || 0);
  const fluxCapacity = spec.fluxCapacity || 100;
  
  // 计算辐能状态
  let fluxState: "NORMAL" | "HIGH" | "OVERLOADED" | "VENTING" = "NORMAL";
  const fluxRatio = totalFlux / fluxCapacity;
  
  if (runtime.overloaded) {
    fluxState = "OVERLOADED";
  } else if (fluxRatio >= 0.7) {
    fluxState = "HIGH";
  }

  // 计算武器状态
  const weapons = runtime.weapons || [];
  const weaponsReady = weapons.filter(w => w.state === "READY").length;
  const weaponsTotal = weapons.length;

  return {
    // 生命值
    hull: runtime.hull,
    maxHull: spec.maxHitPoints,
    hullPercentage: (runtime.hull / spec.maxHitPoints) * 100,
    
    // 护甲
    armor: runtime.armor,
    maxArmor: spec.armorMaxPerQuadrant,
    armorPercentages: runtime.armor.map(a => (a / spec.armorMaxPerQuadrant) * 100),
    
    // 辐能
    fluxSoft: runtime.fluxSoft || 0,
    fluxHard: runtime.fluxHard || 0,
    totalFlux,
    fluxCapacity,
    fluxPercentage: (totalFlux / fluxCapacity) * 100,
    fluxState,
    
    // 护盾
    shieldActive: runtime.shield?.active || false,
    shieldValue: runtime.shield?.value || 0,
    maxShield: spec.shield?.radius || 0,
    shieldPercentage: spec.shield ? ((runtime.shield?.value || 0) / spec.shield.radius) * 100 : 0,
    
    // 状态
    overloaded: runtime.overloaded || false,
    overloadTime: runtime.overloadTime || 0,
    destroyed: runtime.destroyed || false,
    hasFired: runtime.hasFired || false,
    
    // 武器
    weaponsReady,
    weaponsTotal,
    weaponsPercentage: weaponsTotal > 0 ? (weaponsReady / weaponsTotal) * 100 : 0,
  };
}

/**
 * 计算移动状态
 */
function calculateMovementState(spec: ShipSpec, movement?: ShipRuntime["movement"]): MovementState {
  const moveState = movement || {
    hasMoved: false,
    phaseAUsed: 0,
    turnAngleUsed: 0,
    phaseCUsed: 0,
  };

  const maxSpeed = spec.maxSpeed;
  const maxTurnRate = spec.maxTurnRate;

  return {
    ...moveState,
    maxSpeed,
    maxTurnRate,
    
    // 可用移动力
    phaseAAvailable: maxSpeed - (moveState.phaseAUsed || 0),
    phaseCAvailable: maxSpeed - (moveState.phaseCUsed || 0),
    turnAngleAvailable: maxTurnRate - (moveState.turnAngleUsed || 0),
    
    // 百分比
    movePercentage: ((moveState.phaseAUsed || 0) + (moveState.phaseCUsed || 0)) / (maxSpeed * 2) * 100,
    turnPercentage: (moveState.turnAngleUsed || 0) / maxTurnRate * 100,
  };
}

/**
 * 更新Token位置
 */
export function updateTokenPosition(
  token: TokenState,
  newPosition: Point
): TokenState {
  const updatedToken = {
    ...token,
    position: newPosition,
    metadata: {
      ...token.metadata,
      updatedAt: Date.now(),
    },
  };

  // 如果是舰船Token，更新runtime中的位置
  if (token.type === "SHIP") {
    const shipToken = token as ShipTokenState;
    return {
      ...updatedToken,
      runtime: {
        ...shipToken.runtime,
        position: newPosition,
      },
      combatState: calculateCombatState(shipToken.shipJson.ship, {
        ...shipToken.runtime,
        position: newPosition,
      }),
    } as ShipTokenState;
  }

  return updatedToken;
}

/**
 * 更新Token朝向
 */
export function updateTokenHeading(
  token: TokenState,
  newHeading: number
): TokenState {
  const normalizedHeading = ((newHeading % 360) + 360) % 360;
  const updatedToken = {
    ...token,
    heading: normalizedHeading,
    metadata: {
      ...token.metadata,
      updatedAt: Date.now(),
    },
  };

  // 如果是舰船Token，更新runtime中的朝向
  if (token.type === "SHIP") {
    const shipToken = token as ShipTokenState;
    return {
      ...updatedToken,
      runtime: {
        ...shipToken.runtime,
        heading: normalizedHeading,
      },
    } as ShipTokenState;
  }

  return updatedToken;
}

/**
 * 更新舰船运行时状态
 */
export function updateShipRuntime(
  ship: ShipTokenState,
  runtimeUpdates: Partial<ShipRuntime>
): ShipTokenState {
  const newRuntime = {
    ...ship.runtime,
    ...runtimeUpdates,
  };

  return {
    ...ship,
    runtime: newRuntime,
    combatState: calculateCombatState(ship.shipJson.ship, newRuntime),
    movementState: calculateMovementState(ship.shipJson.ship, newRuntime.movement),
    metadata: {
      ...ship.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * 应用伤害到舰船
 */
export function applyDamageToShip(
  ship: ShipTokenState,
  damage: number,
  armorDamage: number,
  armorQuadrant: number,
  fluxGenerated: number,
  shieldHit: boolean
): ShipTokenState {
  const runtime = { ...ship.runtime };
  const spec = ship.shipJson.ship;

  // 更新生命值
  runtime.hull = Math.max(0, runtime.hull - damage);

  // 更新护甲
  if (armorQuadrant >= 0 && armorQuadrant < 6) {
    const armor = [...runtime.armor];
    armor[armorQuadrant] = Math.max(0, armor[armorQuadrant] - armorDamage);
    runtime.armor = armor;
  }

  // 更新辐能
  if (shieldHit) {
    runtime.fluxHard = (runtime.fluxHard || 0) + fluxGenerated;
  } else {
    runtime.fluxSoft = (runtime.fluxSoft || 0) + fluxGenerated;
  }

  // 检查过载
  const totalFlux = (runtime.fluxSoft || 0) + (runtime.fluxHard || 0);
  const fluxCapacity = spec.fluxCapacity || 100;
  
  if (totalFlux > fluxCapacity && !runtime.overloaded) {
    runtime.overloaded = true;
    runtime.overloadTime = 1;
  }

  // 检查是否被摧毁
  if (runtime.hull <= 0) {
    runtime.destroyed = true;
  }

  return updateShipRuntime(ship, runtime);
}

/**
 * 检查Token是否可见
 */
export function isTokenVisible(
  token: TokenState,
  viewerFaction?: Faction
): boolean {
  if (!token.visible) return false;
  
  // 简化：同阵营或中立可见
  if (viewerFaction && token.metadata.faction) {
    return token.metadata.faction === viewerFaction || token.metadata.faction === "NEUTRAL";
  }
  
  return true;
}

/**
 * 检查Token是否可交互
 */
export function isTokenInteractive(token: TokenState): boolean {
  if (token.locked || !token.visible) return false;
  
  // 如果是舰船，检查是否被摧毁
  if (token.type === "SHIP") {
    const shipToken = token as ShipTokenState;
    return !shipToken.runtime.destroyed;
  }
  
  return true;
}

/**
 * 获取Token显示名称
 */
export function getTokenDisplayName(token: TokenState): string {
  return token.metadata.name || `Token_${token.id.substring(0, 8)}`;
}

/**
 * 获取舰船规格摘要
 */
export function getShipSpecSummary(ship: ShipTokenState): {
  size: string;
  class: string;
  hull: string;
  speed: string;
  flux: string;
} {
  const spec = ship.shipJson.ship;
  
  return {
    size: spec.size,
    class: spec.class,
    hull: `${ship.combatState.hull}/${spec.maxHitPoints}`,
    speed: `${spec.maxSpeed}`,
    flux: `${ship.combatState.totalFlux}/${spec.fluxCapacity || 100}`,
  };
}