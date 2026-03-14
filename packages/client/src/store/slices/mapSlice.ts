import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { MapConfig, TokenInfo } from "@vt/shared/types";

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
	camera: {
		x: number;
		y: number;
		zoom: number;
		minZoom: number;
		maxZoom: number;
	};
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
	tokens: {},
	selectedTokenId: null,
	placementMode: false,
	placementPreview: null,
	camera: {
		x: 0,
		y: 0,
		zoom: 1,
		minZoom: 0.5,
		maxZoom: 4,
	},
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
		updateToken: (
			state,
			action: PayloadAction<{ id: string; updates: Partial<TokenInfo> }>,
		) => {
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
		updatePlacementPreview: (
			state,
			action: PayloadAction<PlacementPreview | null>,
		) => {
			state.placementPreview = action.payload;
		},
		updateCamera: (
			state,
			action: PayloadAction<Partial<MapState["camera"]>>,
		) => {
			const newZoom = Math.max(
				state.camera.minZoom,
				Math.min(
					state.camera.maxZoom,
					action.payload.zoom ?? state.camera.zoom,
				),
			);

			state.camera = {
				...state.camera,
				...action.payload,
				zoom: newZoom,
			};

			// 限制相机边界
			state.camera.x = Math.max(
				-(state.config.width * newZoom - window.innerWidth) / newZoom,
				Math.min(0, state.camera.x),
			);
			state.camera.y = Math.max(
				-(state.config.height * newZoom - window.innerHeight) / newZoom,
				Math.min(0, state.camera.y),
			);
		},
		resetCamera: (state) => {
			state.camera = initialState.camera;
		},
		toggleGrid: (state) => {
			state.config.showGrid = !state.config.showGrid;
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
	updateCamera,
	resetCamera,
	toggleGrid,
} = mapSlice.actions;

export default mapSlice.reducer;
