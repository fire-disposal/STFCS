// ==================== 数学工具 ====================
export {
	toRadians,
	toDegrees,
	distance,
	angleBetween,
	angleDifference,
	normalizeAngle,
	validateThreePhaseMove,
	isMoveValid,
	isTurnValid,
	createShipPolygon,
	checkCollision,
	isPointInArc,
	calculateThreePhaseMove,
	calculateMovementPlan,
	calculateMovementRange,
	getForwardVector,
	getRightVector,
	vec2,
	type MovementPlan,
	type MovementValidation,
} from "./math/index.js";

// ==================== 护甲计算 ====================
export {
	getQuadrantFromAngle,
	getQuadrantIndexFromAngle,
	calculateArmorDamageReduction,
	applyArmorDamage,
	isArmorDepleted,
	getArmorPercent,
	getAverageArmorPercent,
	repairArmor,
	setArmorQuadrant,
	createDefaultArmorState,
	createArmorStateWithDistribution,
	arrayToArmorState,
	armorStateToArray,
	getArmorQuadrantValue,
	takeDamageOnQuadrant,
	getWeakestQuadrant,
	getStrongestQuadrant,
	quadrantToIndex,
	indexToQuadrant,
	ARMOR_QUADRANT_NAMES,
	QUADRANT_INDEX_MAP,
	INDEX_TO_QUADRANT,
} from "./combat/armor.js";

// ==================== 从 @vt/types 重导出 ====================
export type {
	ArmorQuadrantValue,
	DamageTypeValue,
	ShipHullSpec,
} from "@vt/types";

// ==================== 从 @vt/data 重导出 ====================
export {
	getAvailableShips,
	getShipHullSpec,
	PRESET_SHIPS,
} from "@vt/data";

// ==================== 伤害计算 ====================
export {
	calculateShieldDamage,
	checkShieldHit,
	calculateArmorAndHullDamage,
	calculateFullDamage,
	applyDamageToShield,
	applyDamageToArmor,
	applyDamageToHull,
	calculateWeaponHitChance,
	type DamageResult,
	type ShieldDamageResult,
	type ArmorDamageResult,
	type HullDamageResult,
} from "./combat/damage.js";

// ==================== 游戏规则验证器 ====================
export {
	validateWeaponFire,
	validateShieldToggle,
	validateFluxVent,
	validateMovement,
	validateIncrementalMovement,
	validatePhaseTransition,
	validatePlayerAction,
	validateShipOwnership,
	validateMapBoundaries,
	type WeaponFireValidation,
	type ShieldToggleValidation,
	type FluxVentValidation,
	type PhaseTransitionValidation,
} from "./validation/index.js";
