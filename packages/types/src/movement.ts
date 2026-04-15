/**
 * 三阶段移动类型定义
 */

export const MovePhase = {
	PHASE_A: "PHASE_A",
	PHASE_B: "PHASE_B",
	PHASE_C: "PHASE_C",
} as const;

export type MovePhaseValue = (typeof MovePhase)[keyof typeof MovePhase];

// ==================== 移动计划 ====================

export interface MovementPlan {
	phaseAForward: number;
	phaseAStrafe: number;
	turnAngle: number;
	phaseCForward: number;
	phaseCStrafe: number;
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
	phaseCForwardUsed: number;
	phaseCStrafeUsed: number;
	currentPhase: MovePhaseValue;
}
