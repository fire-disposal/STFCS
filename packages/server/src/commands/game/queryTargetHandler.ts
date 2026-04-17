/**
 * 目标可攻击性查询处理器 (合集)
 *
 * 服务端权威计算可攻击目标列表，减少客户端计算负担。
 * 返回每个目标的可攻击性状态（射程、射界、武器状态检查）。
 */

import type { Client } from "@colyseus/core";
import { WeaponState } from "@vt/data";
import { angleBetween, angleDifference, distance, getMountWorldPosition } from "@vt/rules";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { ShipState, WeaponSlot } from "../../schema/ShipStateSchema.js";
import { normalizeHeading } from "./utils.js";

/** 目标可攻击性结果（返回给客户端） */
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

/** 查询结果 DTO */
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
	weapons: Map<string, AttackableTargetsResult>; // weaponInstanceId -> result
}

/**
 * 检查武器是否可以开火
 */
function checkWeaponCanFire(ship: ShipState, weapon: WeaponSlot): { canFire: boolean; reason?: string } {
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

	return { canFire: true };
}

/**
 * 计算单个目标可攻击性
 */
function calculateTargetAttackability(
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
	// 使用 getEffectiveArc() 获取有效射界（TURRET 用 arc，HARDPOINT 用 hardpointArc）
	const effectiveArc = weapon.getEffectiveArc();
	const arcHalf = Math.max(0, effectiveArc) / 2;

	// 应用射程比率：真实射程 = 武器面板射程 × 舰船射程比率
	const rangeRatio = attacker.rangeRatio ?? 1.0;
	const maxRange = (weapon.range ?? 300) * rangeRatio;
	const minRange = (weapon.minRange ?? 0) * rangeRatio;

	// 射程检查
	if (dist > maxRange) {
		return {
			shipId: target.id,
			canAttack: false,
			reason: `超出射程: ${Math.round(dist)} > ${Math.round(maxRange)}`,
			inRange: false,
			inArc: true,
			distance: dist,
		};
	}

	if (minRange > 0 && dist < minRange) {
		return {
			shipId: target.id,
			canAttack: false,
			reason: `距离过近: ${Math.round(dist)} < ${Math.round(minRange)}`,
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
 * 查询单武器的可攻击目标列表
 */
export function handleQueryAttackableTargets(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string; weaponInstanceId: string }
): AttackableTargetsResult {
	if (!payload.shipId || !payload.weaponInstanceId) {
		throw new Error("请求格式错误: 需要 shipId 和 weaponInstanceId");
	}

	const attacker = state.ships.get(payload.shipId);
	if (!attacker) throw new Error("舰船不存在");

	const player = state.players.get(client.sessionId);
	if (!player) throw new Error("玩家未注册");
	if (player.role !== "DM" && attacker.ownerId !== client.sessionId) {
		throw new Error("没有权限查询此舰船");
	}

	const weapon = attacker.weapons.get(payload.weaponInstanceId);
	if (!weapon) throw new Error("武器不存在");

	const weaponCheck = checkWeaponCanFire(attacker, weapon);
	const targets: TargetAttackability[] = [];

	state.ships.forEach((targetShip) => {
		if (targetShip.id === attacker.id) return;
		targets.push(calculateTargetAttackability(attacker, weapon, targetShip));
	});

	targets.sort((a, b) => a.distance - b.distance);

	return {
		attackerShipId: attacker.id,
		weaponInstanceId: weapon.instanceId,
		targets,
		weaponCanFire: weaponCheck.canFire,
		weaponFireReason: weaponCheck.reason,
	};
}

/**
 * 批量查询舰船所有武器的可攻击目标
 */
export function handleQueryAllAttackableTargets(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string }
): AllAttackableTargetsResult {
	if (!payload.shipId) throw new Error("请求格式错误: 需要 shipId");

	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error("舰船不存在");

	const player = state.players.get(client.sessionId);
	if (!player) throw new Error("玩家未注册");
	if (player.role !== "DM" && ship.ownerId !== client.sessionId) {
		throw new Error("没有权限查询此舰船");
	}

	const weapons = new Map<string, AttackableTargetsResult>();

	ship.weapons.forEach((weapon) => {
		weapons.set(
			weapon.instanceId,
			handleQueryAttackableTargets(state, client, {
				shipId: ship.id,
				weaponInstanceId: weapon.instanceId,
			})
		);
	});

	return {
		shipId: ship.id,
		weapons,
	};
}
