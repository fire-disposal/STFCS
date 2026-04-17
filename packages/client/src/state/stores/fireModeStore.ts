/**
 * fireModeStore - 火控系统 UI 状态管理
 *
 * ⚠️ 仅存储 UI 意图 ID，不存储对象引用
 * ⚠️ 所有游戏数据通过 useFireControl hook 从 Schema 获取
 *
 * 设计原则：
 * - 服务端权威：数据通过 Colyseus Schema 同步
 * - 客户端仅意图：只存 selectedWeaponId, selectedTargetIds
 * - 稳定依赖：全部使用基本类型值，避免无限循环
 */

import { create } from "zustand";

interface FireModeStoreState {
	/** 当前选中的武器 ID（mountId，用于显示目标列表） */
	selectedWeaponId: string | null;
	/** 选中的目标 ID 列表（shipId[]，用于开火命令） */
	selectedTargetIds: string[];
	/** 是否正在等待查询结果 */
	isLoading: boolean;
	/** 是否正在开火 */
	isFiring: boolean;
	/** 开火错误消息 */
	fireError: string | null;
}

interface FireModeStoreActions {
	/** 选中武器 */
	selectWeapon: (mountId: string) => void;
	/** 清除武器选择 */
	clearWeaponSelection: () => void;
	/** 设置选中目标 */
	setSelectedTargets: (targetIds: string[]) => void;
	/** 添加选中目标 */
	addSelectedTarget: (targetId: string) => void;
	/** 移除选中目标 */
	removeSelectedTarget: (targetId: string) => void;
	/** 清除目标选择 */
	clearTargetSelection: () => void;
	/** 开始加载 */
	setLoading: (loading: boolean) => void;
	/** 开始开火 */
	startFiring: () => void;
	/** 结束开火 */
	endFiring: (error?: string | null) => void;
	/** 清除错误 */
	clearError: () => void;
	/** 重置所有状态 */
	reset: () => void;
}

const initialState: FireModeStoreState = {
	selectedWeaponId: null,
	selectedTargetIds: [],
	isLoading: false,
	isFiring: false,
	fireError: null,
};

export const useFireModeStore = create<FireModeStoreState & FireModeStoreActions>((set, get) => ({
	...initialState,

	selectWeapon: (mountId) => {
		set({
			selectedWeaponId: mountId,
			selectedTargetIds: [], // 切换武器时清除目标选择
			fireError: null,
		});
	},

	clearWeaponSelection: () => {
		set({
			selectedWeaponId: null,
			selectedTargetIds: [],
			fireError: null,
		});
	},

	setSelectedTargets: (targetIds) => set({ selectedTargetIds: targetIds }),

	addSelectedTarget: (targetId) => {
		const current = get().selectedTargetIds;
		if (!current.includes(targetId)) {
			set({ selectedTargetIds: [...current, targetId] });
		}
	},

	removeSelectedTarget: (targetId) => {
		const current = get().selectedTargetIds;
		set({ selectedTargetIds: current.filter(id => id !== targetId) });
	},

	clearTargetSelection: () => set({ selectedTargetIds: [] }),

	setLoading: (loading) => set({ isLoading: loading }),

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