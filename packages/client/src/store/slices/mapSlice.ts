import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type {
	MapConfig,
	MapSnapshot,
	PlanetNode,
	PlayerCamera,
	StarNode,
	StarSystem,
	TokenInfo,
} from "@vt/shared/types";

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

export type StarMapLayer = "galaxy" | "system";

export interface StarMapState {
	stars: Record<string, StarNode>;
	systems: Record<string, StarSystem>;
	currentLayer: StarMapLayer;
	currentStarId: string | null;
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
	starMap: StarMapState;
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
	starMap: {
		stars: {},
		systems: {},
		currentLayer: "galaxy",
		currentStarId: null,
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
		// 选择 Token
		selectToken: (state, action: PayloadAction<string | null>) => {
			state.selectedTokenId = action.payload;
		},
		addStar: (state, action: PayloadAction<StarNode>) => {
			state.starMap.stars[action.payload.id] = action.payload;
			if (!state.starMap.systems[action.payload.id]) {
				state.starMap.systems[action.payload.id] = {
					starId: action.payload.id,
					planets: {},
					updatedAt: Date.now(),
				};
			}
		},
		updateStar: (state, action: PayloadAction<{ id: string; updates: Partial<StarNode> }>) => {
			const current = state.starMap.stars[action.payload.id];
			if (current) {
				state.starMap.stars[action.payload.id] = {
					...current,
					...action.payload.updates,
					updatedAt: Date.now(),
				};
			}
		},
		removeStar: (state, action: PayloadAction<string>) => {
			delete state.starMap.stars[action.payload];
			delete state.starMap.systems[action.payload];
			if (state.starMap.currentStarId === action.payload) {
				state.starMap.currentLayer = "galaxy";
				state.starMap.currentStarId = null;
			}
		},
		enterStarSystem: (state, action: PayloadAction<string>) => {
			if (!state.starMap.stars[action.payload]) {
				return;
			}
			state.starMap.currentLayer = "system";
			state.starMap.currentStarId = action.payload;
			if (!state.starMap.systems[action.payload]) {
				state.starMap.systems[action.payload] = {
					starId: action.payload,
					planets: {},
					updatedAt: Date.now(),
				};
			}
		},
		exitStarSystem: (state) => {
			state.starMap.currentLayer = "galaxy";
			state.starMap.currentStarId = null;
		},
		addPlanet: (
			state,
			action: PayloadAction<{
				starId: string;
				planet: PlanetNode;
			}>
		) => {
			const system = state.starMap.systems[action.payload.starId];
			if (!system) {
				return;
			}
			system.planets[action.payload.planet.id] = action.payload.planet;
			system.updatedAt = Date.now();
		},
		updatePlanet: (
			state,
			action: PayloadAction<{ starId: string; planetId: string; updates: Partial<PlanetNode> }>
		) => {
			const system = state.starMap.systems[action.payload.starId];
			const planet = system?.planets[action.payload.planetId];
			if (planet && system) {
				system.planets[action.payload.planetId] = {
					...planet,
					...action.payload.updates,
					updatedAt: Date.now(),
				};
				system.updatedAt = Date.now();
			}
		},
		removePlanet: (state, action: PayloadAction<{ starId: string; planetId: string }>) => {
			const system = state.starMap.systems[action.payload.starId];
			if (system?.planets[action.payload.planetId]) {
				delete system.planets[action.payload.planetId];
				system.updatedAt = Date.now();
			}
		},
		loadMapSnapshot: (state, action: PayloadAction<MapSnapshot>) => {
			state.config = {
				...state.config,
				...action.payload.map,
			};
			state.tokens = Object.fromEntries(action.payload.tokens.map((token) => [token.id, token]));
			state.starMap = {
				stars: action.payload.starMap.stars,
				systems: action.payload.starMap.systems,
				currentLayer: "galaxy",
				currentStarId: null,
			};
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
	addStar,
	updateStar,
	removeStar,
	enterStarSystem,
	exitStarSystem,
	addPlanet,
	updatePlanet,
	removePlanet,
	loadMapSnapshot,
} = mapSlice.actions;

export default mapSlice.reducer;
