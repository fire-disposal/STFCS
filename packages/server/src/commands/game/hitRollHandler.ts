/**
 * 命中判定模块
 *
 * 参考 GDD 第 5.3 节命中判定流程：
 * 1. 基础命中判定（确定性射界验证）
 * 2. 预留骰子机制（未来扩展）
 * 3. 预留 DM 手动控制机制（未来扩展）
 *
 * 当前实现：确定性命中（100% 命中率）
 * 未来扩展：
 * - 骰子模式：根据距离/武器类型/目标机动性计算命中概率
 * - DM 模式：DM 手动决定命中结果
 */

import type { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";

/** 命中判定模式 */
export enum HitRollMode {
	/** 确定性模式：射界内必然命中（当前默认） */
	DETERMINISTIC = "DETERMINISTIC",
	/** 骰子模式：概率命中（未来扩展） */
	DICE = "DICE",
	/** DM 手动模式：DM 决定命中结果（未来扩展） */
	DM_MANUAL = "DM_MANUAL",
}

/** 命中判定结果 */
export interface HitRollResult {
	/** 是否命中 */
	hit: boolean;
	/** 命中判定模式 */
	mode: HitRollMode;
	/** 命中概率（骰子模式时有效） */
	hitProbability?: number;
	/** 骰子结果（骰子模式时有效） */
	diceRoll?: number;
	/** 命中偏移（未命中时的偏差角度，用于显示弹道偏离） */
	deviationAngle?: number;
	/** 原因说明 */
	reason: string;
}

/** 命中判定配置（预留用于 DM 设置） */
export interface HitRollConfig {
	/** 命中判定模式 */
	mode: HitRollMode;
	/** 强制命中结果（DM 手动模式） */
	forcedResult?: boolean;
	/** 额外命中修正（骰子模式） */
	hitModifier?: number;
}

/**
 * 执行命中判定
 *
 * @param attacker 攻击舰船
 * @param weapon 武器槽位
 * @param target 目标舰船
 * @param config 命中判定配置
 * @returns 命中判定结果
 */
export function performHitRoll(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState,
	config: HitRollConfig = { mode: HitRollMode.DETERMINISTIC }
): HitRollResult {
	// === DM 手动模式 ===
	if (config.mode === HitRollMode.DM_MANUAL && config.forcedResult !== undefined) {
		return {
			hit: config.forcedResult,
			mode: HitRollMode.DM_MANUAL,
			reason: config.forcedResult ? "DM 确认命中" : "DM 确认未命中",
		};
	}

	// === 骰子模式（预留） ===
	if (config.mode === HitRollMode.DICE) {
		// 计算基础命中概率
		const baseProbability = calculateBaseHitProbability(attacker, weapon, target);

		// 应用修正
		const modifiedProbability = Math.min(1, Math.max(0, baseProbability + (config.hitModifier || 0)));

		// 骰子判定（未来实现真正的随机骰子）
		// 当前简化：直接返回 100% 命中
		const diceRoll = 1.0; // Math.random() 未来使用

		const hit = diceRoll <= modifiedProbability;

		return {
			hit,
			mode: HitRollMode.DICE,
			hitProbability: modifiedProbability,
			diceRoll,
			reason: hit
				? `命中判定成功 (${Math.round(diceRoll * 100)} <= ${Math.round(modifiedProbability * 100)}%)`
				: `命中判定失败 (${Math.round(diceRoll * 100)} > ${Math.round(modifiedProbability * 100)}%)`,
		};
	}

	// === 确定性模式（当前默认） ===
	// 射界内必然命中
	return {
		hit: true,
		mode: HitRollMode.DETERMINISTIC,
		reason: "确定性命中：目标在射界内",
	};
}

/**
 * 计算基础命中概率（骰子模式）
 *
 * 未来扩展考虑因素：
 * - 距离：远距离降低命中概率
 * - 武器类型：导弹可能需要躲避判定
 * - 目标机动性：高机动舰船更难命中
 * - 目标护盾状态：护盾可能影响弹道
 *
 * @param attacker 攻击舰船
 * @param weapon 武器槽位
 * @param target 目标舰船
 * @returns 基础命中概率 (0-1)
 */
export function calculateBaseHitProbability(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState
): number {
	// 当前简化版本：100% 命中
	// 未来实现：
	// const distanceFactor = calculateDistanceFactor(attacker, weapon, target);
	// const maneuverFactor = calculateManeuverFactor(target);
	// const weaponTypeFactor = getWeaponTypeHitFactor(weapon);
	// return baseHit * distanceFactor * maneuverFactor * weaponTypeFactor;

	return 1.0;
}

/**
 * 计算距离命中修正
 *
 * @param distance 距离
 * @param range 武器射程
 * @returns 距离修正系数 (0-1)
 */
export function calculateDistanceFactor(distance: number, range: number): number {
	// 射程内 50% 距离：满命中
	// 射程边缘：命中下降
	if (distance <= range * 0.5) {
		return 1.0;
	}

	// 50% - 100% 射程：线性下降到 0.8
	const ratio = (distance - range * 0.5) / (range * 0.5);
	return Math.max(0.8, 1.0 - ratio * 0.2);
}

/**
 * 计算目标机动性修正
 *
 * @param target 目标舰船
 * @returns 机动修正系数 (0-1)
 */
export function calculateManeuverFactor(target: ShipState): number {
	// 当前简化：不考虑机动性
	// 未来：根据 maxTurnRate 和 maxSpeed 计算
	return 1.0;
}

/**
 * 获取武器类型命中修正
 *
 * @param weapon 武器槽位
 * @returns 武器类型命中系数 (0-1)
 */
export function getWeaponTypeHitFactor(weapon: WeaponSlot): number {
	// 当前简化：不考虑武器类型差异
	// 未来实现：
	// - BALLISTIC: 1.0 (直射，命中稳定)
	// - ENERGY: 1.1 (光束武器，几乎无法躲避)
	// - MISSILE: 0.9 (可躲避，但追踪能力强)
	return 1.0;
}

/**
 * 计算命中偏移角度（未命中时的弹道偏离）
 *
 * @param weapon 武器槽位
 * @param target 目标舰船
 * @returns 偏移角度（度）
 */
export function calculateHitDeviation(weapon: WeaponSlot, target: ShipState): number {
	// 当前简化：固定偏移
	// 未来：根据武器精度、距离、目标大小计算
	return 5 + Math.random() * 10; // 5-15度偏移
}