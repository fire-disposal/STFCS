import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PlayerInfo } from "@vt/shared/types";

// 扩展PlayerInfo接口以包含游戏状态
export interface ExtendedPlayerInfo extends PlayerInfo {
	isConnected: boolean;
	isReady: boolean;
	currentShipId: string | null;
	selectedTargets: string[];
	usedActions: number;
	pendingActions: number;
	roomId: string;
	slotIndex: number;
	hasActed: boolean;
	fluxVentingActive: boolean;
	gamePhase: "lobby" | "setup" | "combat" | "end";
}

interface PlayerState {
	currentPlayerId: string | null;
	players: Record<string, ExtendedPlayerInfo>;
	roomId: string | null;
}

const initialState: PlayerState = {
	currentPlayerId: null,
	players: {},
	roomId: null,
};

const playerSlice = createSlice({
	name: "player",
	initialState,
	reducers: {
		setCurrentPlayer: (state, action: PayloadAction<string>) => {
			state.currentPlayerId = action.payload;
		},
		addPlayer: (state, action: PayloadAction<ExtendedPlayerInfo>) => {
			state.players[action.payload.id] = action.payload;
		},
		updatePlayer: (
			state,
			action: PayloadAction<{ id: string; updates: Partial<ExtendedPlayerInfo> }>,
		) => {
			const player = state.players[action.payload.id];
			if (player) {
				state.players[action.payload.id] = {
					...player,
					...action.payload.updates,
				};
			}
		},
		removePlayer: (state, action: PayloadAction<string>) => {
			delete state.players[action.payload];
			if (state.currentPlayerId === action.payload) {
				state.currentPlayerId = null;
			}
		},
		setRoomId: (state, action: PayloadAction<string | null>) => {
			state.roomId = action.payload;
		},
		clearPlayers: (state) => {
			state.players = {};
			state.currentPlayerId = null;
			state.roomId = null;
		},
		playerJoined: (state, action: PayloadAction<ExtendedPlayerInfo>) => {
			state.players[action.payload.id] = action.payload;
		},
		playerLeft: (state, action: PayloadAction<string>) => {
			delete state.players[action.payload];
		},
		setPlayerReady: (
			state,
			action: PayloadAction<{ id: string; isReady: boolean }>,
		) => {
			const player = state.players[action.payload.id];
			if (player) {
				player.isReady = action.payload.isReady;
			}
		},
		setPlayerShip: (
			state,
			action: PayloadAction<{ id: string; shipId: string | null }>,
		) => {
			const player = state.players[action.payload.id];
			if (player) {
				player.currentShipId = action.payload.shipId;
			}
		},
		addSelectedTarget: (
			state,
			action: PayloadAction<{ id: string; targetId: string }>,
		) => {
			const player = state.players[action.payload.id];
			if (player && !player.selectedTargets.includes(action.payload.targetId)) {
				player.selectedTargets.push(action.payload.targetId);
			}
		},
		removeSelectedTarget: (
			state,
			action: PayloadAction<{ id: string; targetId: string }>,
		) => {
			const player = state.players[action.payload.id];
			if (player) {
				player.selectedTargets = player.selectedTargets.filter(
					(targetId) => targetId !== action.payload.targetId,
				);
			}
		},
		clearSelectedTargets: (state, action: PayloadAction<string>) => {
			const player = state.players[action.payload];
			if (player) {
				player.selectedTargets = [];
			}
		},
		incrementUsedActions: (state, action: PayloadAction<string>) => {
			const player = state.players[action.payload];
			if (player) {
				player.usedActions += 1;
			}
		},
		decrementPendingActions: (state, action: PayloadAction<string>) => {
			const player = state.players[action.payload];
			if (player && player.pendingActions > 0) {
				player.pendingActions -= 1;
			}
		},
		setGamePhase: (
			state,
			action: PayloadAction<{ id: string; phase: ExtendedPlayerInfo["gamePhase"] }>,
		) => {
			const player = state.players[action.payload.id];
			if (player) {
				player.gamePhase = action.payload.phase;
			}
		},
		setFluxVenting: (
			state,
			action: PayloadAction<{ id: string; active: boolean }>,
		) => {
			const player = state.players[action.payload.id];
			if (player) {
				player.fluxVentingActive = action.payload.active;
			}
		},
	},
});

export const {
	setCurrentPlayer,
	addPlayer,
	updatePlayer,
	removePlayer,
	setRoomId,
	clearPlayers,
	playerJoined,
	playerLeft,
	setPlayerReady,
	setPlayerShip,
	addSelectedTarget,
	removeSelectedTarget,
	clearSelectedTargets,
	incrementUsedActions,
	decrementPendingActions,
	setGamePhase,
	setFluxVenting,
} = playerSlice.actions;

export default playerSlice.reducer;
