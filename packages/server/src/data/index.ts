/**
 * 数据管理模块导出
 */

export { shipDataManager, ShipDataManager } from "./ships/index.js";
export { weaponDataManager, WeaponDataManager } from "./weapons/index.js";
export { componentDataManager, ComponentDataManager } from "./components/index.js";
export { modifierSystem, ModifierSystem } from "./modifiers/index.js";

export type {
  ComponentSpec,
  ComponentRuntime,
  ComponentType,
} from "./components/index.js";

export type {
  Modifier,
  ModifierType,
  ModifierTarget,
  ModifierScope,
  ModifierEffect,
  ActiveModifier,
} from "./modifiers/index.js";