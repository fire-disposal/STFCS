/**
 * 回合流程控制器
 *
 * 统一管理：
 * 1. 回合推进逻辑（派系轮换、回合结算）
 * 2. 阶段切换逻辑（部署 → 行动）
 * 3. 辐能结算（护盾维持、自然散热、主动排散）
 * 4. 过载管理（触发、恢复）
 *
 * 设计原则：
 * - 纯计算函数（返回结果，无副作用）
 * - 数值统一整数化
 * - 单一入口点，消除逻辑分散
 */

import type { GameRoomState, TokenRuntime, Faction, BattleLogEvent } from "@vt/data";
import { TURN_ORDER, GamePhase, createBattleLogEvent } from "@vt/data";
import { processTokenTurnEnd, type TurnEndResult } from "../rules/turnEnd.js";

export interface TurnAdvanceResult {
	phaseChanged: boolean;
	newPhase: GamePhase;
	factionChanged: boolean;
	newFaction: Faction | undefined;
	turnIncremented: boolean;
	newTurnCount: number;
	tokenResults: Map<string, TurnEndResult>;
	stateUpdates: Map<string, Partial<TokenRuntime>>;
	logEvents: BattleLogEvent[];
}

export interface PhaseChangeResult {
	newPhase: GamePhase;
	newFaction?: Faction;
	turnIncremented: boolean;
	newTurnCount: number;
	valid: boolean;
	error?: string;
}

/**
 * 计算回合推进结果（纯函数）
 */
export function calculateTurnAdvance(state: GameRoomState): PhaseChangeResult {
	const currentPhase = state.phase;
	const currentTurn = Math.round(state.turnCount);
	const currentFaction = state.activeFaction;

	if (currentPhase === GamePhase.DEPLOYMENT) {
		return {
			newPhase: GamePhase.PLAYER_ACTION,
			newFaction: TURN_ORDER[0] as Faction,
			turnIncremented: true,
			newTurnCount: 1,
			valid: true,
		};
	}

	if (currentPhase === GamePhase.PLAYER_ACTION) {
		const currentIndex = currentFaction ? TURN_ORDER.indexOf(currentFaction as any) : -1;
		const nextIndex = currentIndex + 1;
		const incrementTurn = nextIndex >= TURN_ORDER.length;

		if (incrementTurn) {
			return {
				newPhase: GamePhase.PLAYER_ACTION,
				newFaction: TURN_ORDER[0] as Faction,
				turnIncremented: true,
				newTurnCount: currentTurn + 1,
				valid: true,
			};
		} else {
			return {
				newPhase: GamePhase.PLAYER_ACTION,
				newFaction: TURN_ORDER[nextIndex] as Faction,
				turnIncremented: false,
				newTurnCount: currentTurn,
				valid: true,
			};
		}
	}

	return {
		newPhase: currentPhase,
		turnIncremented: false,
		newTurnCount: currentTurn,
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

	// 回合结算（仅在回合递增时执行）
	if (phaseResult.turnIncremented && phaseResult.newPhase === GamePhase.PLAYER_ACTION) {
		const settlement = processTurnEndSettlement(state);
		result.tokenResults = settlement.tokenResults;
		result.stateUpdates = settlement.stateUpdates;
		result.logEvents = settlement.logEvents;
	}

	// 添加派系切换日志
	if (phaseResult.newFaction) {
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
export function validateTurnAdvance(state: GameRoomState, isHost: boolean): { valid: boolean; error?: string } {
	if (!isHost) {
		return { valid: false, error: "只有房主可以推进回合" };
	}

	if (state.phase === GamePhase.DEPLOYMENT) {
		// 部署阶段开始游戏需要检查是否有舰船
		const tokenCount = Object.keys(state.tokens).length;
		if (tokenCount === 0) {
			return { valid: false, error: "至少需要部署一艘舰船" };
		}
	}

	return { valid: true };
}