/**
 * 移动系统状态管理 - 燃料池制度
 *
 * 三阶段移动系统（基于 Starsector）：
 * - 阶段 A: 平移 - 2X 前进/后退燃料 + X 侧移燃料
 * - 阶段 B: 转向 - Y 转向燃料
 * - 阶段 C: 平移 - 2X 前进/后退燃料 + X 侧移燃料
 *
 * 核心特性：
 * - 每个阶段有独立的燃料池
 * - 阶段内可任意次数消耗燃料（Incremental movement）
 * - 攻击不消耗燃料，可在任何时机进行
 * - 玩家主动切换阶段或燃料耗尽自动结束
 */

import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { Point } from "@vt/types";

// 移动指令
export interface MovementCommand {
	forward?: number; // 前进/后退距离（正=前进，负=后退）
	strafe?: number; // 侧移距离（正=右舷，负=左舷）
	turn?: number; // 转向角度（正=右转，负=左转）
}

// 燃料池
export interface FuelPool {
	forwardMax: number; // 前进/后退燃料上限
	forwardUsed: number; // 已消耗的前进燃料
	strafeMax: number; // 侧移燃料上限
	strafeUsed: number; // 已消耗的侧移燃料
	turnMax: number; // 转向燃料上限
	turnUsed: number; // 已消耗的转向燃料
}

// 移动阶段枚举
export enum MovementPhase {
	NONE = "NONE", // 未开始
	PHASE_A = "PHASE_A", // 阶段 A: 平移
	PHASE_B = "PHASE_B", // 阶段 B: 转向
	PHASE_C = "PHASE_C", // 阶段 C: 平移
	COMPLETED = "COMPLETED", // 已完成
}

// 攻击状态
export interface AttackState {
	hasAttacked: boolean;
	attackCount: number;
	lastAttackPhase: MovementPhase | null;
}

export interface MovementRangePoint extends Point {
	reachable: boolean;
	distance: number;
}

// 阶段燃料状态
export interface PhaseFuelState {
	fuel: FuelPool;
	isExecuting: boolean; // 正在执行动画
	lastMove: MovementCommand | null; // 最后一次移动指令
}

interface MovementState {
	// 当前阶段
	currentPhase: MovementPhase;

	// 各阶段燃料状态
	phaseA: PhaseFuelState;
	phaseB: PhaseFuelState;
	phaseC: PhaseFuelState;

	// 攻击状态（每回合独立）
	attacks: AttackState;

	// 移动验证状态
	isValid: boolean;
	validationError: string | null;

	// 机动范围（可达点）
	movementRange: MovementRangePoint[];

	// 本回合已执行移动（用于服务器同步）
	executedMoves: Array<{
		shipId: string;
		phase: MovementPhase;
		command: MovementCommand;
	}>;

	// 移动预览设置
	showRange: boolean;
	showTurnArc: boolean;

	// 动画状态
	isAnimating: boolean;
	animationPhase: MovementPhase | null;

	// 回合信息
	turnNumber: number;

	// 舰船机动参数
	shipMaxSpeed: number;
	shipMaxTurnRate: number;
}

const initialPhaseFuelState: PhaseFuelState = {
	fuel: {
		forwardMax: 0,
		forwardUsed: 0,
		strafeMax: 0,
		strafeUsed: 0,
		turnMax: 0,
		turnUsed: 0,
	},
	isExecuting: false,
	lastMove: null,
};

const initialState: MovementState = {
	currentPhase: MovementPhase.NONE,
	phaseA: { ...initialPhaseFuelState },
	phaseB: { ...initialPhaseFuelState },
	phaseC: { ...initialPhaseFuelState },
	attacks: {
		hasAttacked: false,
		attackCount: 0,
		lastAttackPhase: null,
	},
	isValid: false,
	validationError: null,
	movementRange: [],
	executedMoves: [],
	showRange: true,
	showTurnArc: true,
	isAnimating: false,
	animationPhase: null,
	turnNumber: 1,
	shipMaxSpeed: 0,
	shipMaxTurnRate: 0,
};

const movementSlice = createSlice({
	name: "movement",
	initialState,
	reducers: {
		// 开始移动流程（初始化燃料池）
		startMovement: (
			state,
			action: PayloadAction<{
				maxSpeed: number;
				maxTurnRate: number;
			}>
		) => {
			const { maxSpeed, maxTurnRate } = action.payload;
			state.shipMaxSpeed = maxSpeed;
			state.shipMaxTurnRate = maxTurnRate;

			state.currentPhase = MovementPhase.PHASE_A;

			// 阶段 A：2X 前进燃料 + X 侧移燃料
			state.phaseA = {
				...initialPhaseFuelState,
				fuel: {
					forwardMax: maxSpeed * 2,
					forwardUsed: 0,
					strafeMax: maxSpeed,
					strafeUsed: 0,
					turnMax: 0,
					turnUsed: 0,
				},
			};

			// 阶段 B：Y 转向燃料
			state.phaseB = {
				...initialPhaseFuelState,
				fuel: {
					forwardMax: 0,
					forwardUsed: 0,
					strafeMax: 0,
					strafeUsed: 0,
					turnMax: maxTurnRate,
					turnUsed: 0,
				},
			};

			// 阶段 C：2X 前进燃料 + X 侧移燃料
			state.phaseC = {
				...initialPhaseFuelState,
				fuel: {
					forwardMax: maxSpeed * 2,
					forwardUsed: 0,
					strafeMax: maxSpeed,
					strafeUsed: 0,
					turnMax: 0,
					turnUsed: 0,
				},
			};

			state.attacks = {
				hasAttacked: false,
				attackCount: 0,
				lastAttackPhase: null,
			};
			state.executedMoves = [];
		},

		// 执行增量移动（消耗燃料）
		executeMove: (
			state,
			action: PayloadAction<{
				phase: MovementPhase;
				command: MovementCommand;
			}>
		) => {
			const { phase, command } = action.payload;
			let phaseState: PhaseFuelState;

			switch (phase) {
				case MovementPhase.PHASE_A:
					phaseState = state.phaseA;
					break;
				case MovementPhase.PHASE_B:
					phaseState = state.phaseB;
					break;
				case MovementPhase.PHASE_C:
					phaseState = state.phaseC;
					break;
				default:
					return;
			}

			// 消耗燃料
			if (command.forward !== undefined && command.forward !== 0) {
				phaseState.fuel.forwardUsed += Math.abs(command.forward);
			}
			if (command.strafe !== undefined && command.strafe !== 0) {
				phaseState.fuel.strafeUsed += Math.abs(command.strafe);
			}
			if (command.turn !== undefined && command.turn !== 0) {
				phaseState.fuel.turnUsed += Math.abs(command.turn);
			}

			phaseState.lastMove = command;

			// 记录执行过的移动（用于服务器同步）
			state.executedMoves.push({
				shipId: "current", // 实际使用时需要传入具体 shipId
				phase,
				command,
			});
		},

		// 切换到下一阶段
		advancePhase: (state) => {
			switch (state.currentPhase) {
				case MovementPhase.PHASE_A:
					state.currentPhase = MovementPhase.PHASE_B;
					break;
				case MovementPhase.PHASE_B:
					state.currentPhase = MovementPhase.PHASE_C;
					break;
				case MovementPhase.PHASE_C:
					state.currentPhase = MovementPhase.COMPLETED;
					break;
			}
		},

		// 设置当前阶段
		setCurrentPhase: (state, action: PayloadAction<MovementPhase>) => {
			state.currentPhase = action.payload;
		},

		// 开始执行动画
		startAnimation: (
			state,
			action: PayloadAction<{
				phase: MovementPhase;
				command: MovementCommand;
			}>
		) => {
			const { phase } = action.payload;
			state.isAnimating = true;
			state.animationPhase = phase;

			switch (phase) {
				case MovementPhase.PHASE_A:
					state.phaseA.isExecuting = true;
					break;
				case MovementPhase.PHASE_B:
					state.phaseB.isExecuting = true;
					break;
				case MovementPhase.PHASE_C:
					state.phaseC.isExecuting = true;
					break;
			}
		},

		// 完成动画
		completeAnimation: (state, action: PayloadAction<MovementPhase>) => {
			const phase = action.payload;
			state.isAnimating = false;
			state.animationPhase = null;

			switch (phase) {
				case MovementPhase.PHASE_A:
					state.phaseA.isExecuting = false;
					break;
				case MovementPhase.PHASE_B:
					state.phaseB.isExecuting = false;
					break;
				case MovementPhase.PHASE_C:
					state.phaseC.isExecuting = false;
					break;
			}
		},

		// 注册攻击
		registerAttack: (state) => {
			state.attacks.hasAttacked = true;
			state.attacks.attackCount++;
			state.attacks.lastAttackPhase = state.currentPhase;
		},

		// 验证移动指令
		validateMove: (
			state,
			action: PayloadAction<{
				phase: MovementPhase;
				command: MovementCommand;
			}>
		) => {
			const { phase, command } = action.payload;
			let phaseState: PhaseFuelState;

			switch (phase) {
				case MovementPhase.PHASE_A:
					phaseState = state.phaseA;
					break;
				case MovementPhase.PHASE_B:
					phaseState = state.phaseB;
					break;
				case MovementPhase.PHASE_C:
					phaseState = state.phaseC;
					break;
				default:
					state.isValid = false;
					state.validationError = "无效的移动阶段";
					return;
			}

			const { fuel } = phaseState;
			let isValid = true;
			let error = "";

			// 检查前进燃料
			if (command.forward !== undefined && command.forward !== 0) {
				const remainingForward = fuel.forwardMax - fuel.forwardUsed;
				if (Math.abs(command.forward) > remainingForward) {
					isValid = false;
					error = `前进燃料不足：需要 ${Math.abs(command.forward)}，剩余 ${remainingForward.toFixed(0)}`;
				}
			}

			// 检查侧移燃料
			if (command.strafe !== undefined && command.strafe !== 0) {
				const remainingStrafe = fuel.strafeMax - fuel.strafeUsed;
				if (Math.abs(command.strafe) > remainingStrafe) {
					isValid = false;
					error = `侧移燃料不足：需要 ${Math.abs(command.strafe)}，剩余 ${remainingStrafe.toFixed(0)}`;
				}
			}

			// 检查转向燃料
			if (command.turn !== undefined && command.turn !== 0) {
				const remainingTurn = fuel.turnMax - fuel.turnUsed;
				if (Math.abs(command.turn) > remainingTurn) {
					isValid = false;
					error = `转向燃料不足：需要 ${Math.abs(command.turn)}，剩余 ${remainingTurn.toFixed(0)}`;
				}
			}

			state.isValid = isValid;
			state.validationError = error;
		},

		// 计算机动范围
		setMovementRange: (state, action: PayloadAction<MovementRangePoint[]>) => {
			state.movementRange = action.payload;
		},

		// 清除机动范围
		clearMovementRange: (state) => {
			state.movementRange = [];
		},

		// 切换范围显示
		toggleRangeDisplay: (state) => {
			state.showRange = !state.showRange;
		},

		// 切换转向弧显示
		toggleTurnArcDisplay: (state) => {
			state.showTurnArc = !state.showTurnArc;
		},

		// 设置范围显示
		setRangeDisplay: (state, action: PayloadAction<boolean>) => {
			state.showRange = action.payload;
		},

		// 设置转向弧显示
		setTurnArcDisplay: (state, action: PayloadAction<boolean>) => {
			state.showTurnArc = action.payload;
		},

		// 更新回合数
		setTurnNumber: (state, action: PayloadAction<number>) => {
			state.turnNumber = action.payload;
		},

		// 新回合开始（重置所有状态）
		newTurn: (
			state,
			action: PayloadAction<{
				turnNumber: number;
				maxSpeed: number;
				maxTurnRate: number;
			}>
		) => {
			const { turnNumber, maxSpeed, maxTurnRate } = action.payload;
			state.turnNumber = turnNumber;
			state.shipMaxSpeed = maxSpeed;
			state.shipMaxTurnRate = maxTurnRate;

			state.currentPhase = MovementPhase.NONE;

			// 重置各阶段燃料池
			state.phaseA = {
				...initialPhaseFuelState,
				fuel: {
					forwardMax: maxSpeed * 2,
					forwardUsed: 0,
					strafeMax: maxSpeed,
					strafeUsed: 0,
					turnMax: 0,
					turnUsed: 0,
				},
			};

			state.phaseB = {
				...initialPhaseFuelState,
				fuel: {
					forwardMax: 0,
					forwardUsed: 0,
					strafeMax: 0,
					strafeUsed: 0,
					turnMax: maxTurnRate,
					turnUsed: 0,
				},
			};

			state.phaseC = {
				...initialPhaseFuelState,
				fuel: {
					forwardMax: maxSpeed * 2,
					forwardUsed: 0,
					strafeMax: maxSpeed,
					strafeUsed: 0,
					turnMax: 0,
					turnUsed: 0,
				},
			};

			state.attacks = {
				hasAttacked: false,
				attackCount: 0,
				lastAttackPhase: null,
			};
			state.executedMoves = [];
			state.isValid = false;
			state.validationError = null;
			state.isAnimating = false;
			state.animationPhase = null;
		},

		// 清除所有状态
		clearMovement: (state) => {
			state.currentPhase = MovementPhase.NONE;
			state.phaseA = { ...initialPhaseFuelState };
			state.phaseB = { ...initialPhaseFuelState };
			state.phaseC = { ...initialPhaseFuelState };
			state.attacks = {
				hasAttacked: false,
				attackCount: 0,
				lastAttackPhase: null,
			};
			state.executedMoves = [];
			state.isValid = false;
			state.validationError = null;
		},
	},
});

export const {
	startMovement,
	executeMove,
	advancePhase,
	setCurrentPhase,
	startAnimation,
	completeAnimation,
	registerAttack,
	validateMove,
	setMovementRange,
	clearMovementRange,
	toggleRangeDisplay,
	toggleTurnArcDisplay,
	setRangeDisplay,
	setTurnArcDisplay,
	setTurnNumber,
	newTurn,
	clearMovement,
} = movementSlice.actions;

// 辅助函数：获取剩余燃料
export function getRemainingFuel(
	state: MovementState,
	phase: MovementPhase
): {
	forward: number;
	strafe: number;
	turn: number;
} {
	let phaseState: PhaseFuelState;

	switch (phase) {
		case MovementPhase.PHASE_A:
			phaseState = state.phaseA;
			break;
		case MovementPhase.PHASE_B:
			phaseState = state.phaseB;
			break;
		case MovementPhase.PHASE_C:
			phaseState = state.phaseC;
			break;
		default:
			return { forward: 0, strafe: 0, turn: 0 };
	}

	const { fuel } = phaseState;
	return {
		forward: fuel.forwardMax - fuel.forwardUsed,
		strafe: fuel.strafeMax - fuel.strafeUsed,
		turn: fuel.turnMax - fuel.turnUsed,
	};
}

// 辅助函数：检查阶段是否有剩余燃料
export function hasRemainingFuel(state: MovementState, phase: MovementPhase): boolean {
	const remaining = getRemainingFuel(state, phase);
	return remaining.forward > 0 || remaining.strafe > 0 || remaining.turn > 0;
}

export default movementSlice.reducer;
