/**
 * 游戏流程状态管理 Slice
 *
 * 管理游戏阶段状态：
 * - 游戏主阶段 (lobby/deployment/playing/paused/ended)
 * - 回合内阶段 (player_action/dm_action/resolution)
 * - 部署状态
 * - 回合结算
 */

import { type PayloadAction, createSelector, createSlice } from "@reduxjs/toolkit";
import type { FactionId } from "@vt/types";
import type { GamePhase, ShipActionState, TurnPhase } from "@vt/types";

/**
 * 回合结算结果
 */
interface TurnResolutionResult {
	roundNumber: number;
	fluxDissipation: Array<{
		shipId: string;
		previousFlux: number;
		newFlux: number;
	}>;
	overloadResets: string[];
	ventCompletions: string[];
}

/**
 * 游戏流程状态
 */
interface GameFlowSliceState {
	// 游戏主阶段
	phase: GamePhase;
	// 回合内阶段
	turnPhase: TurnPhase;
	// 当前回合数
	roundNumber: number;
	// 当前行动阵营
	currentFaction: FactionId | null;
	// 部署准备状态
	deploymentReady: Record<FactionId, boolean>;
	// 舰船行动状态
	shipActionStates: Record<string, ShipActionState>;
	// 最近一次回合结算
	lastResolution: TurnResolutionResult | null;
	// 是否已初始化
	isInitialized: boolean;
}

const initialState: GameFlowSliceState = {
	phase: "lobby",
	turnPhase: "player_action",
	roundNumber: 0,
	currentFaction: null,
	deploymentReady: {},
	shipActionStates: {},
	lastResolution: null,
	isInitialized: false,
};

const gameFlowSlice = createSlice({
	name: "gameFlow",
	initialState,
	reducers: {
		/**
		 * 设置游戏阶段
		 */
		setGamePhase: (
			state,
			action: PayloadAction<{
				phase: GamePhase;
				previousPhase?: GamePhase;
			}>
		) => {
			state.phase = action.payload.phase;
		},

		/**
		 * 设置回合阶段
		 */
		setTurnPhase: (
			state,
			action: PayloadAction<{
				turnPhase: TurnPhase;
				roundNumber?: number;
			}>
		) => {
			state.turnPhase = action.payload.turnPhase;
			if (action.payload.roundNumber !== undefined) {
				state.roundNumber = action.payload.roundNumber;
			}
		},

		/**
		 * 开始部署阶段
		 */
		startDeployment: (
			state,
			action: PayloadAction<{
				factions: FactionId[];
			}>
		) => {
			state.phase = "deployment";
			state.deploymentReady = Object.fromEntries(action.payload.factions.map((f) => [f, false]));
		},

		/**
		 * 设置部署准备状态
		 */
		setDeploymentReady: (
			state,
			action: PayloadAction<{
				faction: FactionId;
				playerId: string;
				ready: boolean;
			}>
		) => {
			state.deploymentReady[action.payload.faction] = action.payload.ready;
		},

		/**
		 * 完成部署
		 */
		completeDeployment: (state) => {
			state.phase = "playing";
			state.roundNumber = 1;
			state.turnPhase = "player_action";
		},

		/**
		 * 开始游戏
		 */
		startGame: (
			state,
			action: PayloadAction<{
				roundNumber: number;
				currentFaction: FactionId;
			}>
		) => {
			state.phase = "playing";
			state.roundNumber = action.payload.roundNumber;
			state.currentFaction = action.payload.currentFaction;
			state.turnPhase = "player_action";
			state.isInitialized = true;
		},

		/**
		 * 设置当前阵营
		 */
		setCurrentFaction: (state, action: PayloadAction<FactionId>) => {
			state.currentFaction = action.payload;
		},

		/**
		 * 设置回合数
		 */
		setRoundNumber: (state, action: PayloadAction<number>) => {
			state.roundNumber = action.payload;
		},

		/**
		 * 更新舰船行动状态
		 */
		updateShipActionState: (
			state,
			action: PayloadAction<{
				shipId: string;
				state: Partial<ShipActionState>;
			}>
		) => {
			const { shipId, state: updates } = action.payload;
			if (state.shipActionStates[shipId]) {
				Object.assign(state.shipActionStates[shipId], updates);
			} else {
				state.shipActionStates[shipId] = {
					shipId,
					hasActed: false,
					hasMoved: false,
					hasRotated: false,
					hasFired: false,
					hasToggledShield: false,
					hasVented: false,
					isOverloaded: false,
					overloadResetAvailable: false,
					remainingActions: 0,
					movementRemaining: 0,
					...updates,
				};
			}
		},

		/**
		 * 批量设置舰船行动状态
		 */
		setShipActionStates: (state, action: PayloadAction<Record<string, ShipActionState>>) => {
			state.shipActionStates = action.payload;
		},

		/**
		 * 设置过载重置可用状态
		 */
		setOverloadResetAvailable: (
			state,
			action: PayloadAction<{
				shipId: string;
				available: boolean;
			}>
		) => {
			const { shipId, available } = action.payload;
			if (state.shipActionStates[shipId]) {
				state.shipActionStates[shipId].overloadResetAvailable = available;
			}
		},

		/**
		 * 处理回合结算
		 */
		handleTurnResolution: (state, action: PayloadAction<TurnResolutionResult>) => {
			state.lastResolution = action.payload;

			// 更新舰船状态
			for (const { shipId, newFlux } of action.payload.fluxDissipation) {
				if (state.shipActionStates[shipId]) {
					// 重置行动状态
					state.shipActionStates[shipId].hasMoved = false;
					state.shipActionStates[shipId].hasRotated = false;
					state.shipActionStates[shipId].hasFired = false;
					state.shipActionStates[shipId].hasToggledShield = false;
					state.shipActionStates[shipId].hasVented = false;
				}
			}

			// 处理过载解除
			for (const shipId of action.payload.overloadResets) {
				if (state.shipActionStates[shipId]) {
					state.shipActionStates[shipId].isOverloaded = false;
					state.shipActionStates[shipId].overloadResetAvailable = false;
				}
			}

			// 处理主动排散完成
			for (const shipId of action.payload.ventCompletions) {
				if (state.shipActionStates[shipId]) {
					state.shipActionStates[shipId].hasVented = false;
				}
			}
		},

		/**
		 * 暂停游戏
		 */
		pauseGame: (state) => {
			state.phase = "paused";
		},

		/**
		 * 恢复游戏
		 */
		resumeGame: (state) => {
			state.phase = "playing";
		},

		/**
		 * 结束游戏
		 */
		endGame: (
			state,
			action: PayloadAction<{
				winner?: FactionId;
			}>
		) => {
			state.phase = "ended";
		},

		/**
		 * 重置游戏流程状态
		 */
		resetGameFlow: () => {
			return { ...initialState };
		},
	},
});

export const {
	setGamePhase,
	setTurnPhase,
	startDeployment,
	setDeploymentReady,
	completeDeployment,
	startGame,
	setCurrentFaction,
	setRoundNumber,
	updateShipActionState,
	setShipActionStates,
	setOverloadResetAvailable,
	handleTurnResolution,
	pauseGame,
	resumeGame,
	endGame,
	resetGameFlow,
} = gameFlowSlice.actions;

// ==================== 选择器 ====================

// 基础选择器
const selectGameFlowState = (state: { gameFlow: GameFlowSliceState }) => state.gameFlow;

// 简单选择器
export const selectGamePhase = (state: { gameFlow: GameFlowSliceState }) => state.gameFlow.phase;

export const selectTurnPhase = (state: { gameFlow: GameFlowSliceState }) =>
	state.gameFlow.turnPhase;

export const selectRoundNumber = (state: { gameFlow: GameFlowSliceState }) =>
	state.gameFlow.roundNumber;

export const selectCurrentFaction = (state: { gameFlow: GameFlowSliceState }) =>
	state.gameFlow.currentFaction;

export const selectDeploymentReady = (state: { gameFlow: GameFlowSliceState }) =>
	state.gameFlow.deploymentReady;

export const selectIsGameInitialized = (state: { gameFlow: GameFlowSliceState }) =>
	state.gameFlow.isInitialized;

export const selectLastResolution = (state: { gameFlow: GameFlowSliceState }) =>
	state.gameFlow.lastResolution;

// Memoized 选择器
export const selectShipActionStates = createSelector(
	[selectGameFlowState],
	(state) => state.shipActionStates
);

export const selectShipActionState = (shipId: string) =>
	createSelector([selectShipActionStates], (states) => states[shipId]);

export const selectIsDeploymentComplete = createSelector([selectDeploymentReady], (ready) =>
	Object.values(ready).every((r) => r)
);

export const selectIsPlayerTurn = (playerFaction: FactionId | null) =>
	createSelector(
		[selectCurrentFaction, selectGamePhase],
		(currentFaction, phase) => phase === "playing" && currentFaction === playerFaction
	);

export const selectCanShipAct = (shipId: string) =>
	createSelector([selectShipActionState(shipId)], (state) => {
		if (!state) return false;
		if (state.isOverloaded) return false;
		if (state.hasVented) return false;
		if (state.remainingActions <= 0) return false;
		return true;
	});

export const selectOverloadedShips = createSelector([selectShipActionStates], (states) =>
	Object.values(states).filter((s) => s.isOverloaded)
);

export const selectShipsWithAvailableOverloadReset = createSelector(
	[selectShipActionStates],
	(states) => Object.values(states).filter((s) => s.isOverloaded && s.overloadResetAvailable)
);

export default gameFlowSlice.reducer;
