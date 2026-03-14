/**
 * 统一选择 Redux Slice
 * 管理 token/ship 的选择状态，支持多玩家同步
 */

import { type PayloadAction, createSlice } from "@reduxjs/toolkit";

/** 玩家拖拽状态 */
export interface TokenDragState {
	tokenId: string;
	playerId: string;
	playerName: string;
	position: { x: number; y: number };
	heading: number;
	timestamp: number;
	isActive: boolean;
}

/** 选择记录 */
export interface SelectionRecord {
	tokenId: string;
	selectedBy: {
		id: string;
		name: string;
		isDMMode: boolean;
	} | null;
	timestamp: number;
}

interface SelectionState {
	// 本地玩家选中的 token ID
	selectedTokenId: string | null;
	// 所有 token 的选择状态（多玩家同步）
	selections: Record<string, SelectionRecord>;
	// 正在拖拽的 token（多玩家同步）
	activeDrags: Record<string, TokenDragState>;
}

const initialState: SelectionState = {
	selectedTokenId: null,
	selections: {},
	activeDrags: {},
};

const selectionSlice = createSlice({
	name: "selection",
	initialState,
	reducers: {
		// 本地选择 token
		selectToken: (state, action: PayloadAction<string | null>) => {
			state.selectedTokenId = action.payload;
		},

		// 从服务器接收的选择更新
		setSelections: (state, action: PayloadAction<Record<string, SelectionRecord>>) => {
			state.selections = action.payload;
		},

		// 更新单个选择记录
		updateSelection: (state, action: PayloadAction<SelectionRecord>) => {
			const { tokenId } = action.payload;
			state.selections[tokenId] = action.payload;
		},

		// 移除选择记录
		removeSelection: (state, action: PayloadAction<string>) => {
			const tokenId = action.payload;
			delete state.selections[tokenId];
		},

		// 清空所有选择
		clearSelections: (state) => {
			state.selections = {};
			state.selectedTokenId = null;
		},

		// ===== Token 拖拽相关 =====

		// 开始拖拽
		beginTokenDrag: (
			state,
			action: PayloadAction<{
				tokenId: string;
				playerId: string;
				playerName: string;
				position: { x: number; y: number };
				heading: number;
				timestamp: number;
			}>
		) => {
			const { tokenId, playerId, playerName, position, heading, timestamp } = action.payload;
			state.activeDrags[tokenId] = {
				tokenId,
				playerId,
				playerName,
				position,
				heading,
				timestamp,
				isActive: true,
			};
		},

		// 更新拖拽位置
		updateTokenDrag: (
			state,
			action: PayloadAction<{
				tokenId: string;
				playerId: string;
				playerName: string;
				position: { x: number; y: number };
				heading: number;
				timestamp: number;
			}>
		) => {
			const { tokenId, position, heading, timestamp } = action.payload;
			const drag = state.activeDrags[tokenId];
			if (drag) {
				drag.position = position;
				drag.heading = heading;
				drag.timestamp = timestamp;
			}
		},

		// 结束拖拽
		endTokenDrag: (
			state,
			action: PayloadAction<{
				tokenId: string;
				playerId: string;
				finalPosition: { x: number; y: number };
				finalHeading: number;
				committed: boolean;
				timestamp: number;
			}>
		) => {
			const { tokenId, committed } = action.payload;
			const drag = state.activeDrags[tokenId];
			if (drag) {
				drag.isActive = false;
				// 如果确认移动，保持最终位置；否则删除拖拽记录
				if (!committed) {
					delete state.activeDrags[tokenId];
				} else {
					// 延迟删除，等待 TOKEN_MOVED 消息更新实际位置
					setTimeout(() => {
						delete state.activeDrags[tokenId];
					}, 100);
				}
			}
		},

		// 清除拖拽状态（立即）
		clearTokenDrag: (state, action: PayloadAction<string>) => {
			delete state.activeDrags[action.payload];
		},

		// 清空所有拖拽状态
		clearAllDrags: (state) => {
			state.activeDrags = {};
		},
	},
});

export const {
	selectToken,
	setSelections,
	updateSelection,
	removeSelection,
	clearSelections,
	beginTokenDrag,
	updateTokenDrag,
	endTokenDrag,
	clearTokenDrag,
	clearAllDrags,
} = selectionSlice.actions;

export default selectionSlice.reducer;
