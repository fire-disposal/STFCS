/**
 * 组件状态结构
 * 基于 @vt/data 权威设计 - weapon.schema.json
 */

import type { WeaponJSON, WeaponSpec } from "@vt/data";

/**
 * 组件类型 - 基于schema设计
 */
export type ComponentType = "WEAPON" | "ENGINE" | "SHIELD" | "ARMOR" | "SYSTEM";

/**
 * 组件状态接口
 */
export interface ComponentState {
  // 基础标识
  id: string;
  type: ComponentType;
  mountId: string; // 挂载点ID
  
  // 引用数据
  dataRef: string; // 引用到data包中的JSON数据ID
  
  // 运行时状态
  runtime: ComponentRuntime;
  
  // 显示属性
  enabled: boolean;
  visible: boolean;
  
  // 元数据
  metadata: ComponentMetadata;
}

/**
 * 组件运行时状态
 */
export interface ComponentRuntime {
  // 通用状态
  state: "READY" | "ACTIVE" | "COOLDOWN" | "DISABLED" | "DAMAGED";
  cooldownRemaining: number;
  durability: number;
  maxDurability: number;
  
  // 状态效果
  statusEffects: StatusEffect[];
  
  // 组件特定数据
  data: Record<string, any>;
}

/**
 * 武器组件状态 - 基于WeaponJSON schema
 */
export interface WeaponComponentState extends ComponentState {
  type: "WEAPON";
  data: WeaponJSON;
  spec: WeaponSpec;
  combatState: WeaponCombatState;
}

/**
 * 武器战斗状态
 */
export interface WeaponCombatState {
  // 基础属性
  damage: number;
  damageType: string;
  range: number;
  minRange: number;
  
  // 状态
  ready: boolean;
  canFire: boolean;
  cooldownPercentage: number;
  
  // 弹药（如果适用）
  ammo?: number;
  maxAmmo?: number;
  ammoPercentage?: number;
  
  // 辐能消耗
  fluxCost: number;
  
  // 特殊属性
  burstCount: number;
  allowsMultipleTargets: boolean;
  isPointDefense: boolean;
}

/**
 * 状态效果
 */
export interface StatusEffect {
  id: string;
  type: string;
  source: string;
  duration: number;
  stackCount: number;
  data: Record<string, any>;
}

/**
 * 组件元数据
 */
export interface ComponentMetadata {
  name: string;
  description: string | undefined;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  customData: Record<string, any> | undefined;
}

/**
 * 创建组件状态
 */
export function createComponentState(
  id: string,
  type: ComponentType,
  mountId: string,
  dataRef: string,
  metadata: Partial<ComponentMetadata> = {}
): ComponentState {
  const now = Date.now();
  
  return {
    id,
    type,
    mountId,
    dataRef,
    runtime: {
      state: "READY",
      cooldownRemaining: 0,
      durability: 100,
      maxDurability: 100,
      statusEffects: [],
      data: {},
    },
    enabled: true,
    visible: true,
    metadata: {
      name: `Component_${id.substring(0, 8)}`,
      description: undefined,
      createdAt: now,
      updatedAt: now,
      tags: [],
      customData: undefined,
      ...metadata,
    },
  };
}

/**
 * 创建武器组件状态 - 基于WeaponJSON schema
 */
export function createWeaponComponentState(
  id: string,
  mountId: string,
  data: WeaponJSON,
  metadata: Partial<ComponentMetadata> = {}
): WeaponComponentState {
  const spec = data.spec;
  
  const baseComponent = createComponentState(
    id,
    "WEAPON",
    mountId,
    data.$id,
    {
      name: data.metadata?.name || `Weapon_${id.substring(0, 8)}`,
      description: data.metadata?.description,
      tags: data.metadata?.tags || [],
      ...metadata,
    }
  );

  const combatState = calculateWeaponCombatState(spec);

  return {
    ...baseComponent,
    type: "WEAPON" as const,
    data,
    spec,
    combatState,
  };
}

/**
 * 计算武器战斗状态
 */
function calculateWeaponCombatState(spec: WeaponSpec): WeaponCombatState {
  const isPointDefense = spec.tags?.includes("PD") || false;
  
  return {
    // 基础属性
    damage: spec.damage,
    damageType: spec.damageType,
    range: spec.range,
    minRange: spec.minRange || 0,
    
    // 状态
    ready: true,
    canFire: true,
    cooldownPercentage: 0,
    
    // 辐能消耗
    fluxCost: spec.fluxCostPerShot || 0,
    
    // 特殊属性
    burstCount: spec.burstCount || 1,
    allowsMultipleTargets: spec.allowsMultipleTargets || false,
    isPointDefense,
  };
}

/**
 * 更新组件运行时状态
 */
export function updateComponentRuntime(
  component: ComponentState,
  runtimeUpdates: Partial<ComponentRuntime>
): ComponentState {
  const newRuntime = {
    ...component.runtime,
    ...runtimeUpdates,
  };

  // 如果是武器组件，更新战斗状态
  if (component.type === "WEAPON") {
    const weaponComponent = component as WeaponComponentState;
    return updateWeaponCombatState(weaponComponent, newRuntime);
  }

  return {
    ...component,
    runtime: newRuntime,
    metadata: {
      ...component.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * 更新武器战斗状态
 */
function updateWeaponCombatState(
  weapon: WeaponComponentState,
  runtime: ComponentRuntime
): WeaponComponentState {
  const cooldownPercentage = runtime.cooldownRemaining > 0 && weapon.spec.cooldown
    ? (runtime.cooldownRemaining / weapon.spec.cooldown) * 100 
    : 0;

  const newCombatState: WeaponCombatState = {
    ...weapon.combatState,
    ready: runtime.state === "READY",
    canFire: runtime.state === "READY" && runtime.cooldownRemaining <= 0,
    cooldownPercentage,
  };

  return {
    ...weapon,
    runtime,
    combatState: newCombatState,
    metadata: {
      ...weapon.metadata,
      updatedAt: Date.now(),
    },
  };
}

/**
 * 应用武器开火
 */
export function applyWeaponFire(
  weapon: WeaponComponentState
): WeaponComponentState {
  const spec = weapon.spec;
  
  const newRuntime: ComponentRuntime = {
    ...weapon.runtime,
    state: "COOLDOWN",
    cooldownRemaining: spec.cooldown || 1,
  };

  return updateWeaponCombatState(weapon, newRuntime);
}

/**
 * 更新武器冷却
 */
export function updateWeaponCooldown(
  weapon: WeaponComponentState
): WeaponComponentState {
  const runtime = weapon.runtime;
  
  if (runtime.state === "COOLDOWN" && runtime.cooldownRemaining > 0) {
    const newCooldown = Math.max(0, runtime.cooldownRemaining - 1);
    const newState = newCooldown === 0 ? "READY" : "COOLDOWN";
    
    const newRuntime: ComponentRuntime = {
      ...runtime,
      state: newState,
      cooldownRemaining: newCooldown,
    };

    return updateWeaponCombatState(weapon, newRuntime);
  }

  return weapon;
}

/**
 * 应用伤害到组件
 */
export function applyDamageToComponent(
  component: ComponentState,
  damage: number
): ComponentState {
  const newDurability = Math.max(0, component.runtime.durability - damage);
  const newState = newDurability <= 0 ? "DAMAGED" : component.runtime.state;

  const newRuntime: ComponentRuntime = {
    ...component.runtime,
    state: newState,
    durability: newDurability,
  };

  return updateComponentRuntime(component, newRuntime);
}

/**
 * 修复组件
 */
export function repairComponent(
  component: ComponentState,
  repairAmount: number
): ComponentState {
  const newDurability = Math.min(
    component.runtime.maxDurability,
    component.runtime.durability + repairAmount
  );
  
  const newState = component.runtime.state === "DAMAGED" && newDurability > 0 
    ? "READY" 
    : component.runtime.state;

  const newRuntime: ComponentRuntime = {
    ...component.runtime,
    state: newState,
    durability: newDurability,
  };

  return updateComponentRuntime(component, newRuntime);
}

/**
 * 添加状态效果
 */
export function addStatusEffectToComponent(
  component: ComponentState,
  effect: StatusEffect
): ComponentState {
  const newRuntime: ComponentRuntime = {
    ...component.runtime,
    statusEffects: [...component.runtime.statusEffects, effect],
  };

  return updateComponentRuntime(component, newRuntime);
}

/**
 * 移除状态效果
 */
export function removeStatusEffectFromComponent(
  component: ComponentState,
  effectId: string
): ComponentState {
  const newRuntime: ComponentRuntime = {
    ...component.runtime,
    statusEffects: component.runtime.statusEffects.filter(effect => effect.id !== effectId),
  };

  return updateComponentRuntime(component, newRuntime);
}

/**
 * 更新状态效果持续时间
 */
export function updateComponentStatusEffectDuration(
  component: ComponentState,
  effectId: string,
  newDuration: number
): ComponentState {
  const newRuntime: ComponentRuntime = {
    ...component.runtime,
    statusEffects: component.runtime.statusEffects.map(effect =>
      effect.id === effectId
        ? { ...effect, duration: newDuration }
        : effect
    ),
  };

  return updateComponentRuntime(component, newRuntime);
}

/**
 * 检查组件是否可用
 */
export function isComponentEnabled(component: ComponentState): boolean {
  return component.enabled && 
         component.runtime.state !== "DISABLED" && 
         component.runtime.state !== "DAMAGED";
}

/**
 * 检查武器是否可以开火
 */
export function canWeaponFire(weapon: WeaponComponentState): boolean {
  return isComponentEnabled(weapon) && 
         weapon.combatState.canFire;
}

/**
 * 获取组件显示名称
 */
export function getComponentDisplayName(component: ComponentState): string {
  return component.metadata.name || `Component_${component.id.substring(0, 8)}`;
}

/**
 * 获取武器规格摘要
 */
export function getWeaponSpecSummary(weapon: WeaponComponentState): {
  damage: string;
  range: string;
  type: string;
  flux: string;
} {
  const spec = weapon.spec;
  
  return {
    damage: `${spec.damage}${(spec.projectilesPerShot || 1) > 1 ? `×${spec.projectilesPerShot || 1}` : ''}`,
    range: `${spec.range}`,
    type: spec.damageType,
    flux: `${spec.fluxCostPerShot || 0}`,
  };
}

/**
 * 获取组件健康状态
 */
export function getComponentHealth(component: ComponentState): {
  durability: number;
  maxDurability: number;
  percentage: number;
  status: "HEALTHY" | "DAMAGED" | "CRITICAL";
} {
  const percentage = (component.runtime.durability / component.runtime.maxDurability) * 100;
  
  let status: "HEALTHY" | "DAMAGED" | "CRITICAL" = "HEALTHY";
  if (component.runtime.state === "DAMAGED") {
    status = "DAMAGED";
  } else if (percentage <= 25) {
    status = "CRITICAL";
  } else if (percentage <= 50) {
    status = "DAMAGED";
  }

  return {
    durability: component.runtime.durability,
    maxDurability: component.runtime.maxDurability,
    percentage,
    status,
  };
}
