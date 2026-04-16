/**
 * gameStore - Zustand 状态管理
 *
 * 移动阶段类型说明：
 * - MovePhaseValue: 服务端同步类型（PHASE_A/B/C）
 * - MovePhaseUIValue: 客户端 UI 状态类型（包含 NONE 表示未开始）
 */

import { create } from "zustand";
import type {
	ShipState,
	PlayerState,
	GamePhaseValue,
	FactionValue,
	PlayerRoleValue,
	CameraState,
	PlayerCamera,
} from "@/sync/types";
import { MovePhaseUI, type MovePhaseUIValue, type MovePhaseValue } from "@vt/data";

// 导出常量供组件使用
export { MovePhaseUI };

// 类型别名 - 保持向后兼容
export type MovementPhaseValue = MovePhaseUIValue;

export interface MovementCommand {
	forward?: number;
	strafe?: number;
	turn?: number;
}

export interface FuelPool {
	forwardMax: number;
	forwardUsed: number;
	strafeMax: number;
	strafeUsed: number;
	turnMax: number;
	turnUsed: number;
}

export interface PhaseFuelState {
	fuel: FuelPool;
	isExecuting: boolean;
	lastMove: MovementCommand | null;
}

// 本地聊天消息类型（普通对象）
export interface LocalChatMessage {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: string;
}

export interface MovementState {
	currentPhase: MovementPhaseValue;
	currentPlan?: { turnAngle: number };
	isAnimating: boolean;
	phaseA: PhaseFuelState;
	phaseB: PhaseFuelState;
	phaseC: PhaseFuelState;
}

interface GameState {
	isConnected: boolean;
	connectionError: string | null;
	roomId: string | null;
	playerRole: PlayerRoleValue | null;
	playerSessionId: string | null;
	currentPhase: GamePhaseValue;
	turnCount: number;
	activeFaction: FactionValue;
	ships: Map<string, ShipState>;
	players: Map<string, PlayerState>;
	chatMessages: LocalChatMessage[];
	selectedShipId: string | null;
	selectedTargetId: string | null;
	selectedWeaponId: string | null;
	camera: CameraState;
	otherPlayersCameras: Map<string, PlayerCamera>;
	movementPhase: MovementPhaseValue;
	phaseA: PhaseFuelState;
	phaseB: PhaseFuelState;
	phaseC: PhaseFuelState;
	shipMaxSpeed: number;
	shipMaxTurnRate: number;
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
	setPlayerRole: (role: PlayerRoleValue | null) => void;
	setPlayerSessionId: (sessionId: string | null) => void;
	setPhase: (phase: GamePhaseValue) => void;
	setTurnCount: (count: number) => void;
	setActiveFaction: (faction: FactionValue) => void;
	setShip: (ship: ShipState) => void;
	removeShip: (id: string) => void;
	setPlayer: (player: PlayerState) => void;
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
	startMovement: (maxSpeed: number, maxTurnRate: number) => void;
	executeMove: (phase: MovementPhaseValue, command: MovementCommand) => void;
	advanceMovePhase: () => void;
	setMovePhase: (phase: MovementPhaseValue) => void;
	toggleGrid: () => void;
	toggleWeaponArcs: () => void;
	toggleMovementRange: () => void;
	reset: () => void;
}

const initialPhaseFuel: PhaseFuelState = {
	fuel: { forwardMax: 0, forwardUsed: 0, strafeMax: 0, strafeUsed: 0, turnMax: 0, turnUsed: 0 },
	isExecuting: false,
	lastMove: null,
};

const initialState: GameState = {
	isConnected: false,
	connectionError: null,
	roomId: null,
	playerRole: null,
	playerSessionId: null,
	currentPhase: "DEPLOYMENT",
	turnCount: 1,
	activeFaction: "PLAYER",
	ships: new Map(),
	players: new Map(),
	chatMessages: [],
	selectedShipId: null,
	selectedTargetId: null,
	selectedWeaponId: null,
	camera: { x: 0, y: 0, zoom: 1, viewRotation: 0 },
	otherPlayersCameras: new Map(),
	movementPhase: "NONE",
	phaseA: { ...initialPhaseFuel },
	phaseB: { ...initialPhaseFuel },
	phaseC: { ...initialPhaseFuel },
	shipMaxSpeed: 0,
	shipMaxTurnRate: 0,
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

	startMovement: (maxSpeed, maxTurnRate) => set({
		shipMaxSpeed: maxSpeed,
		shipMaxTurnRate: maxTurnRate,
		movementPhase: MovePhaseUI.PHASE_A,
		phaseA: { ...initialPhaseFuel, fuel: { forwardMax: maxSpeed * 2, forwardUsed: 0, strafeMax: maxSpeed, strafeUsed: 0, turnMax: 0, turnUsed: 0 } },
		phaseB: { ...initialPhaseFuel, fuel: { forwardMax: 0, forwardUsed: 0, strafeMax: 0, strafeUsed: 0, turnMax: maxTurnRate, turnUsed: 0 } },
		phaseC: { ...initialPhaseFuel, fuel: { forwardMax: maxSpeed * 2, forwardUsed: 0, strafeMax: maxSpeed, strafeUsed: 0, turnMax: 0, turnUsed: 0 } },
	}),
	executeMove: (phase, command) => set((state) => {
		const phaseState = phase === "PHASE_A" ? state.phaseA : phase === "PHASE_B" ? state.phaseB : state.phaseC;
		const fuel = { ...phaseState.fuel };
		if (command.forward) fuel.forwardUsed += Math.abs(command.forward);
		if (command.strafe) fuel.strafeUsed += Math.abs(command.strafe);
		if (command.turn) fuel.turnUsed += Math.abs(command.turn);
		const key = phase === "PHASE_A" ? "phaseA" : phase === "PHASE_B" ? "phaseB" : "phaseC";
		return { [key]: { ...phaseState, fuel, lastMove: command } };
	}),
	advanceMovePhase: () => set((state) => {
		const phases: MovePhaseUIValue[] = [MovePhaseUI.PHASE_A, MovePhaseUI.PHASE_B, MovePhaseUI.PHASE_C];
		const idx = phases.indexOf(state.movementPhase);
		const next = idx < phases.length - 1 ? phases[idx + 1] : MovePhaseUI.PHASE_C;
		return { movementPhase: next };
	}),
	setMovePhase: (phase) => set({ movementPhase: phase }),

	toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
	toggleWeaponArcs: () => set((state) => ({ showWeaponArcs: !state.showWeaponArcs })),
	toggleMovementRange: () => set((state) => ({ showMovementRange: !state.showMovementRange })),
	reset: () => set(initialState),
}));