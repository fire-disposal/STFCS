import type { PlayerRole, WsEventName, WsPayload, WsResponseData, MovementPhase } from "@vt/data";
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

	// 通用设置
	suppressContextMenu: boolean; // 全局拦截右键菜单

	// 视图状态
	cameraPosition: { x: number; y: number };
	zoom: number;
	showGrid: boolean;
	showRangeIndicator: boolean;
	showBackground: boolean;
	showWeaponArcs: boolean;
	showMovementRange: boolean;
	showLabels: boolean;
	showHexagonArmor: boolean;
	showShieldArc: boolean;           // 护盾辉光弧线显示
	showShipTextures: boolean;        // 舰船贴图显示
	showWeaponTextures: boolean;      // 武器贴图显示
	hideNativeCursor: boolean;
	enableStarfieldParallax: boolean; // 星空视差效果
	hpPerBar: number;                  // 血条每个|代表的HP数量

	// HUD 图层开关（新增）
	showHpBars: boolean;              // 血条显示
	showFluxBars: boolean;            // 辐能条显示
	showShipNames: boolean;           // 舰船名显示
	showOwnerLabels: boolean;         // 所有者标签显示

	// 武器图层开关
	showWeaponLayer: boolean;         // 武器图层（挂载点+武器标记）显示

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

	// 底部栏状态
	activeBottomTab: string;
	selectedWeaponMountId: string | null;

	// 移动预览状态
	movementPreview: MovementPreviewState | null;

	// 护盾方向预览（shipId -> 方向角度）
	shieldDirectionPreview: Record<string, number | undefined>;
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

	// 通用设置
	toggleSuppressContextMenu: () => void;

	// 视图相关
	setCameraPosition: (x: number, y: number) => void;
	setZoom: (zoom: number) => void;
	toggleGrid: () => void;
	toggleRangeIndicator: () => void;
	toggleBackground: () => void;
	toggleWeaponArcs: () => void;
	toggleMovementRange: () => void;
	toggleLabels: () => void;
	toggleHexagonArmor: () => void;
	toggleShieldArc: () => void;
	toggleShipTextures: () => void;
	toggleWeaponTextures: () => void;
	setHideNativeCursor: (hide: boolean) => void;
	toggleStarfieldParallax: () => void;

	// HUD 图层开关 toggle
	toggleHpBars: () => void;
	toggleFluxBars: () => void;
	toggleShipNames: () => void;
	toggleOwnerLabels: () => void;

	// 武器图层开关 toggle
	toggleWeaponLayer: () => void;

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

	// 底部栏相关
	setActiveBottomTab: (tabId: string) => void;
	setSelectedWeaponMountId: (mountId: string | null) => void;

	// 移动预览相关
	setMovementPreview: (preview: MovementPreviewState | null) => void;

	// 护盾方向预览相关
	setShieldDirectionPreview: (shipId: string, direction: number | undefined) => void;
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

	suppressContextMenu: true,

	cameraPosition: { x: 0, y: 0 },
	zoom: 1,
	showGrid: true,
	showRangeIndicator: true,
	showBackground: true,
	showWeaponArcs: true,
	showMovementRange: true,
	showLabels: true,
	showHexagonArmor: false,
	showShieldArc: true,              // 默认显示护盾弧线
	showShipTextures: true,           // 默认显示舰船贴图
	showWeaponTextures: true,         // 默认显示武器贴图
	hideNativeCursor: false,
	enableStarfieldParallax: false, // 默认不启用星空视差
	hpPerBar: 200,                    // 默认每个|代表20HP

	// HUD 图层开关（默认全部显示）
	showHpBars: true,
	showFluxBars: true,
	showShipNames: true,
	showOwnerLabels: true,

	// 武器图层开关（默认显示）
	showWeaponLayer: true,

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

	activeBottomTab: "ship-info",
	selectedWeaponMountId: null,

	movementPreview: null,
	shieldDirectionPreview: {},

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
	toggleSuppressContextMenu: () => set((state) => ({ suppressContextMenu: !state.suppressContextMenu })),

	toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
	toggleRangeIndicator: () => set((state) => ({ showRangeIndicator: !state.showRangeIndicator })),
	toggleBackground: () => set((state) => ({ showBackground: !state.showBackground })),
	toggleWeaponArcs: () => set((state) => ({ showWeaponArcs: !state.showWeaponArcs })),
	toggleMovementRange: () => set((state) => ({ showMovementRange: !state.showMovementRange })),
	toggleLabels: () => set((state) => ({ showLabels: !state.showLabels })),
	toggleHexagonArmor: () => set((state) => ({ showHexagonArmor: !state.showHexagonArmor })),
	toggleShieldArc: () => set((state) => ({ showShieldArc: !state.showShieldArc })),
	toggleShipTextures: () => set((state) => ({ showShipTextures: !state.showShipTextures })),
	toggleWeaponTextures: () => set((state) => ({ showWeaponTextures: !state.showWeaponTextures })),
	setHideNativeCursor: (hide) => set({ hideNativeCursor: hide }),
	toggleStarfieldParallax: () =>
		set((state) => ({ enableStarfieldParallax: !state.enableStarfieldParallax })),
	setHpPerBar: (value) => set({ hpPerBar: Math.max(5, Math.min(100, value)) }),

	// HUD 图层开关 toggle
	toggleHpBars: () => set((state) => ({ showHpBars: !state.showHpBars })),
	toggleFluxBars: () => set((state) => ({ showFluxBars: !state.showFluxBars })),
	toggleShipNames: () => set((state) => ({ showShipNames: !state.showShipNames })),
	toggleOwnerLabels: () => set((state) => ({ showOwnerLabels: !state.showOwnerLabels })),

	// 武器图层开关 toggle
	toggleWeaponLayer: () => set((state) => ({ showWeaponLayer: !state.showWeaponLayer })),

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

	setActiveBottomTab: (tabId: string) => set({ activeBottomTab: tabId }),
	setSelectedWeaponMountId: (mountId: string | null) => set({ selectedWeaponMountId: mountId }),

	setMovementPreview: (preview) => set({ movementPreview: preview }),

	setShieldDirectionPreview: (shipId, direction) =>
		set((state) => ({
			shieldDirectionPreview: {
				...state.shieldDirectionPreview,
				[shipId]: direction,
			},
		})),
}));
