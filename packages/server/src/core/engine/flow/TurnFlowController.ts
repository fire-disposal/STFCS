/**
 * 回合流程控制器 — 适配 GameMode + TurnState
 *
 * 操作在 TurnState（turn.number + turn.factionIndex）上，
 * 不再依赖 phase/activeFaction 联动。
 *
 * 三种模式：
 * - DEPLOYMENT: 无 turn，calculateTurnAdvance → 初始化 turn 进入 COMBAT
 * - COMBAT: turn 有效，推进 factionIndex/number
 * - WORLD: 无 turn，由 world RPC 驱动
 */

import type { GameRoomState, TokenRuntime, Faction, BattleLogEvent } from "@vt/data";
import { GameMode, DEFAULT_TURN_ORDER, createBattleLogEvent } from "@vt/data";
import { processTokenTurnEnd, type TurnEndResult } from "../rules/turnEnd.js";

export interface TurnAdvanceResult {
	modeChanged: boolean;
	newMode: GameMode;
	factionChanged: boolean;
	newFaction: Faction | undefined;
	turnIncremented: boolean;
	newTurnNumber: number;
	returnedToWorld: boolean;
	tokenResults: Map<string, TurnEndResult>;
	stateUpdates: Map<string, Partial<TokenRuntime>>;
	logEvents: BattleLogEvent[];
}

export interface TurnAdvanceValidation {
	valid: boolean;
	error?: string;
	/** 是否应该返回 WORLD 模式（世界观模式启用时所有派系完成） */
	shouldReturnToWorld: boolean;
}

/**
 * 验证回合推进是否允许
 */
export function validateTurnAdvance(state: GameRoomState, isHost: boolean): TurnAdvanceValidation {
	if (!isHost) return { valid: false, error: "只有房主可以推进回合", shouldReturnToWorld: false };

	if (state.mode === GameMode.DEPLOYMENT) {
		if (Object.keys(state.tokens).length === 0) {
			return { valid: false, error: "至少需要部署一艘舰船", shouldReturnToWorld: false };
		}
	}

	// 世界观模式：如果已经完成最后一个派系且世界模式启用，返回世界
	const shouldReturnToWorld =
		state.mode === GameMode.COMBAT &&
		!!state.world &&
		state.turn !== undefined &&
		state.turn.factionIndex >= DEFAULT_TURN_ORDER.length - 1;

	return { valid: true, shouldReturnToWorld };
}

/**
 * 执行回合推进
 *
 * 根据 mode 决定行为：
 * - DEPLOYMENT → 初始化 turn，进入 COMBAT
 * - COMBAT → factionIndex++，超出则 number++ 并重置
 * - COMBAT + world 模式 + 最后派系 → 返回 WORLD
 */
export function executeTurnAdvance(state: GameRoomState): TurnAdvanceResult {
	const result: TurnAdvanceResult = {
		modeChanged: false,
		newMode: state.mode,
		factionChanged: false,
		newFaction: undefined,
		turnIncremented: false,
		newTurnNumber: state.turn?.number ?? 0,
		returnedToWorld: false,
		tokenResults: new Map(),
		stateUpdates: new Map(),
		logEvents: [],
	};

	// DEPLOYMENT → COMBAT
	if (state.mode === GameMode.DEPLOYMENT) {
		result.modeChanged = true;
		result.newMode = GameMode.COMBAT;
		result.factionChanged = true;
		result.newFaction = DEFAULT_TURN_ORDER[0] as Faction;
		result.turnIncremented = true;
		result.newTurnNumber = 1;
		result.logEvents.push(
			createBattleLogEvent("game_started", { firstFaction: DEFAULT_TURN_ORDER[0] })
		);
		return result;
	}

	if (state.mode !== GameMode.COMBAT || !state.turn) {
		return result;
	}

	// COMBAT：推进 factionIndex
	const nextIndex = state.turn.factionIndex + 1;
	const isLastFaction = nextIndex >= DEFAULT_TURN_ORDER.length;

	// 世界观模式 + 最后派系 → 返回 WORLD
	if (isLastFaction && !!state.world) {
		result.modeChanged = true;
		result.newMode = GameMode.WORLD;
		result.factionChanged = true;
		result.newFaction = undefined;
		result.returnedToWorld = true;
		// 执行回合结算
		const settlement = processTurnEndSettlement(state);
		result.tokenResults = settlement.tokenResults;
		result.stateUpdates = settlement.stateUpdates;
		result.logEvents = settlement.logEvents;
		return result;
	}

	if (isLastFaction) {
		// 传统模式：回合递增
		result.turnIncremented = true;
		result.newTurnNumber = state.turn.number + 1;
		result.factionChanged = true;
		result.newFaction = DEFAULT_TURN_ORDER[0] as Faction;
		// 回合结算
		const settlement = processTurnEndSettlement(state);
		result.tokenResults = settlement.tokenResults;
		result.stateUpdates = settlement.stateUpdates;
		result.logEvents = settlement.logEvents;
	} else {
		// 派系内推进
		result.factionChanged = true;
		result.newFaction = DEFAULT_TURN_ORDER[nextIndex] as Faction;
	}

	return result;
}

/**
 * 处理所有舰船的回合结算
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
			if (token.runtime.shield) updates.shield = { ...token.runtime.shield, active: false };
		}
		if (result.weaponsUpdated && result.updatedWeapons) {
			updates.weapons = result.updatedWeapons;
		}

		stateUpdates.set(tokenId, updates);

		// 辐能结算日志
		if (
			result.shieldUpkeepAdded > 0 ||
			result.dissipationReduced > 0 ||
			result.ventingCleared ||
			result.fluxChange !== 0
		) {
			const fluxBefore = Math.round((token.runtime.fluxSoft ?? 0) + (token.runtime.fluxHard ?? 0));
			const fluxAfter = Math.round(result.newFluxSoft + result.newFluxHard);
			logEvents.push(
				createBattleLogEvent("flux_settlement", {
					tokenId,
					tokenName: token.metadata?.name ?? tokenId,
					shieldUpkeep: Math.round(result.shieldUpkeepAdded),
					dissipation: Math.round(result.dissipationReduced),
					ventingCleared: result.ventingCleared ? Math.round(result.ventingClearedAmount) : 0,
					fluxBefore,
					fluxAfter,
					fluxChange: Math.round(result.fluxChange),
					changeType:
						result.fluxChange > 0 ? "increase" : result.fluxChange < 0 ? "decrease" : "neutral",
				})
			);
		}
		if (result.overloadEnded) {
			logEvents.push(
				createBattleLogEvent("overload_end", {
					tokenId,
					tokenName: token.metadata?.name ?? tokenId,
				})
			);
		}
		if (result.overloadTriggered) {
			logEvents.push(
				createBattleLogEvent("overload", {
					tokenId,
					tokenName: token.metadata?.name ?? tokenId,
					reason: "shield_upkeep",
				})
			);
		}
	}

	return { tokenResults, stateUpdates, logEvents };
}
