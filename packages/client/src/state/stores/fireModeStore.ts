/**
 * fireModeStore - 武器开火状态管理
 *
 * 交互流程：
 * 1. 选中舰船 → 发送批量查询请求（获取所有武器的可攻击目标）
 * 2. 服务端返回权威的目标列表
 * 3. 选择目标 → 点击开火按钮
 *
 * ⚠️ 所有游戏规则计算由服务端权威执行
 * 客户端仅用于 UI 状态管理和瞄准线绘制
 */

import type { ShipState, WeaponSlot } from "@/sync/types";
import { ClientCommand } from "@/sync/types";
import { create } from "zustand";

/** 目标可攻击性状态（与服务端 AttackableTargetsResult 一致） */
export interface TargetAttackability {
	shipId: string;
	canAttack: boolean;
	reason?: string;
	inRange: boolean;
	inArc: boolean;
	distance: number;
	estimatedDamage?: number;
	isFriendly?: boolean;
}

/** 单个武器的查询结果 */
export interface AttackableTargetsResult {
	attackerShipId: string;
	weaponInstanceId: string;
	targets: TargetAttackability[];
	weaponCanFire: boolean;
	weaponFireReason?: string;
}

/** 批量查询结果 */
export interface AllAttackableTargetsResult {
	shipId: string;
	weapons: Array<{ weaponInstanceId: string; result: AttackableTargetsResult }>;
}

/** 渲染器状态 */
interface FireModeStoreState {
	/** 当前选中的舰船 */
	selectedShip: ShipState | null;
	/** 当前选中的武器（用于绘制射界和瞄准线） */
	selectedWeapon: WeaponSlot | null;
	/** 各武器的可攻击目标列表（从批量查询获取） */
	weaponsTargets: Map<string, AttackableTargetsResult>;  // weaponInstanceId -> result
	/** 当前选中武器的可攻击目标（便捷访问） */
	attackableTargets: TargetAttackability[];
	/** 当前选中武器的开火状态 */
	weaponCanFire: boolean;
	weaponFireReason?: string;
	/** 选中的目标 ID（用于开火） */
	selectedTargetIds: string[];
	/** 是否正在查询 */
	isLoading: boolean;
	/** 是否正在开火 */
	isFiring: boolean;
	/** 开火错误 */
	fireError: string | null;
}

interface FireModeStoreActions {
	/** 选中舰船并批量查询所有武器 */
	selectShip: (
		ship: ShipState,
		room: { send: (type: string, payload: unknown) => void }
	) => void;
	/** 接收批量查询结果 */
	setAllAttackableTargetsFromServer: (result: AllAttackableTargetsResult) => void;
	/** 选中武器（切换当前显示的武器） */
	selectWeapon: (weapon: WeaponSlot) => void;
	/** 单武器查询（用于刷新） */
	queryWeaponTargets: (
		ship: ShipState,
		weapon: WeaponSlot,
		room: { send: (type: string, payload: unknown) => void }
	) => void;
	/** 接收单武器查询结果 */
	setAttackableTargetsFromServer: (result: AttackableTargetsResult) => void;
	/** 清除选中 */
	clearSelection: () => void;
	/** 设置选中目标 */
	setSelectedTargets: (targetIds: string[]) => void;
	/** 开火状态 */
	startFiring: () => void;
	endFiring: (error?: string | null) => void;
	clearError: () => void;
	/** 重置 */
	reset: () => void;
}

const initialState: FireModeStoreState = {
	selectedShip: null,
	selectedWeapon: null,
	weaponsTargets: new Map(),
	attackableTargets: [],
	weaponCanFire: true,
	weaponFireReason: undefined,
	selectedTargetIds: [],
	isLoading: false,
	isFiring: false,
	fireError: null,
};

export const useFireModeStore = create<FireModeStoreState & FireModeStoreActions>((set, get) => ({
	...initialState,

	/** 选中舰船并批量查询所有武器 */
	selectShip: (ship, room) => {
		set({
			selectedShip: ship,
			selectedWeapon: null,
			weaponsTargets: new Map(),
			attackableTargets: [],
			weaponCanFire: true,
			weaponFireReason: undefined,
			selectedTargetIds: [],
			fireError: null,
			isLoading: true,
		});

		// 批量查询所有武器
		room.send(ClientCommand.CMD_GET_ALL_ATTACKABLE_TARGETS, {
			shipId: ship.id,
		});
	},

	/** 接收批量查询结果 */
	setAllAttackableTargetsFromServer: (result) => {
		const weaponsTargets = new Map<string, AttackableTargetsResult>();
		result.weapons.forEach(({ weaponInstanceId, result: r }) => {
			weaponsTargets.set(weaponInstanceId, r);
		});

		// 如果有选中武器，更新当前显示的目标列表
		const selectedWeapon = get().selectedWeapon;
		let attackableTargets: TargetAttackability[] = [];
		let weaponCanFire = true;
		let weaponFireReason: string | undefined;

		if (selectedWeapon) {
			const weaponResult = weaponsTargets.get(selectedWeapon.instanceId);
			if (weaponResult) {
				attackableTargets = weaponResult.targets.filter(t => t.canAttack);
				weaponCanFire = weaponResult.weaponCanFire;
				weaponFireReason = weaponResult.weaponFireReason;
			}
		}

		set({
			weaponsTargets,
			attackableTargets,
			weaponCanFire,
			weaponFireReason,
			isLoading: false,
		});
	},

	/** 选中武器（切换当前显示的武器） */
	selectWeapon: (weapon) => {
		const weaponsTargets = get().weaponsTargets;
		const weaponResult = weaponsTargets.get(weapon.instanceId);

		set({
			selectedWeapon: weapon,
			selectedTargetIds: [],
			fireError: null,
			// 如果已有查询结果，立即显示
			attackableTargets: weaponResult?.targets.filter(t => t.canAttack) ?? [],
			weaponCanFire: weaponResult?.weaponCanFire ?? true,
			weaponFireReason: weaponResult?.weaponFireReason,
		});
	},

	/** 单武器查询（用于刷新） */
	queryWeaponTargets: (ship, weapon, room) => {
		set({ isLoading: true });
		room.send(ClientCommand.CMD_GET_ATTACKABLE_TARGETS, {
			shipId: ship.id,
			weaponInstanceId: weapon.instanceId,
		});
	},

	/** 接收单武器查询结果 */
	setAttackableTargetsFromServer: (result) => {
		const weaponsTargets = get().weaponsTargets;
		weaponsTargets.set(result.weaponInstanceId, result);

		// 如果是当前选中的武器，更新显示
		const selectedWeapon = get().selectedWeapon;
		if (selectedWeapon?.instanceId === result.weaponInstanceId) {
			set({
				weaponsTargets: new Map(weaponsTargets),
				attackableTargets: result.targets.filter(t => t.canAttack),
				weaponCanFire: result.weaponCanFire,
				weaponFireReason: result.weaponFireReason,
				isLoading: false,
			});
		} else {
			set({
				weaponsTargets: new Map(weaponsTargets),
				isLoading: false,
			});
		}
	},

	clearSelection: () => {
		set({
			selectedShip: null,
			selectedWeapon: null,
			weaponsTargets: new Map(),
			attackableTargets: [],
			weaponCanFire: true,
			weaponFireReason: undefined,
			selectedTargetIds: [],
			fireError: null,
			isLoading: false,
		});
	},

	setSelectedTargets: (targetIds) => set({ selectedTargetIds: targetIds }),

	startFiring: () => set({ isFiring: true }),

	endFiring: (error) => {
		if (error) {
			set({ isFiring: false, fireError: error });
		} else {
			set({
				selectedTargetIds: [],
				fireError: null,
				isFiring: false,
			});
		}
	},

	clearError: () => set({ fireError: null }),

	reset: () => set(initialState),
}));

// 导出类型
export type { TargetAttackability as TargetAttackabilityType };