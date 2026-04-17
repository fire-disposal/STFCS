/**
 * 武器开火命令处理器
 *
 * 参考 GDD 第 5.3 节伤害结算流程：
 * 1. 命中判定（确定性射界验证 / 骰子模式 / DM 手动）
 * 2. 护盾阶段（硬辐能积累）
 * 3. 护甲阶段（六象限伤害计算）
 * 4. 船体阶段（护甲穿透后伤害）
 */

import type { Client } from "@colyseus/core";
import { DAMAGE_MODIFIERS, GAME_CONFIG, WeaponState } from "@vt/data";
import type { DamageTypeValue } from "@vt/data";
import { angleBetween, angleDifference } from "@vt/rules";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";
import { validateAuthority, assertTargetInWeaponArc } from "./utils.js";
import { applyDamage } from "./damageCalculator.js";
import { performHitRoll, HitRollMode, type HitRollConfig, type HitRollResult } from "./hitRollHandler.js";

/** 开火命令结果 */
export interface FireResult {
	success: boolean;
	shotsFired: number;           // 实际射击次数（连发）
	hits: number;                 // 命中次数
	damageApplied: number;        // 应用伤害总量
	empApplied: number;           // EMP 伤害
	fluxGenerated: number;        // 产生的辐能
	targetOverloaded: boolean;    // 目标是否过载
	targetDestroyed: boolean;     // 目标是否摧毁
	hitRollResults: HitRollResult[]; // 命中判定结果（每发）
}

/**
 * 处理武器开火命令
 *
 * 流程规范：
 * 1. 静态验证 (Check): 权限、范围、辐能、弹药
 * 2. 扣除消耗 (Consume): 扣除弹药、增加武器发热/CD、增加舰船辐能
 * 3. 结果判定 (Resolve): 命中判定、伤害计算、状态应用
 */
export function handleFireWeapon(
	state: GameRoomState,
	client: Client,
	payload: { attackerId: string; weaponId: string; targetId: string },
	hitRollConfig?: HitRollConfig
): FireResult {
	// === 1. 环境与对象验证 ===
	const attacker = state.ships.get(payload.attackerId);
	const target = state.ships.get(payload.targetId);
	if (!attacker) throw new Error("攻击舰船不存在");
	if (!target) throw new Error("目标舰船不存在");

	validateAuthority(state, client, attacker);
	
	if (target.isDestroyed) throw new Error("目标已被摧毁");
	if (attacker.isOverloaded) throw new Error("舰船过载，无法开火");

	const weapon = attacker.weapons.get(payload.weaponId);
	if (!weapon) throw new Error("武器不存在");
	if (weapon.state !== WeaponState.READY) throw new Error(`武器状态异常: ${weapon.state}`);
	if (weapon.hasFiredThisTurn) throw new Error("本回合已射击");

	// === 2. 射界与射程验证 ===
	const { distanceToMuzzle: dist } = assertTargetInWeaponArc(attacker, weapon, target);
	const effectiveRange = weapon.range * attacker.rangeRatio;
	const effectiveMinRange = weapon.minRange * attacker.rangeRatio;

	if (dist > effectiveRange) throw new Error(`超出射程: ${dist.toFixed(0)} > ${effectiveRange.toFixed(0)}`);
	if (effectiveMinRange > 0 && dist < effectiveMinRange) throw new Error(`距离过近: ${dist.toFixed(0)} < ${effectiveMinRange.toFixed(0)}`);

	// === 3. 资源预检 ===
	const shotsToFire = weapon.burstSize || 1;
	const actualShots = weapon.maxAmmo > 0 ? Math.min(shotsToFire, weapon.currentAmmo) : shotsToFire;
	if (actualShots <= 0) throw new Error("弹药耗尽");

	const totalFluxCost = weapon.fluxCost * actualShots;
	if (totalFluxCost > 0 && attacker.flux.total + totalFluxCost > attacker.flux.max) {
		throw new Error(`辐能不足: 需要 ${totalFluxCost.toFixed(0)}，即将导致过载`);
	}

	// === 4. 执行扣除 (Consume) ===
	// 标记舰船活动状态
	attacker.hasFired = true;
	
	// 更新武器状态与消耗
	weapon.fire(); // 内部处理弹药扣除和 hasFiredCheck
	attacker.flux.addSoft(totalFluxCost);
	
	// 更新 CD 状态
	weapon.cooldownRemaining = weapon.cooldownMax || GAME_CONFIG.DEFAULT_COOLDOWN;
	weapon.state = WeaponState.COOLDOWN;
	if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
		weapon.state = WeaponState.OUT_OF_AMMO;
	}

	// === 5. 战斗结果判定 (Resolve) ===
	return resolveCombatEffects(attacker, weapon, target, actualShots, hitRollConfig);
}

/**
 * 内部辅助：处理伤害与命中的循环判定
 * 分离出此函数是为了以后支持多目标的散弹或 AOE 逻辑
 */
function resolveCombatEffects(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState,
	actualShots: number,
	hitRollConfig?: HitRollConfig
): FireResult {
	let totalDamage = 0;
	let totalEmp = 0;
	let hitCount = 0;
	let targetOverloaded = false;
	const hitRollResults: HitRollResult[] = [];

	for (let i = 0; i < actualShots; i++) {
		// 命中判定（逻辑层）
		const hitResult = performHitRoll(
			attacker, 
			weapon, 
			target, 
			hitRollConfig || { mode: HitRollMode.DETERMINISTIC }
		);
		hitRollResults.push(hitResult);

		if (hitResult.hit) {
			hitCount++;
			// 伤害计算与应用（状态层）
			const damageResult = applyDamage(attacker, weapon, target);
			totalDamage += damageResult.damageApplied;
			totalEmp += damageResult.empApplied;

			if (damageResult.targetOverloaded) targetOverloaded = true;
			if (target.isDestroyed) break; // 摧毁则停止连发
		}
	}

	return {
		success: true,
		shotsFired: actualShots,
		hits: hitCount,
		damageApplied: totalDamage,
		empApplied: totalEmp,
		fluxGenerated: weapon.fluxCost * actualShots,
		targetOverloaded,
		targetDestroyed: target.isDestroyed,
		hitRollResults,
	};
}

/**
 * 处理连发射击（后续射击）
 *
 * 用于连发武器在一次开火命令后的后续射击处理
 * 仅在武器处于连发状态时调用
 */
export function handleBurstFire(
	state: GameRoomState,
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState
): { shotsRemaining: number; damageApplied: number } {
	if (weapon.burstRemaining <= 0) {
		return { shotsRemaining: 0, damageApplied: 0 };
	}

	if (target.isDestroyed) {
		weapon.resetBurst();
		return { shotsRemaining: weapon.burstRemaining, damageApplied: 0 };
	}

	// 检查弹药
	if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
		weapon.resetBurst();
		return { shotsRemaining: 0, damageApplied: 0 };
	}

	// 执行连发
	const success = weapon.fireBurst();
	if (!success) {
		return { shotsRemaining: weapon.burstRemaining, damageApplied: 0 };
	}

	// 应用伤害
	const damageResult = applyDamage(attacker, weapon, target);

	return {
		shotsRemaining: weapon.burstRemaining,
		damageApplied: damageResult.damageApplied,
	};
}