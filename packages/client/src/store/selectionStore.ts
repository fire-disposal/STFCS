/**
 * 玩家选择管理器
 *
 * 管理舰船选择、控制权限和交互状态
 */

import type { ShipState } from "@vt/types";
import { PlayerRole } from "@vt/types";
import { create } from "zustand";

/**
 * 交互模式枚举
 */
export type InteractionMode =
	| "IDLE" // 空闲
	| "SELECTING" // 选择中
	| "MOVING" // 移动中
	| "TARGETING" // 选择目标
	| "PLACING" // DM 摆放对象
	| "MEASURING" // 测量距离
	| "ROTATING_VIEW"; // 旋转视图

/**
 * 选择状态
 */
interface SelectionState {
	// 当前选中的舰船
	selectedShipId: string | null;

	// 选中的目标舰船（用于攻击）
	selectedTargetId: string | null;

	// 多选舰船列表
	selectedShipIds: string[];

	// 交互模式
	interactionMode: InteractionMode;

	// 鼠标位置（世界坐标）
	mouseWorldX: number;
	mouseWorldY: number;

	// 最后点击时间（用于双击检测）
	lastClickTime: number;
	lastClickPosition: { x: number; y: number };
}

/**
 * 权限检查
 */
interface PermissionCheck {
	// 是否可以操作舰船
	canOperateShip: (
		ship: ShipState,
		playerSessionId: string,
		playerRole: string,
		currentPhase: string
	) => boolean;

	// 是否可以移动舰船
	canMoveShip: (ship: ShipState) => boolean;

	// 是否可以开火
	canFire: (ship: ShipState) => boolean;

	// 是否可以排散
	canVent: (ship: ShipState) => boolean;

	// 是否可以切换护盾
	canToggleShield: (ship: ShipState) => boolean;
}

interface SelectionActions {
	// 选择舰船
	selectShip: (shipId: string | null, multiSelect?: boolean) => void;

	// 选择目标
	selectTarget: (targetId: string | null) => void;

	// 清空选择
	clearSelection: () => void;

	// 设置交互模式
	setInteractionMode: (mode: InteractionMode) => void;

	// 更新鼠标位置
	setMouseWorldPosition: (x: number, y: number) => void;

	// 处理点击
	handleClick: (x: number, y: number) => boolean; // 返回是否双击

	// 切换选择
	toggleSelection: (shipId: string) => void;
}

type SelectionStore = SelectionState & SelectionActions & PermissionCheck;

export const useSelectionStore = create<SelectionStore>((set, get) => ({
	// 初始状态
	selectedShipId: null,
	selectedTargetId: null,
	selectedShipIds: [],
	interactionMode: "IDLE",
	mouseWorldX: 0,
	mouseWorldY: 0,
	lastClickTime: 0,
	lastClickPosition: { x: 0, y: 0 },

	// Actions
	selectShip: (shipId, multiSelect = false) => {
		set((state) => {
			if (multiSelect && shipId) {
				// 多选模式
				const exists = state.selectedShipIds.includes(shipId);
				return {
					selectedShipIds: exists
						? state.selectedShipIds.filter((id) => id !== shipId)
						: [...state.selectedShipIds, shipId],
					selectedShipId: shipId, // 最后点击的作为主选择
				};
			}

			return {
				selectedShipId: shipId,
				selectedShipIds: shipId ? [shipId] : [],
				selectedTargetId: null, // 切换选择时清空目标
			};
		});
	},

	selectTarget: (targetId) => {
		set({ selectedTargetId: targetId });
	},

	clearSelection: () => {
		set({
			selectedShipId: null,
			selectedTargetId: null,
			selectedShipIds: [],
		});
	},

	setInteractionMode: (mode) => {
		set({ interactionMode: mode });
	},

	setMouseWorldPosition: (x, y) => {
		set({ mouseWorldX: x, mouseWorldY: y });
	},

	handleClick: (x, y) => {
		const state = get();
		const now = Date.now();
		const isDoubleClick =
			now - state.lastClickTime < 300 && // 300ms 内
			Math.abs(x - state.lastClickPosition.x) < 10 &&
			Math.abs(y - state.lastClickPosition.y) < 10;

		set({
			lastClickTime: now,
			lastClickPosition: { x, y },
		});

		return isDoubleClick;
	},

	toggleSelection: (shipId) => {
		set((state) => {
			if (state.selectedShipIds.includes(shipId)) {
				const newSelection = state.selectedShipIds.filter((id) => id !== shipId);
				return {
					selectedShipIds: newSelection,
					selectedShipId: newSelection[0] || null,
				};
			} else {
				return {
					selectedShipIds: [...state.selectedShipIds, shipId],
					selectedShipId: shipId,
				};
			}
		});
	},

	// Permission Checks
	canOperateShip: (ship, playerSessionId, playerRole, currentPhase) => {
		if (!ship) return false;
		if (ship.isOverloaded) return false;

		// DM 可以操作任何舰船
		if (playerRole === PlayerRole.DM) return true;

		// 玩家只能操作自己的舰船
		if (ship.ownerId !== playerSessionId) return false;

		// 玩家只能在 PLAYER_TURN 阶段操作
		if (currentPhase !== "PLAYER_TURN") return false;

		return true;
	},

	canMoveShip: (ship) => {
		const state = get();
		if (!ship || !state.selectedShipId) return false;
		if (ship.isOverloaded) return false;
		if (ship.hasMoved) return false; // 本回合已移动
		return true;
	},

	canFire: (ship) => {
		const state = get();
		if (!ship || !state.selectedShipId) return false;
		if (ship.isOverloaded) return false;
		if (ship.hasFired) return false; // 本回合已开火
		if (!state.selectedTargetId) return false; // 没有选择目标
		return true;
	},

	canVent: (ship) => {
		if (!ship) return false;
		if (ship.shield.active) return false; // 需要关闭护盾
		if (ship.flux.hard + ship.flux.soft <= 0) return false; // 没有辐能
		return true;
	},

	canToggleShield: (ship) => {
		if (!ship) return false;
		if (ship.isOverloaded && !ship.shield.active) return false; // 过载时不能开启
		return true;
	},
}));

/**
 * 获取选中舰船的详细信息
 */
export function getSelectedShipDetails(ship: ShipState | null) {
	if (!ship) return null;

	return {
		id: ship.id,
		faction: ship.faction,
		hullPercent: ship.hull.max > 0 ? (ship.hull.current / ship.hull.max) * 100 : 0,
		fluxPercent:
			ship.flux.max > 0
				? ((ship.flux.hard + ship.flux.soft) / ship.flux.max) * 100
				: 0,
		isOverloaded: ship.isOverloaded,
		shieldActive: ship.shield.active,
		hasMoved: ship.hasMoved,
		hasFired: ship.hasFired,
		position: { x: ship.transform.x, y: ship.transform.y },
		heading: ship.transform.heading,
	};
}

/**
 * 检查舰船是否在武器射程内
 */
export function isTargetInRange(
	attacker: ShipState,
	target: ShipState,
	weaponRange: number
): boolean {
	const dx = target.transform.x - attacker.transform.x;
	const dy = target.transform.y - attacker.transform.y;
	const distance = Math.sqrt(dx * dx + dy * dy);
	return distance <= weaponRange;
}

/**
 * 检查舰船是否在武器射界内
 */
export function isTargetInArc(
	attacker: ShipState,
	target: ShipState,
	weaponArc: number,
	weaponAngle: number
): boolean {
	const dx = target.transform.x - attacker.transform.x;
	const dy = target.transform.y - attacker.transform.y;

	// 计算目标相对角度
	const angleToTarget = (Math.atan2(dy, dx) * 180) / Math.PI;
	const normalizedAngle = angleToTarget < 0 ? angleToTarget + 360 : angleToTarget;

	// 武器绝对角度
	const weaponAbsoluteAngle = (attacker.transform.heading + weaponAngle + 360) % 360;

	// 角度差
	let angleDiff = Math.abs(normalizedAngle - weaponAbsoluteAngle);
	if (angleDiff > 180) angleDiff = 360 - angleDiff;

	return angleDiff <= weaponArc / 2;
}

export default useSelectionStore;
