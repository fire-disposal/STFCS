/**
 * 命令分发器
 */

import { Client } from "@colyseus/core";
import { DAMAGE_MODIFIERS, GAME_CONFIG } from "@vt/data";
import { angleBetween, angleDifference, distance, validateThreePhaseMove } from "@vt/rules";
import {
	PlayerRole,
	WeaponState,
} from "../schema/types.js";
import type { MoveTokenPayload } from "./types.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import { ShipState, WeaponSlot } from "../schema/ShipStateSchema.js";

export class CommandDispatcher {
	constructor(private state: GameRoomState) {}

	private static readonly MOVE_PHASE_ORDER: Record<"PHASE_A" | "PHASE_B" | "PHASE_C", number> = {
		PHASE_A: 0,
		PHASE_B: 1,
		PHASE_C: 2,
	};

	private validateAuthority(client: Client, ship: ShipState): void {
		const player = this.state.players.get(client.sessionId);
		if (!player) throw new Error("玩家未注册");
		if (player.role === PlayerRole.DM) return;
		if (this.state.currentPhase !== "PLAYER_TURN") throw new Error("当前不是玩家行动回合");
		if (ship.ownerId !== client.sessionId) throw new Error("没有权限操作此舰船");
		if (player.isReady) throw new Error("已结束本回合");
	}

	private normalizeHeading(value: number): number {
		return ((value % 360) + 360) % 360;
	}

	private getWeaponWorldPosition(ship: ShipState, weapon: WeaponSlot): { x: number; y: number } {
		const headingRad = (ship.transform.heading * Math.PI) / 180;
		const localX = weapon.mountOffsetX ?? 0;
		const localY = weapon.mountOffsetY ?? 0;
		const worldX = ship.transform.x + localX * Math.cos(headingRad) - localY * Math.sin(headingRad);
		const worldY = ship.transform.y + localX * Math.sin(headingRad) + localY * Math.cos(headingRad);
		return { x: worldX, y: worldY };
	}

	private assertTargetInWeaponArc(
		attacker: ShipState,
		weapon: WeaponSlot,
		target: ShipState
	): { distanceToMuzzle: number; angleToTarget: number } {
		const muzzle = this.getWeaponWorldPosition(attacker, weapon);
		const angleToTarget = angleBetween(muzzle.x, muzzle.y, target.transform.x, target.transform.y);
		const weaponFacing = this.normalizeHeading(attacker.transform.heading + weapon.mountFacing);
		const arcHalf = Math.max(0, weapon.arc) / 2;
		const diff = angleDifference(weaponFacing, angleToTarget);
		if (diff > arcHalf) {
			throw new Error(`目标不在武器射界内: 偏差 ${diff.toFixed(1)}° > ${arcHalf.toFixed(1)}°`);
		}

		const dist = distance(muzzle.x, muzzle.y, target.transform.x, target.transform.y);
		return { distanceToMuzzle: dist, angleToTarget };
	}

	private applyTranslation(
		x: number,
		y: number,
		heading: number,
		forward: number,
		strafe: number
	): { x: number; y: number } {
		const rad = (heading * Math.PI) / 180;
		const forwardX = Math.sin(rad);
		const forwardY = -Math.cos(rad);
		const rightX = Math.cos(rad);
		const rightY = Math.sin(rad);
		return {
			x: x + forwardX * forward + rightX * strafe,
			y: y + forwardY * forward + rightY * strafe,
		};
	}

	private assertPhaseOrder(current: "PHASE_A" | "PHASE_B" | "PHASE_C", next: "PHASE_A" | "PHASE_B" | "PHASE_C"): void {
		const cur = CommandDispatcher.MOVE_PHASE_ORDER[current];
		const nxt = CommandDispatcher.MOVE_PHASE_ORDER[next];
		if (nxt < cur) throw new Error("移动阶段顺序错误");
	}

	private getMovePhase(payloadPhase?: "PHASE_A" | "PHASE_B" | "PHASE_C", shipPhase?: "PHASE_A" | "PHASE_B" | "PHASE_C"): "PHASE_A" | "PHASE_B" | "PHASE_C" {
		return payloadPhase ?? shipPhase ?? "PHASE_A";
	}

	private updateMovementBudget(ship: ShipState, phase: "PHASE_A" | "PHASE_B" | "PHASE_C", forward: number, strafe: number, turn: number): void {
		const maxForward = ship.maxSpeed * 2;
		const maxStrafe = ship.maxSpeed;
		const maxTurn = ship.maxTurnRate;

		if (phase === "PHASE_A") {
			if (Math.abs(forward) + ship.phaseAForwardUsed > maxForward) {
				throw new Error("阶段A前进燃料不足");
			}
			if (Math.abs(strafe) + ship.phaseAStrafeUsed > maxStrafe) {
				throw new Error("阶段A横移燃料不足");
			}
			ship.phaseAForwardUsed += Math.abs(forward);
			ship.phaseAStrafeUsed += Math.abs(strafe);
		}

		if (phase === "PHASE_B") {
			if (Math.abs(turn) + ship.phaseTurnUsed > maxTurn) {
				throw new Error("阶段B转向燃料不足");
			}
			ship.phaseTurnUsed += Math.abs(turn);
		}

		if (phase === "PHASE_C") {
			if (Math.abs(forward) + ship.phaseCForwardUsed > maxForward) {
				throw new Error("阶段C前进燃料不足");
			}
			if (Math.abs(strafe) + ship.phaseCStrafeUsed > maxStrafe) {
				throw new Error("阶段C横移燃料不足");
			}
			ship.phaseCForwardUsed += Math.abs(forward);
			ship.phaseCStrafeUsed += Math.abs(strafe);
		}
	}

	private applyIncrementalMovement(ship: ShipState, payload: MoveTokenPayload): void {
		const plan = payload.movementPlan;
		if (!plan) {
			throw new Error("缺少移动计划");
		}
		if (payload.phase && payload.phase !== ship.movePhase) {
			throw new Error("移动阶段未同步");
		}
		const phase = this.getMovePhase(payload.phase, ship.movePhase);
		this.assertPhaseOrder(ship.movePhase, phase);

		let forward = 0;
		let strafe = 0;
		let turn = 0;

		switch (phase) {
			case "PHASE_A":
				forward = plan.phaseAForward;
				strafe = plan.phaseAStrafe;
				break;
			case "PHASE_B":
				turn = plan.turnAngle;
				break;
			case "PHASE_C":
				forward = plan.phaseCForward;
				strafe = plan.phaseCStrafe;
				break;
		}

		if (forward === 0 && strafe === 0 && turn === 0) {
			throw new Error("移动量不能为空");
		}

		this.updateMovementBudget(ship, phase, forward, strafe, turn);
		if (phase !== ship.movePhase) {
			ship.movePhase = phase;
		}

		let nextX = ship.transform.x;
		let nextY = ship.transform.y;
		let nextHeading = ship.transform.heading;

		if (phase === "PHASE_B") {
			nextHeading = this.normalizeHeading(nextHeading + turn);
		} else {
			const next = this.applyTranslation(nextX, nextY, nextHeading, forward, strafe);
			nextX = next.x;
			nextY = next.y;
		}

		ship.transform.setPosition(nextX, nextY);
		ship.transform.setHeading(nextHeading);
	}

	dispatchAdvanceMovePhase(client: Client, ship: ShipState): void {
		this.validateAuthority(client, ship);
		if (ship.hasMoved) throw new Error("本回合已移动");
		switch (ship.movePhase) {
			case "PHASE_A":
				ship.movePhase = "PHASE_B";
				break;
			case "PHASE_B":
				ship.movePhase = "PHASE_C";
				break;
			case "PHASE_C":
				ship.hasMoved = true;
				break;
		}
	}

	dispatchMoveToken(client: Client, payload: MoveTokenPayload): void {
		const ship = this.state.ships.get(payload.shipId);
		if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);
		this.validateAuthority(client, ship);
		if (ship.isOverloaded) throw new Error("过载状态无法移动");
		if (ship.hasMoved) throw new Error("本回合已移动");
		if (!payload.movementPlan) throw new Error("缺少移动计划");

		if (payload.isIncremental) {
			this.applyIncrementalMovement(ship, payload);
			return;
		}

		const v = validateThreePhaseMove(
			ship.transform.x,
			ship.transform.y,
			ship.transform.heading,
			payload.movementPlan,
			ship.maxSpeed,
			ship.maxTurnRate
		);
		if (!v.valid || !v.finalPosition || v.finalHeading === undefined)
			throw new Error(v.error || "无效移动");

		ship.phaseAForwardUsed = payload.movementPlan.phaseAForward;
		ship.phaseAStrafeUsed = payload.movementPlan.phaseAStrafe;
		ship.phaseTurnUsed = payload.movementPlan.turnAngle;
		ship.phaseCForwardUsed = payload.movementPlan.phaseCForward;
		ship.phaseCStrafeUsed = payload.movementPlan.phaseCStrafe;
		ship.transform.setPosition(v.finalPosition.x, v.finalPosition.y);
		ship.transform.setHeading(v.finalHeading);
		ship.hasMoved = true;
	}

	dispatchToggleShield(
		client: Client,
		payload: { shipId: string; isActive: boolean; orientation?: number }
	): void {
		const ship = this.state.ships.get(payload.shipId);
		if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);
		this.validateAuthority(client, ship);
		if (ship.isOverloaded && payload.isActive) throw new Error("过载状态无法开启护盾");

		if (payload.isActive && !ship.shield.active) {
			if (ship.flux.total + GAME_CONFIG.SHIELD_UP_FLUX_COST > ship.flux.max)
				throw new Error("辐能容量不足");
			ship.flux.addSoft(GAME_CONFIG.SHIELD_UP_FLUX_COST);
		}

		payload.isActive ? ship.shield.activate() : ship.shield.deactivate();
		ship.shield.orientation = payload.orientation ?? ship.transform.heading;
	}

	dispatchFireWeapon(
		client: Client,
		payload: { attackerId: string; weaponId: string; targetId: string }
	): void {
		const attacker = this.state.ships.get(payload.attackerId);
		const target = this.state.ships.get(payload.targetId);
		if (!attacker) throw new Error(`攻击舰船不存在`);
		if (!target) throw new Error(`目标舰船不存在`);
		this.validateAuthority(client, attacker);
		if (target.isDestroyed || target.hull.current <= 0) throw new Error("目标已被摧毁");

		const weapon = attacker.weapons.get(payload.weaponId);
		if (!weapon) throw new Error(`武器不存在`);
		if (weapon.state !== WeaponState.READY) throw new Error(`武器状态: ${weapon.state}`);
		if (weapon.hasFiredThisTurn) throw new Error("本回合已射击");

		const { distanceToMuzzle: dist } = this.assertTargetInWeaponArc(attacker, weapon, target);
		if (dist > weapon.range) throw new Error(`超出射程: ${dist} > ${weapon.range}`);

		if (weapon.fluxCost > 0) {
			if (attacker.flux.total + weapon.fluxCost > attacker.flux.max) throw new Error("辐能不足");
			attacker.flux.addSoft(weapon.fluxCost);
		}

		if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) throw new Error("弹药耗尽");

		weapon.cooldownRemaining = weapon.cooldownMax || GAME_CONFIG.DEFAULT_COOLDOWN;
		weapon.state = WeaponState.COOLDOWN;
		weapon.hasFiredThisTurn = true;
		attacker.hasFired = true;
		if (weapon.maxAmmo > 0) {
			weapon.currentAmmo = Math.max(0, weapon.currentAmmo - 1);
			if (weapon.currentAmmo <= 0) {
				weapon.state = WeaponState.OUT_OF_AMMO;
				weapon.cooldownRemaining = 0;
			}
		}
		this.applyDamage(attacker, weapon, target);
	}

	dispatchVentFlux(client: Client, payload: { shipId: string }): void {
		const ship = this.state.ships.get(payload.shipId);
		if (!ship) throw new Error(`舰船不存在`);
		this.validateAuthority(client, ship);
		ship.flux.vent(1.0);
	}

	dispatchAssignShip(client: Client, shipId: string, targetSessionId: string): void {
		const player = this.state.players.get(client.sessionId);
		if (!player || player.role !== PlayerRole.DM) throw new Error("仅 DM 可分配舰船");
		const ship = this.state.ships.get(shipId);
		if (!ship) throw new Error(`舰船不存在`);
		ship.ownerId = targetSessionId;
	}

	private applyDamage(attacker: ShipState, weapon: WeaponSlot, target: ShipState): void {
		const hitAngle = angleBetween(
			target.transform.x,
			target.transform.y,
			attacker.transform.x,
			attacker.transform.y
		);
		const relativeAngle = (((hitAngle - target.transform.heading) % 360) + 360) % 360;
		const section = Math.floor(relativeAngle / 60) % 6;

		let damage = weapon.damage;
		if (target.shield.active && !weapon.ignoresShields) {
			const shieldDiff = angleDifference(target.shield.orientation, hitAngle);
			if (shieldDiff <= target.shield.arc / 2) {
				const shieldDmg = weapon.damage * DAMAGE_MODIFIERS[weapon.damageType].shield;
				target.flux.addHard(shieldDmg * GAME_CONFIG.SHIELD_FLUX_PER_DAMAGE);
				if (target.flux.isOverloaded) {
					target.isOverloaded = true;
					target.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
					target.shield.deactivate();
				}
				damage = 0;
			}
		}

		if (damage > 0) {
			const mult = DAMAGE_MODIFIERS[weapon.damageType];
			const armorDmg = Math.min(target.armor.getQuadrant(section), damage * mult.armor);
			target.armor.takeDamage(section, armorDmg);
			const hullDmg = damage * mult.hull * (armorDmg > 0 ? 0.5 : 1);
			target.hull.takeDamage(hullDmg);
			if (target.hull.current <= 0) {
				target.isDestroyed = true;
				target.shield.deactivate();
			}
		}
	}
}