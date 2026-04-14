/**
 * 命令分发器 - 处理所有客户端指令的验证与执行
 *
 * 使用优化的 ShipStateOptimized Schema
 */

import { Client } from "@colyseus/core";
import { angleBetween, angleDifference, distance, validateThreePhaseMove } from "@vt/rules";
import type {
	FireWeaponPayload,
	MoveTokenPayload,
	ToggleShieldPayload,
	VentFluxPayload,
} from "@vt/types";
import {
	GAME_CONFIG_CONST as GAME_CONFIG,
	GameRoomState,
	PlayerRoleConst as PlayerRole,
	ShipState,
	WeaponStateConst as WeaponState,
} from "../schema/GameSchema.js";
import type { WeaponSlot } from "../schema/ShipStateSchema.js";

/**
 * 命令分发器
 */
export class CommandDispatcher {
	constructor(private state: GameRoomState | any) {}

	/**
	 * 验证客户端对特定舰船的操作权限
	 */
	private validateAuthority(client: Client, ship: ShipState): void {
		const player = this.state.players.get(client.sessionId);
		if (!player) {
			throw new Error("玩家未注册");
		}

		// DM 拥有最高权限
		if (player.role === PlayerRole.DM) {
			return;
		}

		// 检查阶段：玩家只能在 PLAYER_TURN 阶段操作
		if (this.state.currentPhase !== "PLAYER_TURN") {
			throw new Error("当前不是玩家行动回合");
		}

		// 检查拥有权
		if (ship.ownerId !== client.sessionId) {
			throw new Error("你没有权限操作这艘舰船");
		}

		// 检查是否已经结束回合
		if (player.isReady) {
			throw new Error("你已结束本回合，无法继续操作");
		}
	}

	/**
	 * 处理移动指令
	 */
	dispatchMoveToken(client: Client, payload: MoveTokenPayload): void {
		const { shipId, x, y, heading, movementPlan, phase, isIncremental } = payload;

		const ship = this.state.ships.get(shipId);
		if (!ship) {
			throw new Error(`Ship ${shipId} not found`);
		}

		this.validateAuthority(client, ship);

		if (ship.isOverloaded) {
			throw new Error("Cannot move while overloaded");
		}

		if (!isIncremental && ship.hasMoved) {
			throw new Error("Ship has already moved this turn");
		}

		const startX = ship.transform.x;
		const startY = ship.transform.y;
		const startHeading = ship.transform.heading;

		if (movementPlan) {
			const validation = validateThreePhaseMove(
				startX,
				startY,
				startHeading,
				movementPlan,
				ship.maxSpeed,
				ship.maxTurnRate
			);

			if (!validation.valid) {
				throw new Error(validation.error || "Invalid movement");
			}

			ship.movePhaseAX = movementPlan.phaseAForward;
			ship.movePhaseAStrafe = movementPlan.phaseAStrafe;
			ship.turnAngle = movementPlan.turnAngle;
			ship.movePhaseBX = movementPlan.phaseBForward;
			ship.movePhaseBStrafe = movementPlan.phaseBStrafe;

			ship.setPosition(x, y);
			ship.setHeading(heading);

			if (!isIncremental) {
				ship.hasMoved = true;
			}

			console.log(
				`Ship ${shipId} moved to (${x.toFixed(2)}, ${y.toFixed(2)}) heading ${heading.toFixed(2)}`
			);
			return;
		}

		if (isIncremental) {
			const moveDistance = distance(startX, startY, x, y);
			const headingDiff = angleDifference(startHeading, heading);
			const currentPhase = phase || "PHASE_A";

			if (currentPhase === "PHASE_A" || currentPhase === "PHASE_C") {
				if (moveDistance > ship.maxSpeed) {
					throw new Error(
						`Incremental move distance ${moveDistance.toFixed(2)} exceeds single step limit ${ship.maxSpeed}`
					);
				}
				ship.setPosition(x, y);
			} else if (currentPhase === "PHASE_B") {
				if (headingDiff > ship.maxTurnRate) {
					throw new Error(
						`Incremental turn angle ${headingDiff.toFixed(2)} exceeds limit ${ship.maxTurnRate}`
					);
				}
				ship.setHeading(heading);
			}

			console.log(
				`Ship ${shipId} incremental move in ${currentPhase}: (${x.toFixed(2)}, ${y.toFixed(2)}) heading ${heading.toFixed(2)}`
			);
			return;
		}

		const moveDistance = distance(startX, startY, x, y);
		const maxMoveDistance = ship.maxSpeed * 4;

		if (moveDistance > maxMoveDistance) {
			throw new Error(
				`Move distance ${moveDistance.toFixed(2)} exceeds maximum ${maxMoveDistance}`
			);
		}

		const headingDiff = angleDifference(startHeading, heading);
		if (headingDiff > ship.maxTurnRate) {
			throw new Error(`Turn angle ${headingDiff.toFixed(2)} exceeds maximum ${ship.maxTurnRate}`);
		}

		if (
			x < -this.state.mapWidth / 2 ||
			x > this.state.mapWidth / 2 ||
			y < -this.state.mapHeight / 2 ||
			y > this.state.mapHeight / 2
		) {
			throw new Error("Target position is outside map boundaries");
		}

		ship.setPosition(x, y);
		ship.setHeading(heading);
		ship.hasMoved = true;

		console.log(
			`Ship ${shipId} moved to (${x.toFixed(2)}, ${y.toFixed(2)}) heading ${heading.toFixed(2)}`
		);
	}

	/**
	 * 处理护盾切换指令
	 */
	dispatchToggleShield(client: Client, payload: ToggleShieldPayload): void {
		const { shipId, isActive, orientation } = payload;

		const ship = this.state.ships.get(shipId);
		if (!ship) {
			throw new Error(`Ship ${shipId} not found`);
		}

		this.validateAuthority(client, ship);

		if (ship.isOverloaded && isActive) {
			throw new Error("Cannot raise shield while overloaded");
		}

		if (isActive && !ship.shield.active) {
			const fluxCost = GAME_CONFIG.SHIELD_UP_FLUX_COST;
			if (ship.flux.total + fluxCost > ship.flux.max) {
				throw new Error("Not enough flux capacity to raise shield");
			}
			ship.flux.addSoft(fluxCost);
		}

		if (isActive) {
			ship.shield.activate();
			if (orientation !== undefined) {
				ship.shield.setOrientation(orientation);
			} else {
				ship.shield.setOrientation(ship.transform.heading);
			}
		} else {
			ship.shield.deactivate();
		}

		console.log(`Ship ${shipId} shield ${isActive ? "raised" : "lowered"}`);
	}

	/**
	 * 处理开火指令
	 */
	dispatchFireWeapon(client: Client, payload: FireWeaponPayload): void {
		const { attackerId, weaponId, targetId } = payload;

		const attacker = this.state.ships.get(attackerId);
		const target = this.state.ships.get(targetId);

		if (!attacker) {
			throw new Error(`舰船 ${attackerId} 不存在`);
		}

		this.validateAuthority(client, attacker);

		if (!target) {
			throw new Error(`目标舰船 ${targetId} 不存在`);
		}

		if (target.hull.isDestroyed) {
			throw new Error("目标已被摧毁");
		}

		const weapon = attacker.weapons.get(weaponId);
		if (!weapon) {
			throw new Error(`武器 ${weaponId} 不存在`);
		}

		if (weapon.state !== WeaponState.READY) {
			if (weapon.state === WeaponState.COOLDOWN) {
				throw new Error(`武器冷却中：剩余 ${weapon.cooldownRemaining.toFixed(1)} 秒`);
			}
			if (weapon.state === WeaponState.OUT_OF_AMMO) {
				throw new Error("弹药耗尽");
			}
			throw new Error("武器不可用");
		}

		if (weapon.hasFiredThisTurn) {
			throw new Error("该武器本回合已射击");
		}

		const dist = distance(
			attacker.transform.x,
			attacker.transform.y,
			target.transform.x,
			target.transform.y
		);

		if (dist > weapon.range) {
			throw new Error(`目标超出射程：距离 ${dist.toFixed(0)} > 射程 ${weapon.range}`);
		}

		if (weapon.fluxCost > 0) {
			const totalFlux = ship.flux.total + weapon.fluxCost;
			if (totalFlux > ship.flux.max) {
				throw new Error(
					`辐能不足：需要 ${weapon.fluxCost}，当前容量 ${attacker.flux.max - attacker.flux.total}`
				);
			}
			attacker.flux.addSoft(weapon.fluxCost);
		}

		if (weapon.maxAmmo > 0) {
			if (weapon.currentAmmo <= 0) {
				weapon.state = WeaponState.OUT_OF_AMMO;
				throw new Error("弹药耗尽");
			}
			weapon.currentAmmo -= 1;
			if (weapon.currentAmmo <= 0) {
				weapon.state = WeaponState.OUT_OF_AMMO;
			}
		}

		const weaponWorldAngle = attacker.transform.heading + weapon.mountFacing;
		const angleToTarget = angleBetween(
			attacker.transform.x,
			attacker.transform.y,
			target.transform.x,
			target.transform.y
		);

		const normalizedWeaponAngle = ((weaponWorldAngle % 360) + 360) % 360;
		const normalizedTargetAngle = ((angleToTarget % 360) + 360) % 360;
		const angleDiff = angleDifference(normalizedWeaponAngle, normalizedTargetAngle);

		const arcCenter = (weapon.arcMin + weapon.arcMax) / 2;
		const arcHalfWidth = (weapon.arcMax - weapon.arcMin) / 2;
		const relativeArcDiff = angleDifference(arcCenter, normalizedTargetAngle);

		if (Math.abs(relativeArcDiff) > arcHalfWidth) {
			throw new Error(`目标不在射界内：角度偏差 ${relativeArcDiff.toFixed(0)}°`);
		}

		weapon.cooldownRemaining = weapon.cooldownMax || GAME_CONFIG.DEFAULT_COOLDOWN;
		weapon.state = WeaponState.COOLDOWN;
		weapon.hasFiredThisTurn = true;

		this.applyDamage(attacker, weapon, target);

		console.log(
			`[Fire] ${attacker.name || attackerId} 使用 ${weapon.name || weaponId} 攻击 ${target.name || targetId}`
		);
	}

	/**
	 * 应用伤害 - 使用优化的 6 象限装甲机制
	 */
	private applyDamage(attacker: ShipState, weapon: WeaponSlot, target: ShipState): void {
		const damageType = weapon.damageType;
		const baseDamage = weapon.damage;

		const hitAngle = angleBetween(
			target.transform.x,
			target.transform.y,
			attacker.transform.x,
			attacker.transform.y
		);
		const relativeAngle = hitAngle - target.transform.heading;
		const normalizedAngle = ((relativeAngle % 360) + 360) % 360;
		const section = Math.floor(normalizedAngle / 60) % 6;

		let actualDamage = baseDamage;
		let hitShield = false;

		// 检查护盾
		if (target.shield.active && !weapon.ignoresShields) {
			const shieldAngleDiff = angleDifference(target.shield.orientation, hitAngle);
			if (shieldAngleDiff <= target.shield.arc / 2) {
				hitShield = true;

				const shieldMultiplier = DAMAGE_MULTIPLIERS[damageType].shield;
				const shieldDamage = baseDamage * shieldMultiplier;

				target.flux.addHard(shieldDamage * GAME_CONFIG.SHIELD_FLUX_PER_DAMAGE);

				if (target.flux.isOverloaded) {
					target.isOverloaded = true;
					target.overloadTime = GAME_CONFIG.OVERLOAD_BASE_DURATION;
					target.shield.deactivate();
					console.log(`[Damage] ${target.name || target.id} 过载！`);
				}

				actualDamage = 0;
				console.log(`[Damage] 护盾吸收 ${shieldDamage.toFixed(0)} → 硬辐能 +${shieldDamage}`);
			}
		}

		// 应用装甲和船体伤害
		if (!hitShield && actualDamage > 0) {
			const armorMultiplier = DAMAGE_MULTIPLIERS[damageType].armor;
			const hullMultiplier = DAMAGE_MULTIPLIERS[damageType].hull;

			const currentArmor = target.armor.getQuadrant(section);

			const hitStrength = actualDamage * armorMultiplier;
			const effectiveArmor = Math.max(currentArmor * 0.05, currentArmor);
			const damageReduction = hitStrength / (hitStrength + effectiveArmor);
			const armorDamage = Math.min(currentArmor, actualDamage * armorMultiplier);

			if (currentArmor > 0) {
				target.armor.takeDamage(section, armorDamage);

				const hullDamage = actualDamage * hullMultiplier * (1 - damageReduction);
				target.hull.takeDamage(hullDamage);

				console.log(
					`[Damage] 象限${section}: 装甲-${armorDamage.toFixed(0)}, 船体-${hullDamage.toFixed(0)}`
				);
			} else {
				target.hull.takeDamage(actualDamage * hullMultiplier);
				console.log(`[Damage] 直接船体伤害：${actualDamage * hullMultiplier}`);
			}

			if (target.hull.isDestroyed) {
				target.isDestroyed = true;
				target.shield.deactivate();
				console.log(`[Damage] ${target.name || target.id} 被摧毁！`);
			}
		}
	}

	/**
	 * 处理辐能排散指令
	 */
	dispatchVentFlux(client: Client, payload: VentFluxPayload): void {
		const { shipId } = payload;

		const ship = this.state.ships.get(shipId);
		if (!ship) {
			throw new Error(`Ship ${shipId} not found`);
		}

		this.validateAuthority(client, ship);

		if (ship.flux.isIdle) {
			throw new Error("No flux to vent");
		}

		// 使用优化的 vent 方法
		const ventAmount = ship.flux.vent(GAME_CONFIG.VENT_FLUX_RATE);
		console.log(`Ship ${shipId} vented ${ventAmount.toFixed(0)} flux`);
	}
}
