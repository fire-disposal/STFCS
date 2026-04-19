/**
 * 规则模块导出
 */

export { calculateDamage, calculateEmpDamage, calculateDamageModifier } from "./damage.js";
export * from "./armor.js";
export { calculateWeaponAttack, calculateHitChance, calculateWeaponCooldown, isWeaponReady, setWeaponFired, updateWeaponStateAtTurnEnd } from "./weapon.js";