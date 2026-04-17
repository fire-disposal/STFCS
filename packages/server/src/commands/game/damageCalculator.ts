/**
 * 伤害计算模块
 *
 * 参考 GDD 第 5.3 节伤害结算流程：
 *
 * 1. 护盾阶段：
 *    - 判断命中位置是否在护盾覆盖范围
 *    - 伤害 × 伤害类型倍率 × Shield_Efficiency → 硬辐能
 *    - 过载检查
 *
 * 2. 护甲阶段：
 *    - 六象限护甲判定（相对角度 / 60）
 *    - 穿甲强度 = 伤害 × 穿甲系数
 *    - 有效伤害 = 伤害 × (穿甲强度 / (穿甲强度 + 护甲值))
 *    - 减伤上限检查（不低于 伤害 × 最小伤害比例）
 *
 * 3. 船体阶段：
 *    - 护甲穿透后剩余伤害 × 船体倍率
 *    - 摧毁判定（Hull ≤ 0）
 *
 * 4. EMP 伤害：
 *    - 独立计算，不受护盾/护甲影响
 *    - 可导致系统干扰（未实现）
 */

import { DAMAGE_MODIFIERS, GAME_CONFIG } from "@vt/data";
import type { DamageTypeValue } from "@vt/data";
import { angleBetween, angleDifference } from "@vt/rules";
import type { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";

/** 伤害计算结果 */
export interface DamageResult {
	damageApplied: number;        // 实际伤害总量
	empApplied: number;           // EMP 伤害
	fluxGenerated: number;        // 目标产生的硬辐能
	shieldHit: boolean;           // 是否命中护盾
	armorHit: boolean;            // 是否命中护甲
	armorQuadrant: number;        // 受击象限（0-5）
	armorDamage: number;          // 护甲损伤
	hullDamage: number;           // 船体损伤
	targetOverloaded: boolean;    // 目标是否过载
	targetDestroyed: boolean;     // 目标是否摧毁
}

/**
 * 计算命中护甲象限
 *
 * 六象限系统（六边形护甲）：
 *
 * 象限定义（相对于船头朝向的角度范围）：
 * - 象限 0 (FRONT_TOP):    330°-30°  (船头正前方)
 * - 象限 1 (FRONT_BOTTOM): 270°-330° (船头下方/后下方)
 * - 象限 2 (LEFT_TOP):     210°-270° (左侧前方)
 * - 象限 3 (LEFT_BOTTOM):  150°-210° (左侧后方)
 * - 象限 4 (RIGHT_TOP):    30°-90°   (右侧前方)
 * - 象限 5 (RIGHT_BOTTOM): 90°-150°  (右侧后方)
 *
 * 注意：角度范围以船头为0°，顺时针方向增加
 *
 * @param target 目标舰船
 * @param attacker 攻击舰船
 * @returns 象限索引（0-5）
 */
export function calculateArmorQuadrant(target: ShipState, attacker: ShipState): number {
	// 计算命中角度（从目标视角看攻击者，世界坐标系）
	const hitAngle = angleBetween(
		target.transform.x,
		target.transform.y,
		attacker.transform.x,
		attacker.transform.y
	);

	// 计算相对于目标船头的角度（0° = 船头，顺时针）
	const relativeAngle = normalizeAngle(hitAngle - target.transform.heading);

	// 根据角度范围确定象限
	// 六边形护甲的象限边界
	if (relativeAngle >= 330 || relativeAngle < 30) {
		return 0; // FRONT_TOP (船头正前方)
	} else if (relativeAngle >= 30 && relativeAngle < 90) {
		return 4; // RIGHT_TOP (右侧前方)
	} else if (relativeAngle >= 90 && relativeAngle < 150) {
		return 5; // RIGHT_BOTTOM (右侧后方)
	} else if (relativeAngle >= 150 && relativeAngle < 210) {
		return 3; // LEFT_BOTTOM (左侧后方)
	} else if (relativeAngle >= 210 && relativeAngle < 270) {
		return 2; // LEFT_TOP (左侧前方)
	} else {
		return 1; // FRONT_BOTTOM (270°-330°, 船头下方)
	}
}

/**
 * 判断命中位置是否在护盾覆盖范围内
 *
 * 护盾朝向说明：
 * - shield.orientation 是相对于船体的角度（船头为0°）
 * - 需要加上舰船 heading 得到世界坐标系中的绝对朝向
 * - 前盾(FRONT)：orientation 固定为 0°（船头方向）
 * - 全盾(OMNI)：orientation 可调整（相对于船体）
 *
 * @param target 目标舰船
 * @param hitAngle 命中角度（绝对角度，世界坐标系）
 * @returns 是否在护盾范围内
 */
export function isHitInShieldArc(target: ShipState, hitAngle: number): boolean {
	if (!target.shield.active) return false;

	// 护盾绝对朝向 = 舰船 heading + 护盾相对于船体的 orientation
	const shieldAbsoluteOrientation = normalizeAngle(
		target.transform.heading + target.shield.orientation
	);

	// 计算命中位置与护盾中心的偏差
	const shieldDiff = angleDifference(shieldAbsoluteOrientation, hitAngle);

	// 护盾覆盖范围（±arc/2）
	const arcHalf = target.shield.arc / 2;

	return shieldDiff <= arcHalf;
}

/**
 * 规范化角度到 0-360 范围
 */
function normalizeAngle(angle: number): number {
	let normalized = angle % 360;
	if (normalized < 0) normalized += 360;
	return normalized;
}

/**
 * 计算护甲有效伤害
 *
 * 穿甲公式（GDD 第 5.3 节）：
 * - 穿甲强度 Z = 伤害 × 穿甲系数（伤害类型决定）
 * - 有效护甲 C = max(当前护甲B, 最大护甲A × 最小护甲减伤比)
 * - 有效伤害 D = 伤害 × (Z / (Z + C))
 * - 减伤上限检查：若 (伤害-D)/伤害 > 最大护甲减伤比，则 D = 伤害×(1-最大护甲减伤比)
 *
 * @param baseDamage 基础伤害
 * @param damageType 伤害类型
 * @param armorValue 当前护甲值
 * @param armorMax 最大护甲值
 * @param maxReductionRatio 最大护甲减伤比（舰船属性，默认0.85）
 * @param minReductionRatio 最小护甲减伤比（舰船属性，默认0.1）
 * @returns 有效伤害和护甲损伤
 */
export function calculateArmorDamage(
	baseDamage: number,
	damageType: DamageTypeValue,
	armorValue: number,
	armorMax: number,
	maxReductionRatio: number = 0.85,
	minReductionRatio: number = 0.1
): { effectiveDamage: number; armorDamage: number } {
	const mult = DAMAGE_MODIFIERS[damageType];

	// 穿甲强度 Z = 伤害 × 穿甲系数
	const armorPenetration = baseDamage * mult.armor;

	// 有效护甲 C = max(当前护甲, 最大护甲 × 最小护甲减伤比)
	// 防止护甲为零时完全免疫伤害
	const effectiveArmor = Math.max(armorValue, armorMax * minReductionRatio);

	// 有效伤害 D = 伤害 × (Z / (Z + C))
	let effectiveDamage = baseDamage * (armorPenetration / (armorPenetration + effectiveArmor));

	// 减伤上限检查：
	// 若 (伤害 - D) / 伤害 > 最大护甲减伤比，即护甲吸收比例超过上限
	// 则 D = 伤害 × (1 - 最大护甲减伤比)
	const absorbedRatio = (baseDamage - effectiveDamage) / baseDamage;
	if (absorbedRatio > maxReductionRatio) {
		effectiveDamage = baseDamage * (1 - maxReductionRatio);
	}

	// 护甲损伤 = min(当前护甲值, 有效伤害)
	// 护甲承受的伤害不超过其当前值
	const armorDamage = Math.min(armorValue, effectiveDamage);

	return { effectiveDamage, armorDamage };
}

/**
 * 应用伤害到目标舰船
 *
 * @param attacker 攻击舰船
 * @param weapon 武器槽位
 * @param target 目标舰船
 * @returns 伤害计算结果
 */
export function applyDamage(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState
): DamageResult {
	const result: DamageResult = {
		damageApplied: 0,
		empApplied: 0,
		fluxGenerated: 0,
		shieldHit: false,
		armorHit: false,
		armorQuadrant: -1,
		armorDamage: 0,
		hullDamage: 0,
		targetOverloaded: false,
		targetDestroyed: false,
	};

	// 基础伤害
	const baseDamage = weapon.damage;
	const damageType = weapon.damageType as DamageTypeValue;

	// === 1. 计算命中角度和象限 ===
	const hitAngle = angleBetween(
		target.transform.x,
		target.transform.y,
		attacker.transform.x,
		attacker.transform.y
	);
	result.armorQuadrant = calculateArmorQuadrant(target, attacker);

	// === 2. EMP 伤害处理（独立计算） ===
	if (weapon.empDamage > 0) {
		result.empApplied = weapon.empDamage;
		// EMP 伤害暂时仅记录，不产生实际效果（系统干扰未实现）
		// 未来可添加：降低目标机动性、武器失效等
	}

	// === 3. 护盾阶段 ===
	if (target.shield.active && !weapon.ignoresShields) {
		if (isHitInShieldArc(target, hitAngle)) {
			result.shieldHit = true;

			// 计算护盾吸收伤害
			const shieldMult = DAMAGE_MODIFIERS[damageType].shield;
			const shieldDamage = baseDamage * shieldMult;

			// 产生硬辐能：使用舰船的护盾效率属性
			// 公式：硬辐能 = 护盾吸收伤害 × 护盾效率
			const fluxGenerated = shieldDamage * target.shield.efficiency;
			target.flux.addHard(fluxGenerated);
			result.fluxGenerated = fluxGenerated;

			// 过载检查
			if (target.flux.isOverloaded && !target.isOverloaded) {
				target.isOverloaded = true;
				target.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
				target.shield.deactivate();
				result.targetOverloaded = true;
			}

			// 护盾完全吸收，不继续计算护甲/船体
			return result;
		}
	}

	// === 4. 护甲阶段 ===
	result.armorHit = true;

	const quadrant = result.armorQuadrant;
	const armorValue = target.armor.getQuadrant(quadrant);
	const armorMax = target.armor.maxPerQuadrant;

	// 使用舰船的护甲减伤比属性
	const maxReductionRatio = target.armor.maxReductionRatio;
	const minReductionRatio = target.armor.minReductionRatio;

	// 计算护甲有效伤害
	const armorResult = calculateArmorDamage(
		baseDamage,
		damageType,
		armorValue,
		armorMax,
		maxReductionRatio,
		minReductionRatio
	);

	// 应用护甲损伤
	target.armor.takeDamage(quadrant, armorResult.armorDamage);
	result.armorDamage = armorResult.armorDamage;

	// === 5. 船体阶段 ===
	// 护甲穿透后剩余伤害
	const hullMult = DAMAGE_MODIFIERS[damageType].hull;
	let hullDamage = armorResult.effectiveDamage * hullMult;

	// 如果护甲完全吸收，船体损伤为 0（但实际上最小伤害机制已确保不会完全吸收）
	if (armorValue <= 0) {
		// 无护甲象限，直接船体伤害
		hullDamage = baseDamage * hullMult;
	}

	// 应用船体损伤
	target.hull.takeDamage(hullDamage);
	result.hullDamage = hullDamage;
	result.damageApplied = hullDamage;

	// === 6. 摧毁判定 ===
	if (target.hull.current <= 0) {
		target.isDestroyed = true;
		target.shield.deactivate();
		result.targetDestroyed = true;
	}

	return result;
}

/**
 * 预估伤害（用于 UI 显示）
 *
 * 不实际应用伤害，仅计算预估结果
 *
 * @param attacker 攻击舰船
 * @param weapon 武器槽位
 * @param target 目标舰船
 * @returns 预估伤害结果
 */
export function estimateDamage(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState
): {
	expectedDamage: number;
	expectedShieldDamage: number;
	expectedArmorDamage: number;
	expectedHullDamage: number;
	willHitShield: boolean;
	willOverload: boolean;
	armorQuadrant: number;         // 预计受击象限
	shieldOrientation: number;     // 护盾绝对朝向（用于UI显示）
} {
	const baseDamage = weapon.damage;
	const damageType = weapon.damageType as DamageTypeValue;
	const mult = DAMAGE_MODIFIERS[damageType];

	// 计算命中角度（从目标看攻击者）
	const hitAngle = angleBetween(
		target.transform.x,
		target.transform.y,
		attacker.transform.x,
		attacker.transform.y
	);

	// 计算护盾绝对朝向
	const shieldAbsoluteOrientation = normalizeAngle(
		target.transform.heading + target.shield.orientation
	);

	// 护盾判定
	const willHitShield = target.shield.active && !weapon.ignoresShields && isHitInShieldArc(target, hitAngle);

	// 计算受击象限（无论护盾是否命中，都需要显示）
	const armorQuadrant = calculateArmorQuadrant(target, attacker);

	if (willHitShield) {
		const shieldDamage = baseDamage * mult.shield;
		// 使用舰船的护盾效率属性
		const fluxGenerated = shieldDamage * target.shield.efficiency;
		const willOverload = target.flux.total + fluxGenerated >= target.flux.max;

		return {
			expectedDamage: 0,
			expectedShieldDamage: shieldDamage,
			expectedArmorDamage: 0,
			expectedHullDamage: 0,
			willHitShield: true,
			willOverload: willOverload,
			armorQuadrant,
			shieldOrientation: shieldAbsoluteOrientation,
		};
	}

	// 护甲判定
	const armorValue = target.armor.getQuadrant(armorQuadrant);
	const armorMax = target.armor.maxPerQuadrant;

	// 使用舰船的护甲减伤比属性
	const armorResult = calculateArmorDamage(
		baseDamage,
		damageType,
		armorValue,
		armorMax,
		target.armor.maxReductionRatio,
		target.armor.minReductionRatio
	);
	const hullDamage = armorResult.effectiveDamage * mult.hull;

	return {
		expectedDamage: hullDamage,
		expectedShieldDamage: 0,
		expectedArmorDamage: armorResult.armorDamage,
		expectedHullDamage: hullDamage,
		willHitShield: false,
		willOverload: false,
		armorQuadrant,
		shieldOrientation: shieldAbsoluteOrientation,
	};
}