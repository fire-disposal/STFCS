/**
 * 目标可攻击性查询处理器
 *
 * 服务端权威计算可攻击目标列表，直接写入 Schema 同步
 * 客户端通过 Colyseus Schema 订阅获取数据（无需 CustomEvent）
 */

import type { Client } from "@colyseus/core";
import { WeaponState } from "@vt/data";
import { angleBetween, angleDifference, distance, getMountWorldPosition } from "@vt/rules";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";
import {
	TargetAttackabilitySchema,
	WeaponTargetsSchema,
	ShipFireControlSchema,
} from "../../schema/FireControlSchema.js";
import { normalizeHeading } from "./utils.js";

/**
 * 检查武器是否可以开火
 */
function checkWeaponCanFire(ship: ShipState, weapon: WeaponSlot): { canFire: boolean; reason: string } {
	if (ship.isOverloaded) {
		return { canFire: false, reason: "舰船过载" };
	}

	if (weapon.cooldownRemaining > 0) {
		return { canFire: false, reason: `冷却中 (${Math.round(weapon.cooldownRemaining)}s)` };
	}

	if (weapon.state !== WeaponState.READY) {
		return { canFire: false, reason: "武器未就绪" };
	}

	if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) {
		return { canFire: false, reason: "弹药耗尽" };
	}

	if (weapon.hasFiredThisTurn) {
		return { canFire: false, reason: "本回合已射击" };
	}

	return { canFire: true, reason: "" };
}

/**
 * 计算单个目标可攻击性
 */
function calculateTargetAttackability(
	attacker: ShipState,
	weapon: WeaponSlot,
	target: ShipState
): TargetAttackabilitySchema {
	const result = new TargetAttackabilitySchema();
	result.shipId = target.id;

	// 已摧毁目标不可攻击
	if (target.isDestroyed || target.hull.current <= 0) {
		result.canAttack = false;
		result.reason = "目标已摧毁";
		result.inRange = false;
		result.inArc = false;
		result.distance = 0;
		return result;
	}

	// 计算武器挂载点的世界坐标（使用权威函数）
	const mountPos = getMountWorldPosition(
		attacker.transform.x,
		attacker.transform.y,
		attacker.transform.heading,
		weapon.mountOffsetX ?? 0,
		weapon.mountOffsetY ?? 0
	);

	// 使用权威函数计算距离和角度
	const dist = distance(mountPos.x, mountPos.y, target.transform.x, target.transform.y);
	const angleToTarget = angleBetween(mountPos.x, mountPos.y, target.transform.x, target.transform.y);

	// 武器实际朝向（规范化到 0-360）
	const weaponFacing = normalizeHeading(attacker.transform.heading + (weapon.mountFacing ?? 0));
	// 使用 getEffectiveArc() 获取有效射界
	const effectiveArc = weapon.getEffectiveArc();
	const arcHalf = Math.max(0, effectiveArc) / 2;

	// 应用射程比率
	const rangeRatio = attacker.rangeRatio ?? 1.0;
	const maxRange = (weapon.range ?? 300) * rangeRatio;
	const minRange = (weapon.minRange ?? 0) * rangeRatio;

	result.distance = dist;

	// 射程检查
	if (dist > maxRange) {
		result.canAttack = false;
		result.reason = `超出射程: ${Math.round(dist)} > ${Math.round(maxRange)}`;
		result.inRange = false;
		result.inArc = true;
		return result;
	}

	if (minRange > 0 && dist < minRange) {
		result.canAttack = false;
		result.reason = `距离过近: ${Math.round(dist)} < ${Math.round(minRange)}`;
		result.inRange = false;
		result.inArc = true;
		return result;
	}

	// 射界检查
	const angleDiff = angleDifference(weaponFacing, angleToTarget);
	if (angleDiff > arcHalf) {
		result.canAttack = false;
		result.reason = `不在射界内: 偏差 ${Math.round(angleDiff)}° > ${Math.round(arcHalf)}°`;
		result.inRange = true;
		result.inArc = false;
		return result;
	}

	// 可攻击（允许向任何人开火，包括友军误伤）
	result.canAttack = true;
	result.inRange = true;
	result.inArc = true;
	result.estimatedDamage = weapon.damage;
	result.isFriendly = target.faction === attacker.faction;

	return result;
}

/**
 * 执行批量查询并将结果写入 Schema
 *
 * 服务端权威计算，通过 Schema 直接同步到客户端
 */
export function handleQueryAllAttackableTargets(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string }
): void {
	if (!payload.shipId) return; // Silent return for invalid payload on query

	const ship = state.ships.get(payload.shipId);
	if (!ship) return; // Silent return for non-existent ship

	const player = state.players.get(client.sessionId);
	if (!player) return; // 静默忽略，避免重连期间查询导致刷屏
	if (player.role !== "DM" && ship.ownerId !== client.sessionId) {
		return; // 静默忽略权限不足的查询
	}

	// 创建或更新 ShipFireControlSchema
	let shipFireControl = state.fireControlCache.ships.get(payload.shipId);
	if (!shipFireControl) {
		shipFireControl = new ShipFireControlSchema();
		shipFireControl.shipId = payload.shipId;
		state.fireControlCache.ships.set(payload.shipId, shipFireControl);
	}

	shipFireControl.lastUpdateTime = Date.now();

	// 遍历所有武器，计算可攻击目标
	ship.weapons.forEach((weapon) => {
		const weaponTargets = new WeaponTargetsSchema();
		weaponTargets.weaponMountId = weapon.mountId;

		const weaponCheck = checkWeaponCanFire(ship, weapon);
		weaponTargets.weaponCanFire = weaponCheck.canFire;
		weaponTargets.weaponFireReason = weaponCheck.reason;

		// 计算所有目标的可攻击性
		state.ships.forEach((targetShip) => {
			if (targetShip.id === ship.id) return;

			const targetData = calculateTargetAttackability(ship, weapon, targetShip);
			weaponTargets.targets.push(targetData);
		});

		// 按距离排序
		weaponTargets.targets.sort((a, b) => a.distance - b.distance);

		// 写入 Schema
		shipFireControl.weapons.set(weapon.mountId, weaponTargets);
	});

	// Schema 变化会自动触发客户端更新，无需发送消息
}