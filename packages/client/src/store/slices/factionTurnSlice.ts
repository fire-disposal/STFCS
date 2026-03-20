/**
 * 阵营回合状态管理 Slice
 *
 * 管理阵营回合制的状态，包括：
 * - 当前回合数
 * - 当前行动阵营
 * - 阵营行动顺序
 * - 玩家结束状态
 * - 防抖状态
 */

import { createSlice, type PayloadAction, createSelector } from '@reduxjs/toolkit';
import type { FactionId, FactionTurnState, PlayerFactionInfo, FactionTurnPhase } from '@vt/shared';

interface FactionTurnSliceState extends FactionTurnState {
  isInitialized: boolean;
}

const initialState: FactionTurnSliceState = {
  roundNumber: 1,
  currentFaction: 'federation',
  factionOrder: ['federation', 'empire'],
  currentFactionIndex: 0,
  phase: 'action',
  playerEndStatus: {},
  debounceStartTime: undefined,
  history: [],
  isInitialized: false,
};

const factionTurnSlice = createSlice({
  name: 'factionTurn',
  initialState,
  reducers: {
    /**
     * 初始化阵营回合系统
     */
    initializeFactionTurn: (
      state,
      action: PayloadAction<{
        factionOrder: FactionId[];
        playerEndStatus: Record<FactionId, PlayerFactionInfo[]>;
      }>
    ) => {
      state.factionOrder = action.payload.factionOrder;
      state.playerEndStatus = action.payload.playerEndStatus;
      state.currentFaction = action.payload.factionOrder[0];
      state.currentFactionIndex = 0;
      state.roundNumber = 1;
      state.phase = 'action';
      state.isInitialized = true;
    },

    /**
     * 设置阵营回合状态（部分更新）
     */
    setFactionTurnState: (state, action: PayloadAction<Partial<FactionTurnSliceState>>) => {
      return { ...state, ...action.payload };
    },

    /**
     * 设置当前行动阵营
     */
    setCurrentFaction: (state, action: PayloadAction<FactionId>) => {
      state.currentFaction = action.payload;
      state.phase = 'action';
      state.debounceStartTime = undefined;
      // 更新索引
      const index = state.factionOrder.indexOf(action.payload);
      if (index >= 0) {
        state.currentFactionIndex = index;
      }
    },

    /**
     * 更新玩家结束状态
     */
    updatePlayerEndStatus: (
      state,
      action: PayloadAction<{
        playerId: string;
        faction: FactionId;
        hasEndedTurn: boolean;
        endedAt?: number;
      }>
    ) => {
      const { playerId, faction, hasEndedTurn, endedAt } = action.payload;
      const players = state.playerEndStatus[faction] || [];
      const playerIndex = players.findIndex((p) => p.playerId === playerId);

      if (playerIndex >= 0) {
        players[playerIndex].hasEndedTurn = hasEndedTurn;
        players[playerIndex].endedAt = endedAt;
      }
    },

    /**
     * 设置防抖开始时间
     */
    setDebounceStartTime: (state, action: PayloadAction<number | undefined>) => {
      state.debounceStartTime = action.payload;
    },

    /**
     * 设置回合阶段
     */
    setFactionTurnPhase: (state, action: PayloadAction<FactionTurnPhase>) => {
      state.phase = action.payload;
    },

    /**
     * 前进到下一阵营
     */
    advanceToNextFaction: (state) => {
      const nextIndex = state.currentFactionIndex + 1;
      if (nextIndex >= state.factionOrder.length) {
        // 开始新回合
        state.roundNumber += 1;
        state.currentFactionIndex = 0;
        state.currentFaction = state.factionOrder[0];
        // 重置所有玩家的结束状态
        for (const faction of Object.keys(state.playerEndStatus) as FactionId[]) {
          state.playerEndStatus[faction] = state.playerEndStatus[faction].map((p) => ({
            ...p,
            hasEndedTurn: false,
            endedAt: undefined,
          }));
        }
      } else {
        state.currentFactionIndex = nextIndex;
        state.currentFaction = state.factionOrder[nextIndex];
      }
      state.phase = 'action';
      state.debounceStartTime = undefined;
    },

    /**
     * 设置回合数
     */
    setRoundNumber: (state, action: PayloadAction<number>) => {
      state.roundNumber = action.payload;
    },

    /**
     * 设置阵营顺序
     */
    setFactionOrder: (state, action: PayloadAction<FactionId[]>) => {
      state.factionOrder = action.payload;
      // 确保当前阵营在顺序中
      if (!action.payload.includes(state.currentFaction) && action.payload.length > 0) {
        state.currentFaction = action.payload[0];
        state.currentFactionIndex = 0;
      }
    },

    /**
     * 添加历史记录
     */
    addHistoryEntry: (state, action: PayloadAction<{
      roundNumber: number;
      faction: FactionId;
      startedAt: number;
      endedAt?: number;
      endedPlayers: string[];
    }>) => {
      state.history.push(action.payload);
    },

    /**
     * 重置阵营回合状态
     */
    resetFactionTurn: () => {
      return { ...initialState };
    },
  },
});

export const {
  initializeFactionTurn,
  setFactionTurnState,
  setCurrentFaction,
  updatePlayerEndStatus,
  setDebounceStartTime,
  setFactionTurnPhase,
  advanceToNextFaction,
  setRoundNumber,
  setFactionOrder,
  addHistoryEntry,
  resetFactionTurn,
} = factionTurnSlice.actions;

// ==================== 选择器 ====================

// 基础选择器
const selectFactionTurnState = (state: { factionTurn: FactionTurnSliceState }) => state.factionTurn;

// 简单选择器
export const selectCurrentFaction = (state: { factionTurn: FactionTurnSliceState }) =>
  state.factionTurn.currentFaction;

export const selectRoundNumber = (state: { factionTurn: FactionTurnSliceState }) =>
  state.factionTurn.roundNumber;

export const selectFactionOrder = (state: { factionTurn: FactionTurnSliceState }) =>
  state.factionTurn.factionOrder;

export const selectCurrentFactionIndex = (state: { factionTurn: FactionTurnSliceState }) =>
  state.factionTurn.currentFactionIndex;

export const selectFactionTurnPhase = (state: { factionTurn: FactionTurnSliceState }) =>
  state.factionTurn.phase;

export const selectDebounceStartTime = (state: { factionTurn: FactionTurnSliceState }) =>
  state.factionTurn.debounceStartTime;

export const selectIsFactionTurnInitialized = (state: { factionTurn: FactionTurnSliceState }) =>
  state.factionTurn.isInitialized;

// Memoized 选择器
export const selectPlayerEndStatus = createSelector(
  [selectFactionTurnState],
  (state) => state.playerEndStatus
);

export const selectCurrentFactionPlayers = createSelector(
  [selectPlayerEndStatus, selectCurrentFaction],
  (playerEndStatus, currentFaction) => playerEndStatus[currentFaction] || []
);

export const selectEndedPlayersCount = createSelector(
  [selectCurrentFactionPlayers],
  (players) => players.filter((p) => p.hasEndedTurn).length
);

export const selectTotalPlayersCount = createSelector(
  [selectCurrentFactionPlayers],
  (players) => players.length
);

export const selectPlayerHasEndedTurn = (playerId: string) =>
  createSelector(
    [selectCurrentFactionPlayers],
    (players) => players.find((p) => p.playerId === playerId)?.hasEndedTurn ?? false
  );

export const selectIsCurrentPlayerFaction = (faction: FactionId | null) =>
  createSelector(
    [selectCurrentFaction],
    (currentFaction) => faction !== null && currentFaction === faction
  );

export default factionTurnSlice.reducer;