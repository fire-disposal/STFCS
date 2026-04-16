/**
 * 游戏阶段管理（纯函数）
 *
 * 提供阶段计算的纯函数逻辑，不涉及状态修改
 */

import { GamePhase, Faction } from "@vt/data";
import type { GamePhaseValue, FactionValue } from "@vt/data";

/** 游戏阶段顺序 */
export const PHASE_ORDER: readonly GamePhaseValue[] = [
	GamePhase.DEPLOYMENT,
	GamePhase.PLAYER_TURN,
	GamePhase.DM_TURN,
	GamePhase.END_PHASE,
];

/** 计算下一个阶段 */
export function getNextPhase(currentPhase: GamePhaseValue): GamePhaseValue {
	const idx = PHASE_ORDER.indexOf(currentPhase);
	// 跳过 DEPLOYMENT，从 PLAYER_TURN 循环
	if (idx < 0) return GamePhase.PLAYER_TURN;
	if (idx + 1 >= PHASE_ORDER.length) return PHASE_ORDER[1];
	return PHASE_ORDER[idx + 1];
}

/** 计算阶段索引 */
export function getPhaseIndex(phase: GamePhaseValue): number {
	return PHASE_ORDER.indexOf(phase);
}

/** 判断是否是循环阶段（PLAYER_TURN -> DM_TURN -> END_PHASE） */
export function isCyclicPhase(phase: GamePhaseValue): boolean {
	return phase !== GamePhase.DEPLOYMENT && phase !== GamePhase.END;
}

/** 获取阶段对应的活跃阵营 */
export function getActiveFactionForPhase(phase: GamePhaseValue): FactionValue {
	if (phase === GamePhase.PLAYER_TURN) return Faction.PLAYER;
	if (phase === GamePhase.DM_TURN) return Faction.DM;
	return Faction.NEUTRAL;
}

/** 验证阶段转换是否合法 */
export function isValidPhaseTransition(from: GamePhaseValue, to: GamePhaseValue): boolean {
	const allowedTransitions: Record<GamePhaseValue, readonly GamePhaseValue[]> = {
		DEPLOYMENT: [GamePhase.PLAYER_TURN],
		PLAYER_TURN: [GamePhase.DM_TURN, GamePhase.END_PHASE],
		DM_TURN: [GamePhase.END_PHASE],
		END_PHASE: [GamePhase.PLAYER_TURN],
		BATTLE: [GamePhase.END],
		END: [],
	};

	return allowedTransitions[from]?.includes(to) ?? false;
}

/** 阶段转换结果 */
export interface PhaseTransitionResult {
	nextPhase: GamePhaseValue;
	activeFaction: FactionValue;
	shouldProcessEndPhase: boolean;
}

/** 计算阶段转换的完整结果 */
export function computePhaseTransition(currentPhase: GamePhaseValue): PhaseTransitionResult {
	const nextPhase = getNextPhase(currentPhase);
	const activeFaction = getActiveFactionForPhase(nextPhase);
	const shouldProcessEndPhase = nextPhase === GamePhase.END_PHASE;

	return {
		nextPhase,
		activeFaction,
		shouldProcessEndPhase,
	};
}