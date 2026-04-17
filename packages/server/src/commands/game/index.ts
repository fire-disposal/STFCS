/**
 * 命令处理器导出
 */

// 移动命令
export { handleMove, handleAdvanceMovePhase } from "./moveHandler.js";

// 阶段管理
export { handleAdvancePhase } from "./phaseHandler.js";

// 查询逻辑
export { handleGetAttackableTargets, handleGetAllAttackableTargets } from "./queryHandler.js";

// 开火命令
export { handleFireWeapon, handleBurstFire } from "./fireHandler.js";
export type { FireResult } from "./fireHandler.js";

// 目标查询命令
export {
	handleQueryAttackableTargets,
	handleQueryAllAttackableTargets,
} from "./queryTargetHandler.js";
export type {
	TargetAttackability,
	AttackableTargetsResult,
	AllAttackableTargetsResult,
} from "./queryTargetHandler.js";

// 命中判定
export {
	performHitRoll,
	HitRollMode,
	calculateBaseHitProbability,
	calculateDistanceFactor,
	calculateManeuverFactor,
	getWeaponTypeHitFactor,
	calculateHitDeviation,
} from "./hitRollHandler.js";
export type { HitRollResult, HitRollConfig } from "./hitRollHandler.js";

// 伤害计算
export {
	applyDamage,
	estimateDamage,
	calculateArmorQuadrant,
	isHitInShieldArc,
	calculateArmorDamage,
} from "./damageCalculator.js";
export type { DamageResult } from "./damageCalculator.js";

// 护盾命令
export { handleToggleShield } from "./shieldHandler.js";

// 辐能命令
export { handleVentFlux } from "./fluxHandler.js";

// 舰船分配
export { handleAssignShip } from "./assignHandler.js";

// 武器配置命令
export {
	handleConfigureWeapon,
	handleConfigureVariant,
	handleRepairWeapon,
	validateShipOpConfiguration,
} from "./configureHandler.js";
export type { ConfigureResult } from "./configureHandler.js";

// 工具函数
export {
	validateAuthority,
	validateDmAuthority,
	normalizeHeading,
	getWeaponWorldPosition,
	assertTargetInWeaponArc,
	applyTranslation,
	MOVE_PHASE_ORDER,
	assertPhaseOrder,
	getMovePhase,
} from "./utils.js";