/**
 * 阵营状态管理 Slice
 *
 * 管理玩家阵营选择和房间内阵营信息
 */

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { FactionId, PlayerFactionInfo } from '@vt/contracts/types';

interface FactionState {
	/** 当前玩家选择的阵营 */
	selectedFaction: FactionId | null;
	/** 房间内所有玩家的阵营信息 */
	playerFactions: Record<string, PlayerFactionInfo>;
	/** 阵营是否已确认（加入房间后） */
	isConfirmed: boolean;
}

const initialState: FactionState = {
	selectedFaction: null,
	playerFactions: {},
	isConfirmed: false,
};

const factionSlice = createSlice({
	name: 'faction',
	initialState,
	reducers: {
		/**
		 * 选择阵营
		 */
		selectFaction: (state, action: PayloadAction<FactionId>) => {
			state.selectedFaction = action.payload;
		},
		/**
		 * 确认阵营选择
		 */
		confirmFaction: (state) => {
			if (state.selectedFaction) {
				state.isConfirmed = true;
			}
		},
		/**
		 * 设置玩家阵营信息
		 */
		setPlayerFaction: (state, action: PayloadAction<PlayerFactionInfo>) => {
			state.playerFactions[action.payload.playerId] = action.payload;
		},
		/**
		 * 更新玩家阵营信息
		 */
		updatePlayerFaction: (
			state,
			action: PayloadAction<{ playerId: string; updates: Partial<PlayerFactionInfo> }>
		) => {
			const player = state.playerFactions[action.payload.playerId];
			if (player) {
				state.playerFactions[action.payload.playerId] = {
					...player,
					...action.payload.updates,
				};
			}
		},
		/**
		 * 移除玩家阵营信息
		 */
		removePlayerFaction: (state, action: PayloadAction<string>) => {
			delete state.playerFactions[action.payload];
		},
		/**
		 * 批量设置玩家阵营信息
		 */
		setAllPlayerFactions: (state, action: PayloadAction<PlayerFactionInfo[]>) => {
			action.payload.forEach((playerFaction) => {
				state.playerFactions[playerFaction.playerId] = playerFaction;
			});
		},
		/**
		 * 清空所有阵营信息
		 */
		clearFactions: (state) => {
			state.playerFactions = {};
			state.selectedFaction = null;
			state.isConfirmed = false;
		},
	},
});

export const {
	selectFaction,
	confirmFaction,
	setPlayerFaction,
	updatePlayerFaction,
	removePlayerFaction,
	setAllPlayerFactions,
	clearFactions,
} = factionSlice.actions;

// 选择器
export const selectSelectedFaction = (state: { faction: FactionState }) =>
	state.faction.selectedFaction;

export const selectPlayerFactions = (state: { faction: FactionState }) =>
	state.faction.playerFactions;

export const selectIsFactionConfirmed = (state: { faction: FactionState }) =>
	state.faction.isConfirmed;

export default factionSlice.reducer;