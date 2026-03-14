import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { MapConfig, PlayerCamera, TokenInfo } from "@vt/shared/types";

export interface MapTile {
	x: number;
	y: number;
	type: "space" | "asteroid" | "nebula" | "planet" | "station";
	passable: boolean;
	texture?: string;
}

export interface PlacementPreview {
	tokenType: string;
	position: { x: number; y: number };
	rotation: number;
	valid: boolean;
}

interface MapState {
	config: MapConfig & {
		tileWidth: number;
		tileHeight: number;
		backgroundColor: number;
		gridColor: number;
		showGrid: boolean;
	};
	tokens: Record<string, TokenInfo>;
	selectedTokenId: string | null;
	placementMode: boolean;
	placementPreview: PlacementPreview | null;
	// 其他玩家的相机状态（用于预览）
	otherPlayersCameras: Record<string, PlayerCamera>;
}

const initialState: MapState = {
	config: {
		id: "default_map",
		width: 4096,
		height: 4096,
		name: "Default Space Map",
		tileWidth: 64,
		tileHeight: 64,
		backgroundColor: 0x0a0a1a,
		gridColor: 0x1a1a3e,
		showGrid: true,
	},
	tokens: {
		ship_1: {
			id: "ship_1",
			ownerId: "player_1",
			position: { x: 1000, y: 1000 },
			heading: 45,
			type: "ship",
			size: 50,
			scale: 1.0,
			turnState: "waiting",
			maxMovement: 300,
			remainingMovement: 300,
			actionsPerTurn: 3,
			remainingActions: 3,
			layer: 1,
			collisionRadius: 60,
			metadata: { class: "battlecruiser", faction: "terran" },
		},
		station_1: {
			id: "station_1",
			ownerId: "neutral",
			position: { x: 2000, y: 1500 },
			heading: 0,
			type: "station",
			size: 100,
			scale: 1.0,
			turnState: "waiting",
			maxMovement: 0,
			remainingMovement: 0,
			actionsPerTurn: 0,
			remainingActions: 0,
			layer: 2,
			collisionRadius: 120,
			metadata: { type: "research_station" },
		},
		asteroid_1: {
			id: "asteroid_1",
			ownerId: "environment",
			position: { x: 1500, y: 800 },
			heading: 0,
			type: "asteroid",
			size: 30,
			scale: 1.0,
			turnState: "waiting",
			maxMovement: 0,
			remainingMovement: 0,
			actionsPerTurn: 0,
			remainingActions: 0,
			layer: 0,
			collisionRadius: 40,
			metadata: { size: "large", composition: "metallic" },
		},
	},
	selectedTokenId: null,
	placementMode: false,
	placementPreview: null,
	otherPlayersCameras: {},
};

const mapSlice = createSlice({
	name: "map",
	initialState,
	reducers: {
		initializeMap: (state, action: PayloadAction<Partial<MapState["config"]>>) => {
			state.config = { ...state.config, ...action.payload };
		},
		addToken: (state, action: PayloadAction<TokenInfo>) => {
			state.tokens[action.payload.id] = action.payload;
		},
		updateToken: (state, action: PayloadAction<{ id: string; updates: Partial<TokenInfo> }>) => {
			const token = state.tokens[action.payload.id];
			if (token) {
				state.tokens[action.payload.id] = {
					...token,
					...action.payload.updates,
				};
			}
		},
		removeToken: (state, action: PayloadAction<string>) => {
			delete state.tokens[action.payload];
			if (state.selectedTokenId === action.payload) {
				state.selectedTokenId = null;
			}
		},
		selectToken: (state, action: PayloadAction<string | null>) => {
			state.selectedTokenId = action.payload;
		},
		setPlacementMode: (state, action: PayloadAction<boolean>) => {
			state.placementMode = action.payload;
			if (!action.payload) {
				state.placementPreview = null;
			}
		},
		updatePlacementPreview: (state, action: PayloadAction<PlacementPreview | null>) => {
			state.placementPreview = action.payload;
		},
		toggleGrid: (state) => {
			state.config.showGrid = !state.config.showGrid;
		},
		// 更新其他玩家的相机状态
		updateOtherPlayerCamera: (state, action: PayloadAction<PlayerCamera>) => {
			state.otherPlayersCameras[action.payload.playerId] = action.payload;
		},
		// 移除其他玩家的相机状态（玩家离开时）
		removeOtherPlayerCamera: (state, action: PayloadAction<string>) => {
			delete state.otherPlayersCameras[action.payload];
		},
		// 清空所有其他玩家的相机状态
		clearOtherPlayersCameras: (state) => {
			state.otherPlayersCameras = {};
		},
	},
});

export const {
	initializeMap,
	addToken,
	updateToken,
	removeToken,
	selectToken,
	setPlacementMode,
	updatePlacementPreview,
	toggleGrid,
	updateOtherPlayerCamera,
	removeOtherPlayerCamera,
	clearOtherPlayersCameras,
} = mapSlice.actions;

export default mapSlice.reducer;
