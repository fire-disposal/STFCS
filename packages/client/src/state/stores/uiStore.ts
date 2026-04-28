import type { PlayerRole, MovementPhase } from "@vt/data";
import { create } from "zustand";

export type MoveMode = "forward" | "strafe";

export interface MovementPreviewState {
	shipId: string;
	phase: MovementPhase | undefined;
	mode: MoveMode;
	value: number;
	turn: number;
	remaining: { forward: number; strafe: number; turn: number };
	directionLocked: boolean;
}

export type InteractionMode = "IDLE" | "DRAWING_MOVE" | "SELECTING_TARGET" | "DM_OVERRIDING";
export type CoordinatePrecision = "exact" | "rounded10" | "rounded100";
export type AngleMode = "degrees" | "radians" | "nav";

interface BoolToggleMap {
	[k: string]: boolean;
}

interface UIState {
	isConnected: boolean;
	connectionError: string | null;
	playerRole: PlayerRole | null;
	roomId: string | null;

	selectedShipId: string | null;
	interactionMode: InteractionMode;
	activeWeaponId: string | null;
	actionPanelPosition: { x: number; y: number } | null;

	isMouseDown: boolean;
	mousePosition: { x: number; y: number };

	suppressContextMenu: boolean;

	cameraPosition: { x: number; y: number };
	zoom: number;

	/** 所有布尔开关统一存储 */
	toggles: BoolToggleMap & {
		grid: boolean;
		rangeIndicator: boolean;
		background: boolean;
		weaponArcs: boolean;
		movementRange: boolean;
		labels: boolean;
		hexagonArmor: boolean;
		shieldArc: boolean;
		textures: boolean;
		starfieldParallax: boolean;
		hpBars: boolean;
		fluxBars: boolean;
		shipNames: boolean;
		ownerLabels: boolean;
		weaponLayer: boolean;
	};

	hideNativeCursor: boolean;
	hpPerBar: number;

	mapCursor: { x: number; y: number; r: number } | null;
	coordinatePrecision: CoordinatePrecision;
	gridSnap: boolean;
	gridSize: number;
	angleMode: AngleMode;

	viewRotation: number;
	isViewRotating: boolean;

	isSidebarOpen: boolean;
	activePanel: "ships" | "combat" | "dm" | "settings" | null;
	activeBottomTab: string;
	selectedWeaponMountId: string | null;

	movementPreview: MovementPreviewState | null;
	shieldDirectionPreview: Record<string, number | undefined>;
}

interface UIActions {
	setConnected: (connected: boolean) => void;
	setConnectionError: (error: string | null) => void;
	setPlayerRole: (role: PlayerRole | null) => void;
	setRoomId: (roomId: string | null) => void;

	selectShip: (shipId: string | null, position?: { x: number; y: number }) => void;
	setInteractionMode: (mode: InteractionMode, weaponId?: string | null) => void;
	closeActionPanel: () => void;

	setMouseDown: (isDown: boolean) => void;
	setMousePosition: (x: number, y: number) => void;

	toggleSuppressContextMenu: () => void;

	setCameraPosition: (x: number, y: number) => void;
	setZoom: (zoom: number) => void;

	/** 切换某个布尔开关 */
	toggle: (key: keyof UIState["toggles"]) => void;

	setHideNativeCursor: (hide: boolean) => void;
	setHpPerBar: (value: number) => void;

	setMapCursor: (x: number, y: number, r: number) => void;
	clearMapCursor: () => void;

	setCoordinatePrecision: (precision: CoordinatePrecision) => void;
	toggleGridSnap: () => void;
	setGridSize: (size: number) => void;
	setAngleMode: (mode: AngleMode) => void;

	setViewRotation: (rotation: number) => void;
	rotateViewToAngle: (angle: number) => void;
	resetViewRotation: () => void;

	toggleSidebar: () => void;
	setActivePanel: (panel: "ships" | "combat" | "dm" | "settings" | null) => void;
	setActiveBottomTab: (tabId: string) => void;
	setSelectedWeaponMountId: (mountId: string | null) => void;

	setMovementPreview: (preview: MovementPreviewState | null) => void;
	setShieldDirectionPreview: (shipId: string, direction: number | undefined) => void;
}

const DEFAULT_TOGGLES = {
	grid: true,
	rangeIndicator: true,
	background: true,
	weaponArcs: true,
	movementRange: true,
	labels: true,
	hexagonArmor: false,
	shieldArc: true,
	textures: true,
	starfieldParallax: false,
	hpBars: true,
	fluxBars: true,
	shipNames: true,
	ownerLabels: true,
	weaponLayer: true,
};

export const useUIStore = create<UIState & UIActions>((set) => ({
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

	toggles: { ...DEFAULT_TOGGLES },

	hideNativeCursor: false,
	hpPerBar: 200,

	mapCursor: null,
	coordinatePrecision: "rounded10",
	gridSnap: false,
	gridSize: 100,
	angleMode: "degrees",

	viewRotation: 0,
	isViewRotating: false,

	isSidebarOpen: true,
	activePanel: "ships",
	activeBottomTab: "ship-info",
	selectedWeaponMountId: null,

	movementPreview: null,
	shieldDirectionPreview: {},

	setConnected: (connected) => set({ isConnected: connected }),
	setConnectionError: (error) => set({ connectionError: error }),
	setPlayerRole: (role) => set({ playerRole: role }),
	setRoomId: (roomId) => set({ roomId }),

	selectShip: (shipId, position) =>
		set({ selectedShipId: shipId, actionPanelPosition: position || null, interactionMode: "IDLE", activeWeaponId: null }),

	setInteractionMode: (mode, weaponId = null) =>
		set({ interactionMode: mode, activeWeaponId: weaponId }),

	closeActionPanel: () =>
		set({ selectedShipId: null, actionPanelPosition: null, interactionMode: "IDLE", activeWeaponId: null }),

	setMouseDown: (isDown) => set({ isMouseDown: isDown }),
	setMousePosition: (x, y) => set({ mousePosition: { x, y } }),

	setCameraPosition: (x, y) => set({ cameraPosition: { x, y } }),
	setZoom: (zoom) => set({ zoom: Math.max(0.5, Math.min(3, zoom)) }),
	toggleSuppressContextMenu: () => set((s) => ({ suppressContextMenu: !s.suppressContextMenu })),

	toggle: (key) => set((s) => ({ toggles: { ...s.toggles, [key]: !s.toggles[key] } })),

	setHideNativeCursor: (hide) => set({ hideNativeCursor: hide }),
	setHpPerBar: (value) => set({ hpPerBar: Math.max(5, Math.min(100, value)) }),

	setMapCursor: (x, y, r) => set({ mapCursor: { x, y, r: Math.round(r * 100) / 100 } }),
	clearMapCursor: () => set({ mapCursor: null }),

	setCoordinatePrecision: (precision) => set({ coordinatePrecision: precision }),
	toggleGridSnap: () => set((s) => ({ gridSnap: !s.gridSnap })),
	setGridSize: (size) => set({ gridSize: size }),
	setAngleMode: (mode) => set({ angleMode: mode }),

	setViewRotation: (rotation) => set({ viewRotation: Math.round(rotation * 100) / 100 }),
	rotateViewToAngle: (angle) => set({ viewRotation: Math.round(angle * 100) / 100, isViewRotating: false }),
	resetViewRotation: () => set({ viewRotation: 0, isViewRotating: false }),

	toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
	setActivePanel: (panel) => set({ activePanel: panel }),
	setActiveBottomTab: (tabId) => set({ activeBottomTab: tabId }),
	setSelectedWeaponMountId: (mountId) => set({ selectedWeaponMountId: mountId }),

	setMovementPreview: (preview) => set({ movementPreview: preview }),

	setShieldDirectionPreview: (shipId, direction) =>
		set((s) => ({ shieldDirectionPreview: { ...s.shieldDirectionPreview, [shipId]: direction } })),
}));
