/**
 * 三阶段移动类型定义
 *
 * 当前系统使用燃料池制度（Fuel-based）：
 * - Phase A: 平移 - 2X 前进燃料 + X 侧移燃料
 * - Phase B: 转向 - Y 转向燃料
 * - Phase C: 平移 - 2X 前进燃料 + X 侧移燃料
 */

export const MovePhase = {
	PHASE_A: "PHASE_A",
	PHASE_B: "PHASE_B",
	PHASE_C: "PHASE_C",
} as const;

export type MovePhaseValue = (typeof MovePhase)[keyof typeof MovePhase];

// ==================== 移动计划 ====================

/**
 * 移动计划
 * 用于客户端提交移动指令到服务端
 */
export interface MovementPlan {
	phaseAForward: number;
	phaseAStrafe: number;
	turnAngle: number;
	phaseCForward: number;
	phaseCStrafe: number;
}

// ==================== 移动验证结果 ====================

/**
 * 移动验证结果
 * 服务端验证移动计划后返回
 */
export interface MovementValidation {
	valid: boolean;
	error?: string;
	finalPosition?: { x: number; y: number };
	finalHeading?: number;
}
