import type { PlayerRole, WsEventName, WsPayload, WsResponseData } from "@vt/data";
import { create } from "zustand";

// 交互模式枚举
export type InteractionMode = "IDLE" | "DRAWING_MOVE" | "SELECTING_TARGET" | "DM_OVERRIDING";

// 坐标精度类型
export type CoordinatePrecision = "exact" | "rounded10" | "rounded100";

// 角度模式类型
export type AngleMode = "degrees" | "radians" | "nav";

// Action sender interface
export interface GameActionSender {
	send: <E extends WsEventName>(event: E, payload: WsPayload<E>) => Promise<WsResponseData<E>>;
	isAvailable: () => boolean;
}

// Default empty sender
const emptySender: GameActionSender = {
	send: async () => { throw new Error("Room not available"); },
	isAvailable: () => false,
};

interface UIState {
	// 连接状态
	isConnected: boolean;
	connectionError: string | null;
	playerRole: PlayerRole | null;
	roomId: string | null;

	// 选中的舰船及交互模式
	selectedShipId: string | null;
	interactionMode: InteractionMode;
	activeWeaponId: string | null;
	actionPanelPosition: { x: number; y: number } | null;

	// 鼠标状态
	isMouseDown: boolean;
	mousePosition: { x: number; y: number };

	// 视图状态
	cameraPosition: { x: number; y: number };
	zoom: number;
	showGrid: boolean;
	showRangeIndicator: boolean;
	showBackground: boolean;
	showWeaponArcs: boolean;
	showMovementRange: boolean;
	showLabels: boolean;
	showEffects: boolean;
	showShipIcons: boolean;
	showHexagonArmor: boolean;
	showShieldArc: boolean;           // 护盾辉光弧线显示
	showFluxIndicators: boolean;      // 辐能/过载状态指示器显示
	hideNativeCursor: boolean;
	enableStarfieldParallax: boolean; // 星空视差效果

	// 地图游标状态 (世界坐标，真实朝向)
	mapCursor: { x: number; y: number; r: number } | null;

	// 坐标精度设置（用于太空环境）
	coordinatePrecision: "exact" | "rounded10" | "rounded100";
	gridSnap: boolean;
	gridSize: number;

	// 角度显示模式
	angleMode: "degrees" | "radians" | "nav"; // nav: 航海角度（0-360，北为 0）

	// 地图视图旋转
	viewRotation: number; // 视图旋转角度（度）
	isViewRotating: boolean; // 是否正在旋转视图

	// UI面板状态
	isSidebarOpen: boolean;
	activePanel: "ships" | "combat" | "dm" | "settings" | null;
}

interface UIActions {
	// 连接相关
	setConnected: (connected: boolean) => void;
	setConnectionError: (error: string | null) => void;
	setPlayerRole: (role: PlayerRole | null) => void;
	setRoomId: (roomId: string | null) => void;

	// 选择相关
	selectShip: (shipId: string | null, position?: { x: number; y: number }) => void;
	setInteractionMode: (mode: InteractionMode, weaponId?: string | null) => void;
	closeActionPanel: () => void;

	// 鼠标相关
	setMouseDown: (isDown: boolean) => void;
	setMousePosition: (x: number, y: number) => void;

	// 视图相关
	setCameraPosition: (x: number, y: number) => void;
	setZoom: (zoom: number) => void;
	toggleGrid: () => void;
	toggleRangeIndicator: () => void;
	toggleBackground: () => void;
	toggleWeaponArcs: () => void;
	toggleMovementRange: () => void;
	toggleLabels: () => void;
	toggleEffects: () => void;
	toggleShipIcons: () => void;
	toggleHexagonArmor: () => void;
	toggleShieldArc: () => void;
	toggleFluxIndicators: () => void;
	setHideNativeCursor: (hide: boolean) => void;
	toggleStarfieldParallax: () => void;

	// 游标相关
	setMapCursor: (x: number, y: number, r: number) => void;
	clearMapCursor: () => void;

	// 坐标精度相关
	setCoordinatePrecision: (precision: CoordinatePrecision) => void;
	toggleGridSnap: () => void;
	setGridSize: (size: number) => void;
	setAngleMode: (mode: AngleMode) => void;

	// 视图旋转相关
	setViewRotation: (rotation: number) => void;
	rotateViewToAngle: (angle: number) => void;
	resetViewRotation: () => void;

	// 面板相关
	toggleSidebar: () => void;
	setActivePanel: (panel: "ships" | "combat" | "dm" | "settings" | null) => void;
}

export const useUIStore = create<UIState & UIActions>((set) => ({
	// 初始状态
	isConnected: false,
	connectionError: null,
	playerRole: null,
	roomId: null,

	selectedShipId: null,
	interactionMode: "IDLE",
	activeWeaponId: null,
	actionPanelPosition: null,

	isMouseDown: false,
	mousePosition: { x: 0, y: 0 },

	cameraPosition: { x: 0, y: 0 },
	zoom: 1,
	showGrid: true,
	showRangeIndicator: true,
	showBackground: true,
	showWeaponArcs: true,
	showMovementRange: true,
	showLabels: true,
	showEffects: true,
	showShipIcons: true,
	showHexagonArmor: false,
	showShieldArc: true,              // 默认显示护盾弧线
	showFluxIndicators: true,         // 默认显示辐能指示器
	hideNativeCursor: false,
	enableStarfieldParallax: false, // 默认不启用星空视差

	// 地图游标初始状态
	mapCursor: null,

	// 坐标精度默认为 10 的倍数（适合太空环境）
	coordinatePrecision: "rounded10",
	gridSnap: false,
	gridSize: 100,

	// 角度使用度数模式（0-360）
	angleMode: "degrees",

	// 视图旋转默认 0（无旋转）
	viewRotation: 0,
	isViewRotating: false,

	isSidebarOpen: true,
	activePanel: "ships",

	// Actions
	setConnected: (connected) => set({ isConnected: connected }),
	setConnectionError: (error) => set({ connectionError: error }),
	setPlayerRole: (role) => set({ playerRole: role }),
	setRoomId: (roomId) => set({ roomId }),

	selectShip: (shipId, position) =>
		set({
			selectedShipId: shipId,
			actionPanelPosition: position || null,
			interactionMode: "IDLE",
			activeWeaponId: null,
		}),

	setInteractionMode: (mode, weaponId = null) =>
		set({ interactionMode: mode, activeWeaponId: weaponId }),

	closeActionPanel: () =>
		set({
			selectedShipId: null,
			actionPanelPosition: null,
			interactionMode: "IDLE",
			activeWeaponId: null,
		}),

	setMouseDown: (isDown) => set({ isMouseDown: isDown }),
	setMousePosition: (x, y) => set({ mousePosition: { x, y } }),

	setCameraPosition: (x, y) => set({ cameraPosition: { x, y } }),
	setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(3, zoom)) }),
	toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
	toggleRangeIndicator: () => set((state) => ({ showRangeIndicator: !state.showRangeIndicator })),
	toggleBackground: () => set((state) => ({ showBackground: !state.showBackground })),
	toggleWeaponArcs: () => set((state) => ({ showWeaponArcs: !state.showWeaponArcs })),
	toggleMovementRange: () => set((state) => ({ showMovementRange: !state.showMovementRange })),
	toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
	toggleEffects: () => set((state) => ({ showEffects: !state.showEffects })),
	toggleShipIcons: () => set((state) => ({ showShipIcons: !state.showShipIcons })),
	toggleHexagonArmor: () => set((state) => ({ showHexagonArmor: !state.showHexagonArmor })),
	toggleShieldArc: () => set((state) => ({ showShieldArc: !state.showShieldArc })),
	toggleFluxIndicators: () => set((state) => ({ showFluxIndicators: !state.showFluxIndicators })),
	setHideNativeCursor: (hide) => set({ hideNativeCursor: hide }),
	toggleStarfieldParallax: () =>
		set((state) => ({ enableStarfieldParallax: !state.enableStarfieldParallax })),

	// 游标设置
	setMapCursor: (x: number, y: number, r: number) =>
		set({ mapCursor: { x, y, r: Math.round(r * 100) / 100 } }),
	clearMapCursor: () => set({ mapCursor: null }),

	// 坐标精度设置
	setCoordinatePrecision: (precision: CoordinatePrecision) =>
		set({ coordinatePrecision: precision }),
	toggleGridSnap: () => set((state) => ({ gridSnap: !state.gridSnap })),
	setGridSize: (size: number) => set({ gridSize: size }),
	setAngleMode: (mode: AngleMode) => set({ angleMode: mode }),

	// 视图旋转
	setViewRotation: (rotation) => set({ viewRotation: Math.round(rotation * 100) / 100 }),
	rotateViewToAngle: (angle) =>
		set({ viewRotation: Math.round(angle * 100) / 100, isViewRotating: false }),
	resetViewRotation: () => set({ viewRotation: 0, isViewRotating: false }),

	toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
	setActivePanel: (panel) => set({ activePanel: panel }),
}));

/**
 * 游戏状态引用存储
 * 用于在React组件外访问同步的游戏状态
 */
interface GameStateRef {
	state: any;
	ships: Map<string, any>;
	currentPhase: string;
	turnCount: number;
	room: any | null;
	actionSender: GameActionSender;
}

export const gameStateRef: GameStateRef = {
	state: null,
	ships: new Map(),
	currentPhase: "DEPLOYMENT",
	turnCount: 1,
	room: null,
	actionSender: emptySender,
};

export function updateGameStateRef(state: any): void {
	gameStateRef.state = state;
	gameStateRef.currentPhase = state.phase;
	gameStateRef.turnCount = state.turnCount;

	gameStateRef.ships.clear();
	for (const [key, ship] of (state.ships as unknown as Map<string, any>).entries()) {
		gameStateRef.ships.set(key, ship);
	}
}

export function setGameRoomRef(room: any): void {
	gameStateRef.room = room;
	if (room && room.send) {
		gameStateRef.actionSender = {
			send: room.send,
			isAvailable: () => true,
		};
	} else {
		gameStateRef.actionSender = emptySender;
	}
}

export function getGameActionSender(): GameActionSender {
	return gameStateRef.actionSender;
}
