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
 * 流程：
 * 1. 验证攻击者和目标（允许友军误伤）
 * 2. 验证武器状态
 * 3. 验证射界和射程
 * 4. 验证辐能容量
 * 5. 验证弹药
 * 6. 命中判定（预留骰子/DM控制）
 * 7. 应用伤害（仅命中时）
 * 8. 更新武器状态
 */
export function handleFireWeapon(
	state: GameRoomState,
	client: Client,
	payload: { attackerId: string; weaponId: string; targetId: string },
	hitRollConfig?: HitRollConfig
): FireResult {
	// === 1. 验证攻击者和目标 ===
	const attacker = state.ships.get(payload.attackerId);
	const target = state.ships.get(payload.targetId);
	if (!attacker) throw new Error("攻击舰船不存在");
	if (!target) throw new Error("目标舰船不存在");

	// 验证权限
	validateAuthority(state, client, attacker);

	// 目标状态检查（不区分友军/敌军，允许误伤）
	if (target.isDestroyed || target.hull.current <= 0) {
		throw new Error("目标已被摧毁");
	}

	// 过载舰船无法开火
	if (attacker.isOverloaded) {
		throw new Error("舰船过载，无法开火");
	}

	// === 2. 验证武器 ===
	const weapon = attacker.weapons.get(payload.weaponId);
	if (!weapon) throw new Error("武器不存在");

	// 武器状态检查
	if (weapon.state !== WeaponState.READY) {
		throw new Error(`武器状态异常: ${weapon.state}`);
	}

	// 本回合射击限制
	if (weapon.hasFiredThisTurn) {
		throw new Error("本回合已射击");
	}

	// === 3. 验证射界和射程 ===
	const { distanceToMuzzle: dist } = assertTargetInWeaponArc(attacker, weapon, target);
	
	// 射程检查
	if (dist > weapon.range) {
		throw new Error(`超出射程: ${dist.toFixed(0)} > ${weapon.range}`);
	}

	// 最小射程检查
	if (weapon.minRange > 0 && dist < weapon.minRange) {
		throw new Error(`距离过近: ${dist.toFixed(0)} < ${weapon.minRange}`);
	}

	// === 4. 验证辐能容量 ===
	const shotsToFire = weapon.burstSize || 1;
	const totalFluxCost = weapon.fluxCost * shotsToFire;

	if (totalFluxCost > 0 && attacker.flux.total + totalFluxCost > attacker.flux.max) {
		throw new Error(`辐能不足: 需要 ${totalFluxCost}, 当前 ${attacker.flux.max - attacker.flux.total} 可用`);
	}

	// === 5. 验证弹药 ===
	const actualShots = weapon.maxAmmo > 0
		? Math.min(shotsToFire, weapon.currentAmmo)
		: shotsToFire;

	if (actualShots <= 0) {
		throw new Error("弹药耗尽");
	}

	// === 6. 执行开火 ===
	const fireSuccess = weapon.fire();
	if (!fireSuccess) {
		throw new Error("武器开火失败");
	}

	// 标记舰船已开火
	attacker.hasFired = true;

	// === 7. 命中判定 + 应用伤害 ===
	let totalDamage = 0;
	let totalEmp = 0;
	let hitCount = 0;
	let targetOverloaded = false;
	const hitRollResults: HitRollResult[] = [];

	for (let i = 0; i < actualShots; i++) {
		// 连发武器：后续射击使用 fireBurst
		if (i > 0) {
			weapon.fireBurst();
		}

		// 命中判定
		const hitResult = performHitRoll(attacker, weapon, target, hitRollConfig || { mode: HitRollMode.DETERMINISTIC });
		hitRollResults.push(hitResult);

		if (!hitResult.hit) {
			// 未命中，跳过伤害计算
			continue;
		}

		hitCount++;

		// 应用伤害（仅命中时）
		const damageResult = applyDamage(attacker, weapon, target);
		totalDamage += damageResult.damageApplied;
		totalEmp += damageResult.empApplied;

		if (damageResult.targetOverloaded) {
			targetOverloaded = true;
		}

		// 目标摧毁后停止射击
		if (target.isDestroyed) {
			break;
		}
	}

	// === 8. 更新辐能 ===
	// 根据实际射击次数（而非命中次数）计算辐能消耗
	const fluxGenerated = weapon.fluxCost * actualShots;
	attacker.flux.addSoft(fluxGenerated);

	// === 9. 更新武器状态 ===
	weapon.cooldownRemaining = weapon.cooldownMax || GAME_CONFIG.DEFAULT_COOLDOWN;
	weapon.state = WeaponState.COOLDOWN;

	if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
		weapon.state = WeaponState.OUT_OF_AMMO;
		weapon.reloadProgress = 0;
	}

	// === 10. 返回结果 ===
	return {
		success: true,
		shotsFired: actualShots,
		hits: hitCount,
		damageApplied: totalDamage,
		empApplied: totalEmp,
		fluxGenerated: fluxGenerated,
		targetOverloaded: targetOverloaded,
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