import { createSlice, type PayloadAction, createSelector } from "@reduxjs/toolkit";
import type { TurnUnit, TurnOrder, UnitTurnState, TurnPhase } from "@vt/shared/types";

interface TurnState {
	order: TurnOrder | null;
	isInitialized: boolean;
	lastUpdated: number;
	// UI 状态
	hoveredUnitId: string | null;
	visibleStartIndex: number; // 可见区域起始索引（用于滚动）
	maxVisibleUnits: number; // 最大可见单位数
}

const initialState: TurnState = {
	order: null,
	isInitialized: false,
	lastUpdated: 0,
	hoveredUnitId: null,
	visibleStartIndex: 0,
	maxVisibleUnits: 8, // 默认最多显示 8 个单位
};

const turnSlice = createSlice({
	name: "turn",
	initialState,
	reducers: {
		// 初始化回合顺序
		initializeTurnOrder: (
			state,
			action: PayloadAction<{
				units: TurnUnit[];
				roundNumber?: number;
				phase?: TurnPhase;
			}>
		) => {
			const { units, roundNumber = 1, phase = "deployment" } = action.payload;
			// 按先攻值排序
			const sortedUnits = [...units].sort((a, b) => b.initiative - a.initiative);
			state.order = {
				currentIndex: 0,
				units: sortedUnits,
				roundNumber,
				phase,
				isComplete: false,
			};
			state.isInitialized = true;
			state.lastUpdated = Date.now();
		},

		// 更新回合顺序（动态添加/移除单位）
		updateTurnOrder: (
			state,
			action: PayloadAction<{
				units: TurnUnit[];
				roundNumber?: number;
				phase?: TurnPhase;
			}>
		) => {
			const { units, roundNumber, phase } = action.payload;
			const sortedUnits = [...units].sort((a, b) => b.initiative - a.initiative);
			
			if (state.order) {
				// 保持当前索引的相对位置
				const currentUnitId = state.order.units[state.order.currentIndex]?.id;
				const newIndex = sortedUnits.findIndex((u) => u.id === currentUnitId);
				
				state.order = {
					...state.order,
					units: sortedUnits,
					currentIndex: newIndex >= 0 ? newIndex : 0,
					roundNumber: roundNumber ?? state.order.roundNumber,
					phase: phase ?? state.order.phase,
				};
			} else {
				state.order = {
					currentIndex: 0,
					units: sortedUnits,
					roundNumber: roundNumber ?? 1,
					phase: phase ?? "deployment",
					isComplete: false,
				};
			}
			state.isInitialized = true;
			state.lastUpdated = Date.now();
		},

		// 设置当前回合索引
		setCurrentTurnIndex: (state, action: PayloadAction<number>) => {
			if (state.order) {
				const index = action.payload;
				// 支持循环索引
				const normalizedIndex = ((index % state.order.units.length) + state.order.units.length) % state.order.units.length;
				state.order.currentIndex = normalizedIndex;
				state.lastUpdated = Date.now();
			}
		},

		// 前进到下一单位
		nextTurnUnit: (state) => {
			if (state.order && state.order.units.length > 0) {
				state.order.currentIndex =
					(state.order.currentIndex + 1) % state.order.units.length;
				state.lastUpdated = Date.now();
			}
		},

		// 返回上一单位
		previousTurnUnit: (state) => {
			if (state.order && state.order.units.length > 0) {
				state.order.currentIndex =
					((state.order.currentIndex - 1) % state.order.units.length +
						state.order.units.length) %
					state.order.units.length;
				state.lastUpdated = Date.now();
			}
		},

		// 更新单位状态
		updateUnitState: (
			state,
			action: PayloadAction<{ unitId: string; state: UnitTurnState }>
		) => {
			if (state.order) {
				const unit = state.order.units.find(
					(u) => u.id === action.payload.unitId
				);
				if (unit) {
					unit.state = action.payload.state;
					state.lastUpdated = Date.now();
				}
			}
		},

		// 设置回合阶段
		setTurnPhase: (state, action: PayloadAction<TurnPhase>) => {
			if (state.order) {
				state.order.phase = action.payload;
				state.lastUpdated = Date.now();
			}
		},

		// 设置回合数
		setRoundNumber: (state, action: PayloadAction<number>) => {
			if (state.order) {
				state.order.roundNumber = action.payload;
				state.lastUpdated = Date.now();
			}
		},

		// 增加回合数
		incrementRound: (state) => {
			if (state.order) {
				state.order.roundNumber += 1;
				state.order.currentIndex = 0;
				state.order.phase = "deployment";
				// 重置所有单位状态
				state.order.units.forEach((unit) => {
					unit.state = "waiting";
				});
				state.order.isComplete = false;
				state.lastUpdated = Date.now();
			}
		},

		// 标记回合完成
		setTurnComplete: (state, action: PayloadAction<boolean>) => {
			if (state.order) {
				state.order.isComplete = action.payload;
				state.lastUpdated = Date.now();
			}
		},

		// 添加单位
		addUnit: (state, action: PayloadAction<TurnUnit>) => {
			if (state.order) {
				// 避免重复添加
				const exists = state.order?.units.some((u) => u.id === action.payload.id);
				if (!exists && state.order) {
					state.order.units.push(action.payload);
					// 重新排序
					state.order.units.sort((a, b) => b.initiative - a.initiative);
					// 更新当前索引
					const currentUnitId = state.order.units[state.order.currentIndex]?.id;
					if (currentUnitId) {
						const newIndex = state.order.units.findIndex((u) => u.id === currentUnitId);
						if (newIndex >= 0) {
							state.order.currentIndex = newIndex;
						}
					}
					state.lastUpdated = Date.now();
				}
			} else {
				state.order = {
					currentIndex: 0,
					units: [action.payload],
					roundNumber: 1,
					phase: "deployment",
					isComplete: false,
				};
				state.isInitialized = true;
			}
		},

		// 移除单位
		removeUnit: (state, action: PayloadAction<string>) => {
			if (state.order) {
				const unitIndex = state.order.units.findIndex(
					(u) => u.id === action.payload
				);
				if (unitIndex >= 0) {
					state.order.units.splice(unitIndex, 1);
					// 调整当前索引
					if (state.order.units.length === 0) {
						state.order.currentIndex = 0;
						state.order.isComplete = true;
					} else if (unitIndex <= state.order.currentIndex) {
						state.order.currentIndex = Math.max(
							0,
							state.order.currentIndex - 1
						);
					}
					state.lastUpdated = Date.now();
				}
			}
		},

		// 重置回合顺序
		resetTurnOrder: (state) => {
			state.order = null;
			state.isInitialized = false;
			state.hoveredUnitId = null;
			state.visibleStartIndex = 0;
		},

		// UI: 设置悬停单位
		setHoveredUnit: (state, action: PayloadAction<string | null>) => {
			state.hoveredUnitId = action.payload;
		},

		// UI: 设置可见区域起始索引（用于滚动循环）
		setVisibleStartIndex: (state, action: PayloadAction<number>) => {
			state.visibleStartIndex = Math.max(0, action.payload);
		},

		// UI: 设置最大可见单位数
		setMaxVisibleUnits: (state, action: PayloadAction<number>) => {
			state.maxVisibleUnits = Math.max(1, action.payload);
		},
	},
});

export const {
	initializeTurnOrder,
	updateTurnOrder,
	setCurrentTurnIndex,
	nextTurnUnit,
	previousTurnUnit,
	updateUnitState,
	setTurnPhase,
	setRoundNumber,
	incrementRound,
	setTurnComplete,
	addUnit,
	removeUnit,
	resetTurnOrder,
	setHoveredUnit,
	setVisibleStartIndex,
	setMaxVisibleUnits,
} = turnSlice.actions;

// 基础选择器
const selectTurnState = (state: { turn: TurnState }) => state.turn;
const selectTurnOrderFromState = (state: { turn: TurnState }) => state.turn.order;

// 简单的原始值选择器（不需要 memoization）
export const selectTurnOrder = (state: { turn: TurnState }) => state.turn.order;
export const selectCurrentIndex = (state: { turn: TurnState }) =>
	state.turn.order?.currentIndex ?? -1;
export const selectHoveredUnitId = (state: { turn: TurnState }) =>
	state.turn.hoveredUnitId;
export const selectVisibleStartIndex = (state: { turn: TurnState }) =>
	state.turn.visibleStartIndex;
export const selectMaxVisibleUnits = (state: { turn: TurnState }) =>
	state.turn.maxVisibleUnits;
export const selectIsTurnInitialized = (state: { turn: TurnState }) =>
	state.turn.isInitialized;

// Memoized 选择器（返回数组或对象，需要 memoization 避免不必要的重渲染）
const EMPTY_UNITS_ARRAY: TurnUnit[] = [];

export const selectTurnUnits = createSelector(
	[selectTurnOrderFromState],
	(order) => order?.units ?? EMPTY_UNITS_ARRAY
);

export const selectCurrentUnit = createSelector(
	[selectTurnOrderFromState],
	(order) => order?.units[order.currentIndex] ?? null
);

export default turnSlice.reducer;
