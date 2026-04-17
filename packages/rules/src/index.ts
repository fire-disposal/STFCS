/**
 * @vt/rules - 游戏规则计算包
 *
 * 只包含实际使用的核心功能：
 * - 数学计算（角度、向量、碰撞）
 * - 移动验证（三阶段移动）
 * - 阶段管理（回合阶段转换）
 *
 * 其他类型请直接从对应包导入：
 * - 枚举/配置：@vt/data
 * - Schema 类型：@vt/schema-types
 * - DTO/存档：@vt/server/schema/types
 */

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
	getMountWorldPosition,
	vec2,
	type MovementPlan,
	type MovementValidation,
} from "./math/index.js";

// ==================== 阶段管理（纯函数）====================
export {
	PHASE_ORDER,
	getNextPhase,
	getPhaseIndex,
	isCyclicPhase,
	getActiveFactionForPhase,
	isValidPhaseTransition,
	computePhaseTransition,
	type PhaseTransitionResult,
} from "./phase/index.js";