import { GamePhase } from "@vt/data";
import type { GameRoomState, PlayerRole, WsEventName, WsPayload, WsResponseData, MovementPhase } from "@vt/data";
import type { SocketRoom } from "@/network";
import { create } from "zustand";

export type MoveMode = "forward" | "strafe";

export interface MovementPreviewState {
	shipId: string;
	phase: MovementPhase | undefined;
	mode: MoveMode;
	value: number;
	turn: number;
	remaining: {
		forward: number;
		strafe: number;
		turn: number;
	};
	directionLocked: boolean;
}

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
	showShipTextures: boolean;        // 舰船贴图显示
	showWeaponTextures: boolean;      // 武器贴图显示
	hideNativeCursor: boolean;
	enableStarfieldParallax: boolean; // 星空视差效果
	hpPerBar: number;                  // 血条每个|代表的HP数量

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

	// 移动预览状态
	movementPreview: MovementPreviewState | null;
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
	toggleShipTextures: () => void;
	toggleWeaponTextures: () => void;
	setHideNativeCursor: (hide: boolean) => void;
	toggleStarfieldParallax: () => void;

	// 磁性吸附配置
	snapRadius: number;
	snapToShips: boolean;
	snapToMounts: boolean;
	toggleSnapToShips: () => void;
	toggleSnapToMounts: () => void;
	setSnapRadius: (radius: number) => void;

	// 血条配置
	setHpPerBar: (value: number) => void;

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

	// 移动预览相关
	setMovementPreview: (preview: MovementPreviewState | null) => void;
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
	showShipTextures: true,           // 默认显示舰船贴图
	showWeaponTextures: true,         // 默认显示武器贴图
	hideNativeCursor: false,
	enableStarfieldParallax: false, // 默认不启用星空视差
	snapRadius: 50,                  // 默认吸附半径50像素
	snapToShips: true,               // 默认吸附舰船
	snapToMounts: true,              // 默认吸附挂载点
	hpPerBar: 200,                    // 默认每个|代表20HP

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

	movementPreview: null,

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
	toggleShipTextures: () => set((state) => ({ showShipTextures: !state.showShipTextures })),
	toggleWeaponTextures: () => set((state) => ({ showWeaponTextures: !state.showWeaponTextures })),
	setHideNativeCursor: (hide) => set({ hideNativeCursor: hide }),
	toggleStarfieldParallax: () =>
		set((state) => ({ enableStarfieldParallax: !state.enableStarfieldParallax })),
	toggleSnapToShips: () => set((state) => ({ snapToShips: !state.snapToShips })),
	toggleSnapToMounts: () => set((state) => ({ snapToMounts: !state.snapToMounts })),
	setSnapRadius: (radius) => set({ snapRadius: Math.max(10, Math.min(200, radius)) }),
	setHpPerBar: (value) => set({ hpPerBar: Math.max(5, Math.min(100, value)) }),

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

	setMovementPreview: (preview) => set({ movementPreview: preview }),
}));

/**
 * 游戏状态引用存储
 * 用于在React组件外访问同步的游戏状态
 */
export interface GameStateRef {
	state: GameRoomState | null;
	currentPhase: GamePhase;
	turnCount: number;
	room: SocketRoom | null;
	actionSender: GameActionSender;
}

export const gameStateRef: GameStateRef = {
	state: null,
	currentPhase: GamePhase.DEPLOYMENT,
	turnCount: 1,
	room: null,
	actionSender: emptySender,
};

export function setGameRoomRef(room: SocketRoom | null): void {
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
