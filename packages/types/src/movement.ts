/**
 * 三阶段移动类型定义
 */

// ==================== 移动计划 ====================

export interface MovementPlan {
	phaseAForward: number;
	phaseAStrafe: number;
	turnAngle: number;
	phaseBForward: number;
	phaseBStrafe: number;
}

// ==================== 移动验证结果 ====================

export interface MovementValidation {
	valid: boolean;
	error?: string;
	finalPosition?: { x: number; y: number };
	finalHeading?: number;
}

// ==================== 移动燃料状态 ====================

export interface MovementFuelState {
	phaseAForwardUsed: number;
	phaseAStrafeUsed: number;
	phaseTurnUsed: number;
	phaseBForwardUsed: number;
	phaseBStrafeUsed: number;
	currentPhase: number;
}
