/**
 * 回合流程控制器
 *
 * 统一管理：
 * 1. 回合推进逻辑（派系轮换 → 结算 → 下一轮）
 * 2. 阶段切换逻辑（部署 → 行动 → 结算）
 * 3. 辐能结算（护盾维持、自然散热、主动排散）
 * 4. 过载管理（触发、恢复）
 *
 * 设计原则：
 * - 纯计算函数（返回结果，无副作用）
 * - 数值统一整数化
 * - 单一入口点，消除逻辑分散
 */

import type { GameRoomState, TokenRuntime, BattleLogEvent } from "@vt/data";
import { GamePhase, createBattleLogEvent } from "@vt/data";
import { processTokenTurnEnd, type TurnEndResult } from "../rules/turnEnd.js";

export interface TurnAdvanceResult {
	phaseChanged: boolean;
	newPhase: GamePhase;
	factionChanged: boolean;
	newFaction: string | undefined;
	turnIncremented: boolean;
	newTurnCount: number;
	tokenResults: Map<string, TurnEndResult>;
	stateUpdates: Map<string, Partial<TokenRuntime>>;
	logEvents: BattleLogEvent[];
}

export interface PhaseChangeResult {
	newPhase: GamePhase;
	newFaction: string | undefined;
	turnIncremented: boolean;
	newTurnCount: number;
	settlementNeeded: boolean;
	valid: boolean;
	error?: string;
}

/**
 * 清洗 initiativeOrder：去重 + 过滤不存在的派系
 */
function cleanOrder(state: GameRoomState): string[] {
	const raw = state.initiativeOrder;
	if (!raw || raw.length === 0) return [];
	const factions = state.factions;
	if (!factions) return [];
	const seen = new Set<string>();
	return raw.filter(id => {
		if (seen.has(id)) return false;
		if (!factions[id]) return false;
		seen.add(id);
		return true;
	});
}

/**
 * 计算回合推进结果（纯函数）
 *
 * 流程：
 *   FACTION_ACTION → FACTION_ACTION (next) 或 SETTLEMENT (last)
 *   SETTLEMENT → FACTION_ACTION (initiativeOrder[0], turn++)
 */
export function calculateTurnAdvance(state: GameRoomState): PhaseChangeResult {
	const currentPhase = state.phase;
	const currentTurn = Math.round(state.turnCount);
	const order = cleanOrder(state);

	if (currentPhase === GamePhase.FACTION_ACTION) {
		if (order.length === 0) {
			return { newPhase: currentPhase, newFaction: undefined, turnIncremented: false, newTurnCount: currentTurn, settlementNeeded: false, valid: false, error: "未配置 initiativeOrder" };
		}

		const rawIdx = state.initiativeIndex ?? order.indexOf(state.activeFaction ?? "");
		const currentIdx = Math.max(0, Math.min(rawIdx, order.length - 1));
		const nextIdx = currentIdx + 1;

		if (nextIdx >= order.length) {
			return {
				newPhase: GamePhase.SETTLEMENT,
				newFaction: undefined,
				turnIncremented: false,
				newTurnCount: currentTurn,
				settlementNeeded: true,
				valid: true,
			};
		}

		return {
			newPhase: GamePhase.FACTION_ACTION,
			newFaction: order[nextIdx],
			turnIncremented: false,
			newTurnCount: currentTurn,
			settlementNeeded: false,
			valid: true,
		};
	}

	if (currentPhase === GamePhase.SETTLEMENT) {
		if (order.length === 0) {
			return { newPhase: currentPhase, newFaction: undefined, turnIncremented: false, newTurnCount: currentTurn, settlementNeeded: false, valid: false, error: "未配置 initiativeOrder" };
		}
		return {
			newPhase: GamePhase.FACTION_ACTION,
			newFaction: order[0],
			turnIncremented: true,
			newTurnCount: currentTurn + 1,
			settlementNeeded: false,
			valid: true,
		};
	}

	return {
		newPhase: currentPhase,
		newFaction: undefined,
		turnIncremented: false,
		newTurnCount: currentTurn,
		settlementNeeded: false,
		valid: false,
		error: "未知阶段",
	};
}

/**
 * 处理回合结算（所有舰船）
 * 返回：状态更新 + 日志事件
 */
export function processTurnEndSettlement(state: GameRoomState): {
	tokenResults: Map<string, TurnEndResult>;
	stateUpdates: Map<string, Partial<TokenRuntime>>;
	logEvents: BattleLogEvent[];
} {
	const tokenResults = new Map<string, TurnEndResult>();
	const stateUpdates = new Map<string, Partial<TokenRuntime>>();
	const logEvents: BattleLogEvent[] = [];

	for (const tokenId of Object.keys(state.tokens)) {
		const token = state.tokens[tokenId];
		if (!token?.runtime || token.runtime.destroyed) continue;

		const result = processTokenTurnEnd(token);
		tokenResults.set(tokenId, result);

		// 构建状态更新
		const updates: Partial<TokenRuntime> = {
			fluxSoft: Math.round(result.newFluxSoft),
			fluxHard: Math.round(result.newFluxHard),
			venting: result.ventingCleared ? false : token.runtime.venting,
			movement: {
				currentPhase: "A",
				hasMoved: false,
				phaseAUsed: 0,
				turnAngleUsed: 0,
				phaseCUsed: 0,
				phaseALock: null,
				phaseCLock: null,
			},
			hasFired: false,
		};

		if (result.overloadEnded) {
			updates.overloaded = false;
			updates.overloadTime = 0;
		}

		if (result.overloadTriggered) {
			updates.overloaded = true;
			updates.overloadTime = 1;
			if (token.runtime.shield) {
				updates.shield = { ...token.runtime.shield, active: false };
			}
		}

		if (result.weaponsUpdated && result.updatedWeapons) {
			updates.weapons = result.updatedWeapons;
		}

		stateUpdates.set(tokenId, updates);

		// 辐能结算日志
		if (result.shieldUpkeepAdded > 0 || result.dissipationReduced > 0 || result.ventingCleared || result.fluxChange !== 0) {
			const fluxBefore = Math.round((token.runtime.fluxSoft ?? 0) + (token.runtime.fluxHard ?? 0));
			const fluxAfter = Math.round(result.newFluxSoft + result.newFluxHard);

			logEvents.push(createBattleLogEvent("flux_settlement", {
				tokenId,
				tokenName: token.metadata?.name ?? tokenId,
				shieldUpkeep: Math.round(result.shieldUpkeepAdded),
				dissipation: Math.round(result.dissipationReduced),
				ventingCleared: result.ventingCleared ? Math.round(result.ventingClearedAmount) : 0,
				fluxBefore,
				fluxAfter,
				fluxChange: Math.round(result.fluxChange),
				changeType: result.fluxChange > 0 ? "increase" : result.fluxChange < 0 ? "decrease" : "neutral",
			}));
		}

		// 过载恢复日志
		if (result.overloadEnded) {
			logEvents.push(createBattleLogEvent("overload_end", {
				tokenId,
				tokenName: token.metadata?.name ?? tokenId,
			}));
		}

		// 过载触发日志（护盾维持导致）
		if (result.overloadTriggered) {
			logEvents.push(createBattleLogEvent("overload", {
				tokenId,
				tokenName: token.metadata?.name ?? tokenId,
				reason: "shield_upkeep",
			}));
		}
	}

	return { tokenResults, stateUpdates, logEvents };
}

/**
 * 执行完整的回合推进流程（组合函数）
 */
export function executeTurnAdvance(state: GameRoomState): TurnAdvanceResult {
	const phaseResult = calculateTurnAdvance(state);

	const result: TurnAdvanceResult = {
		phaseChanged: state.phase !== phaseResult.newPhase,
		newPhase: phaseResult.newPhase,
		factionChanged: state.activeFaction !== phaseResult.newFaction,
		newFaction: phaseResult.newFaction ?? undefined,
		turnIncremented: phaseResult.turnIncremented,
		newTurnCount: Math.round(phaseResult.newTurnCount),
		tokenResults: new Map(),
		stateUpdates: new Map(),
		logEvents: [],
	};

	// 回合结算（仅在进入 SETTLEMENT 或旧 turn++ 时执行）
	if (phaseResult.settlementNeeded) {
		const settlement = processTurnEndSettlement(state);
		result.tokenResults = settlement.tokenResults;
		result.stateUpdates = settlement.stateUpdates;
		result.logEvents = settlement.logEvents;

		// 回合结束播报
		result.logEvents.push(createBattleLogEvent("round_end", {
			round: Math.round(state.turnCount),
			phase: state.phase,
		}));
	}

	// 添加派系切换日志
	if (phaseResult.newFaction) {
		if (state.activeFaction && state.phase === GamePhase.FACTION_ACTION) {
			const currentFactionName = state.factions?.[state.activeFaction]?.name ?? state.activeFaction;
			result.logEvents.push(createBattleLogEvent("faction_turn_end", {
				faction: state.activeFaction,
				factionName: currentFactionName,
				turn: state.turnCount,
			}));
		}
		result.logEvents.push(createBattleLogEvent("faction_change", {
			fromFaction: state.activeFaction,
			toFaction: phaseResult.newFaction,
			turn: result.newTurnCount,
		}));
	}

	return result;
}

/**
 * 验证回合推进是否允许
 */
export function validateTurnAdvance(_state: GameRoomState, isHost: boolean): { valid: boolean; error?: string } {
	if (!isHost) {
		return { valid: false, error: "只有房主可以推进回合" };
	}

	return { valid: true };
}