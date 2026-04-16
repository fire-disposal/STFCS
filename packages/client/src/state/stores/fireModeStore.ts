/**
 * fireModeStore - 武器开火状态管理
 *
 * 新交互流程（移除瞄准模式）：
 * 1. 点击武器 → 展开武器详情面板（局部状态）
 * 2. 面板内显示武器信息和可攻击目标列表
 * 3. 选择目标 → 点击开火按钮
 *
 * 此 store 仅用于渲染器绘制瞄准线，
 * 面板内的交互状态由面板组件自身管理
 */

import type { ShipState, WeaponSlot } from "@/sync/types";
import { angleBetween, angleDifference, distance } from "@vt/rules";
import { create } from "zustand";

/** 目标可攻击性状态 */
export interface TargetAttackability {
	shipId: string;
	canAttack: boolean;
	reason?: string; // 不可攻击原因
	inRange: boolean; // 是否在射程内
	inArc: boolean; // 是否在射界内
	distance: number; // 距离
	estimatedDamage?: number; // 预估伤害
	isFriendly?: boolean; // 是否为友军（用于 UI 提示误伤）
}

/** 渲染器状态（用于绘制瞄准线） */
interface FireModeStoreState {
	/** 当前选中的武器（用于绘制射界和瞄准线） */
	selectedWeapon: WeaponSlot | null;
	/** 选中的舰船 */
	attackerShip: ShipState | null;
	/** 可攻击目标列表 */
	attackableTargets: TargetAttackability[];
	/** 当前选中的目标 ID（用于渲染器高亮） */
	selectedTargetIds: string[];
	/** 是否正在发送开火命令 */
	isFiring: boolean;
	/** 开火错误信息 */
	fireError: string | null;
}

interface FireModeStoreActions {
	/** 设置选中的武器（面板展开时调用） */
	setSelectedWeapon: (
		ship: ShipState,
		weapon: WeaponSlot,
		allShips: Map<string, ShipState>
	) => void;
	/** 清除选中武器（面板关闭时调用） */
	clearSelectedWeapon: () => void;
	/** 设置选中的目标 */
	setSelectedTargets: (targetIds: string[]) => void;
	/** 开始发送开火命令 */
	startFiring: () => void;
	/** 结束发送开火命令 */
	endFiring: (error?: string | null) => void;
	/** 清除错误信息 */
	clearError: () => void;
	/** 重置状态 */
	reset: () => void;
}

const initialState: FireModeStoreState = {
	selectedWeapon: null,
	attackerShip: null,
	attackableTargets: [],
	selectedTargetIds: [],
	isFiring: false,
	fireError: null,
};

/**
 * 计算目标可攻击性
 *
 * 使用 @vt/rules 的权威函数，与后端保持一致：
 * - angleBetween: 返回 0-360 范围角度
 * - angleDifference: 计算最小角度差
 * - distance: 计算距离
 *
 * 验证：
 * - 目标是否已摧毁
 * - 是否在射程内（含最小射程检查）
 * - 是否在射界内
 *
 * 注意：不区分友军/敌军，允许向任何人开火（包括误伤）
 */
export function calculateTargetAttackability(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState
): TargetAttackability {
	// 已摧毁目标不可攻击
	if (target.isDestroyed || target.hull.current <= 0) {
		return {
			shipId: target.id,
			canAttack: false,
			reason: "目标已摧毁",
			inRange: false,
			inArc: false,
			distance: 0,
		};
	}

	// 计算武器挂载点的世界坐标（与后端 getWeaponWorldPosition 一致）
	const headingRad = (attacker.transform.heading * Math.PI) / 180;
	const mountOffsetX = weapon.mountOffsetX ?? 0;
	const mountOffsetY = weapon.mountOffsetY ?? 0;
	const mountWorldX =
		attacker.transform.x +
		mountOffsetX * Math.cos(headingRad) -
		mountOffsetY * Math.sin(headingRad);
	const mountWorldY =
		attacker.transform.y +
		mountOffsetX * Math.sin(headingRad) +
		mountOffsetY * Math.cos(headingRad);

	// 使用权威函数计算距离和角度
	const dist = distance(mountWorldX, mountWorldY, target.transform.x, target.transform.y);
	const angleToTarget = angleBetween(
		mountWorldX,
		mountWorldY,
		target.transform.x,
		target.transform.y
	);

	// 武器实际朝向（规范化到 0-360）
	const weaponFacing =
		(((attacker.transform.heading + (weapon.mountFacing ?? 0)) % 360) + 360) % 360;
	const arcHalf = Math.max(0, weapon.arc ?? 90) / 2;

	// 射程检查
	const maxRange = weapon.range ?? 300;
	const minRange = weapon.minRange ?? 0;

	if (dist > maxRange) {
		return {
			shipId: target.id,
			canAttack: false,
			reason: `超出射程: ${Math.round(dist)} > ${maxRange}`,
			inRange: false,
			inArc: true,
			distance: dist,
		};
	}

	if (minRange > 0 && dist < minRange) {
		return {
			shipId: target.id,
			canAttack: false,
			reason: `距离过近: ${Math.round(dist)} < ${minRange}`,
			inRange: false,
			inArc: true,
			distance: dist,
		};
	}

	// 射界检查（使用权威 angleDifference）
	const angleDiff = angleDifference(weaponFacing, angleToTarget);
	if (angleDiff > arcHalf) {
		return {
			shipId: target.id,
			canAttack: false,
			reason: `不在射界内: 偏差 ${Math.round(angleDiff)}° > ${Math.round(arcHalf)}°`,
			inRange: true,
			inArc: false,
			distance: dist,
		};
	}

	// 可攻击（允许向任何人开火，包括友军误伤）
	const isFriendly = target.faction === attacker.faction;

	return {
		shipId: target.id,
		canAttack: true,
		inRange: true,
		inArc: true,
		distance: dist,
		estimatedDamage: weapon.damage,
		isFriendly,
	};
}

/**
 * 检查武器是否可以开火
 */
export function checkWeaponCanFire(
	ship: ShipState,
	weapon: WeaponSlot
): { canFire: boolean; reason?: string } {
	// 舰船过载
	if (ship.isOverloaded) {
		return { canFire: false, reason: "舰船过载" };
	}

	// 武器冷却
	if (weapon.cooldownRemaining > 0) {
		return { canFire: false, reason: `冷却中 (${Math.round(weapon.cooldownRemaining)}s)` };
	}

	// 武器状态不是就绪
	if (weapon.state !== "READY") {
		return { canFire: false, reason: "武器未就绪" };
	}

	// 弹药耗尽
	if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
		return { canFire: false, reason: "弹药耗尽" };
	}

	// 本回合已射击
	if (weapon.hasFiredThisTurn) {
		return { canFire: false, reason: "本回合已射击" };
	}

	return { canFire: true };
}

export const useFireModeStore = create<FireModeStoreState & FireModeStoreActions>((set, get) => ({
	...initialState,

	setSelectedWeapon: (ship, weapon, allShips) => {
		const attackableTargets: TargetAttackability[] = [];

		// 遍历所有舰船，计算可攻击性（包括友军，允许误伤）
		allShips.forEach((targetShip) => {
			if (targetShip.id === ship.id) return; // 跳过自身（不能攻击自己）

			const attackability = calculateTargetAttackability(ship, weapon, targetShip);
			attackableTargets.push(attackability);
		});

		// 按距离排序（友军目标会有 isFriendly 标记）
		attackableTargets.sort((a, b) => a.distance - b.distance);

		set({
			selectedWeapon: weapon,
			attackerShip: ship,
			attackableTargets,
			selectedTargetIds: [],
			fireError: null,
		});
	},

	clearSelectedWeapon: () => {
		set({
			selectedWeapon: null,
			attackerShip: null,
			attackableTargets: [],
			selectedTargetIds: [],
			fireError: null,
		});
	},

	setSelectedTargets: (targetIds) => set({ selectedTargetIds: targetIds }),

	startFiring: () => set({ isFiring: true }),

	endFiring: (error) => {
		if (error) {
			set({ isFiring: false, fireError: error });
		} else {
			// 成功开火，清除状态
			set({
				selectedWeapon: null,
				attackerShip: null,
				attackableTargets: [],
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
