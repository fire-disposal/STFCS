import { create } from "zustand";
import { GamePhase, Faction, PlayerRole } from "@vt/data";
import type { RoomPlayerState, ShipRuntime } from "@vt/data";
import type { MovePhaseUIValue } from "@/types";
import { MovePhaseUI } from "@/types";

export { MovePhaseUI };
export type MovementPhaseValue = MovePhaseUIValue;

export interface LocalChatMessage {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: string;
}

export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	viewRotation?: number;
	followingShipId?: string | null;
}

export interface PlayerCamera extends CameraState {
	playerId: string;
}

interface GameState {
	isConnected: boolean;
	connectionError: string | null;
	roomId: string | null;
	playerRole: PlayerRole | null;
	playerSessionId: string | null;
	currentPhase: GamePhase;
	turnCount: number;
	activeFaction: Faction;
	ships: Map<string, ShipRuntime & { id: string }>;
	players: Map<string, RoomPlayerState>;
	chatMessages: LocalChatMessage[];
	selectedShipId: string | null;
	selectedTargetId: string | null;
	selectedWeaponId: string | null;
	camera: CameraState;
	otherPlayersCameras: Map<string, PlayerCamera>;
	movementPhase: MovementPhaseValue;
	mapWidth: number;
	mapHeight: number;
	showGrid: boolean;
	showWeaponArcs: boolean;
	showMovementRange: boolean;
}

interface GameActions {
	setConnected: (connected: boolean) => void;
	setConnectionError: (error: string | null) => void;
	setRoomId: (roomId: string | null) => void;
	setPlayerRole: (role: PlayerRole | null) => void;
	setPlayerSessionId: (sessionId: string | null) => void;
	setPhase: (phase: GamePhase) => void;
	setTurnCount: (count: number) => void;
	setActiveFaction: (faction: Faction) => void;
	setShip: (ship: ShipRuntime & { id: string }) => void;
	removeShip: (id: string) => void;
	setPlayer: (player: RoomPlayerState) => void;
	removePlayer: (id: string) => void;
	setChatMessages: (messages: LocalChatMessage[]) => void;
	addChatMessage: (message: LocalChatMessage) => void;
	selectShip: (id: string | null) => void;
	selectTarget: (id: string | null) => void;
	selectWeapon: (id: string | null) => void;
	clearSelection: () => void;
	setCamera: (camera: Partial<CameraState>) => void;
	setOtherPlayerCamera: (playerId: string, camera: PlayerCamera) => void;
	removeOtherPlayerCamera: (playerId: string) => void;
	setMovePhase: (phase: MovementPhaseValue) => void;
	toggleGrid: () => void;
	toggleWeaponArcs: () => void;
	toggleMovementRange: () => void;
	reset: () => void;
}

const initialState: GameState = {
	isConnected: false,
	connectionError: null,
	roomId: null,
	playerRole: null,
	playerSessionId: null,
	currentPhase: GamePhase.DEPLOYMENT,
	turnCount: 1,
	activeFaction: Faction.PLAYER,
	ships: new Map(),
	players: new Map(),
	chatMessages: [],
	selectedShipId: null,
	selectedTargetId: null,
	selectedWeaponId: null,
	camera: { x: 0, y: 0, zoom: 1, viewRotation: 0 },
	otherPlayersCameras: new Map(),
	movementPhase: MovePhaseUI.NONE,
	mapWidth: 2000,
	mapHeight: 2000,
	showGrid: true,
	showWeaponArcs: true,
	showMovementRange: true,
};

export const useGameStore = create<GameState & GameActions>((set, get) => ({
	...initialState,

	setConnected: (connected) => set({ isConnected: connected }),
	setConnectionError: (error) => set({ connectionError: error }),
	setRoomId: (roomId) => set({ roomId }),
	setPlayerRole: (role) => set({ playerRole: role }),
	setPlayerSessionId: (sessionId) => set({ playerSessionId: sessionId }),
	setPhase: (phase) => set({ currentPhase: phase }),
	setTurnCount: (count) => set({ turnCount: count }),
	setActiveFaction: (faction) => set({ activeFaction: faction }),

	setShip: (ship) => set((state) => {
		const ships = new Map(state.ships);
		ships.set(ship.id, ship);
		return { ships };
	}),
	removeShip: (id) => set((state) => {
		const ships = new Map(state.ships);
		ships.delete(id);
		if (state.selectedShipId === id) return { ships, selectedShipId: null, selectedTargetId: null };
		return { ships };
	}),
	setPlayer: (player) => set((state) => {
		const players = new Map(state.players);
		players.set(player.sessionId, player);
		return { players };
	}),
	removePlayer: (id) => set((state) => {
		const players = new Map(state.players);
		players.delete(id);
		return { players };
	}),
	setChatMessages: (messages) => set({ chatMessages: messages }),
	addChatMessage: (message) => set((state) => ({ chatMessages: [...state.chatMessages.slice(-49), message] })),

	selectShip: (id) => set({ selectedShipId: id, selectedTargetId: id ? null : get().selectedTargetId }),
	selectTarget: (id) => set({ selectedTargetId: id }),
	selectWeapon: (id) => set({ selectedWeaponId: id }),
	clearSelection: () => set({ selectedShipId: null, selectedTargetId: null, selectedWeaponId: null }),

	setCamera: (camera) => set((state) => ({ camera: { ...state.camera, ...camera } })),
	setOtherPlayerCamera: (playerId, camera) => set((state) => {
		const otherPlayersCameras = new Map(state.otherPlayersCameras);
		otherPlayersCameras.set(playerId, camera);
		return { otherPlayersCameras };
	}),
	removeOtherPlayerCamera: (playerId) => set((state) => {
		const otherPlayersCameras = new Map(state.otherPlayersCameras);
		otherPlayersCameras.delete(playerId);
		return { otherPlayersCameras };
	}),

	setMovePhase: (phase) => set({ movementPhase: phase }),

	toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
	toggleWeaponArcs: () => set((state) => ({ showWeaponArcs: !state.showWeaponArcs })),
	toggleMovementRange: () => set((state) => ({ showMovementRange: !state.showMovementRange })),
	reset: () => set(initialState),
}));