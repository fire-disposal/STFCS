import { Weapon } from "../../domain/weapon/Weapon";
import { WeaponMountEntity, type WeaponMountConfig } from "../../domain/weapon/WeaponMount";
import { DamageCalculator, type DamageCalculationResult } from "../../domain/weapon/DamageCalculator";
import { Ship } from "../../domain/ship/Ship";
import type { Point } from "../../types/geometry";
import type { Result } from "@vt/shared/types";

// 魔法数字常量
const LINE_OF_SIGHT_OBSTACLE_RADIUS = 10;

export interface AttackCommand {
	sourceShipId: string;
	targetShipId: string;
	weaponMountId: string;
	timestamp: number;
}

export interface FireWeaponResult {
	hit: boolean;
	damageResult: DamageCalculationResult;
	fluxCost: number;
}

export interface CombatServiceDeps {
	getShip(shipId: string): Ship | null;
	applyDamageToShip(shipId: string, result: DamageCalculationResult): void;
	addFluxToShip(shipId: string, softFlux: number, hardFlux: number): void;
}

export type AttackValidationResult =
	| { canAttack: true }
	| { canAttack: false; reason: string };

export class CombatService {
	private readonly _weaponMounts: Map<string, WeaponMountEntity>;
	private readonly _weapons: Map<string, Weapon>;
	private readonly _deps: CombatServiceDeps;

	constructor(deps: CombatServiceDeps) {
		this._weaponMounts = new Map();
		this._weapons = new Map();
		this._deps = deps;
	}

	registerWeapon(weapon: Weapon): void {
		this._weapons.set(weapon.id, weapon);
	}

	registerWeaponMount(config: WeaponMountConfig): void {
		const mount = new WeaponMountEntity(config);
		this._weaponMounts.set(mount.id, mount);
	}

	getWeapon(weaponId: string): Weapon | undefined {
		return this._weapons.get(weaponId);
	}

	getWeaponMount(mountId: string): WeaponMountEntity | undefined {
		return this._weaponMounts.get(mountId);
	}

	getRegisteredMounts(): WeaponMountEntity[] {
		return Array.from(this._weaponMounts.values());
	}

	canAttack(sourceShipId: string, targetShipId: string, mountId: string): AttackValidationResult {
		const sourceShip = this._deps.getShip(sourceShipId);
		const targetShip = this._deps.getShip(targetShipId);
		const mount = this._weaponMounts.get(mountId);

		if (!sourceShip) {
			return { canAttack: false, reason: "Source ship not found" };
		}

		if (!targetShip) {
			return { canAttack: false, reason: "Target ship not found" };
		}

		if (!mount) {
			return { canAttack: false, reason: "Weapon mount not found" };
		}

		const distance = DamageCalculator.calculateDistance(sourceShip.position, targetShip.position);

		if (!mount.weapon.isWithinRange(distance)) {
			return { canAttack: false, reason: "Target out of range" };
		}

		if (!mount.isTargetInArc(targetShip.position, sourceShip.position)) {
			return { canAttack: false, reason: "Target not in weapon arc" };
		}

		if (sourceShip.status === "OVERLOADED" || sourceShip.status === "DISABLED") {
			return { canAttack: false, reason: "Source ship cannot fire weapons" };
		}

		return { canAttack: true };
	}

	executeAttack(command: AttackCommand): FireWeaponResult {
		const sourceShip = this._deps.getShip(command.sourceShipId);
		const targetShip = this._deps.getShip(command.targetShipId);
		const mount = this._weaponMounts.get(command.weaponMountId);

		const noHitResult: FireWeaponResult = {
			hit: false,
			damageResult: {
				hit: false,
				damage: 0,
				shieldAbsorbed: 0,
				armorReduced: 0,
				hullDamage: 0,
				softFluxGenerated: 0,
				hardFluxGenerated: 0,
			},
			fluxCost: 0,
		};

		if (!sourceShip || !targetShip || !mount) {
			return noHitResult;
		}

		const validation = this.canAttack(command.sourceShipId, command.targetShipId, command.weaponMountId);

		if (!validation.canAttack) {
			return noHitResult;
		}

		const damageInput = {
			weapon: mount.weapon,
			sourceShip,
			targetShip,
			hitPosition: targetShip.position,
		};

		const damageResult = DamageCalculator.calculateDamage(damageInput);

		if (damageResult.hit) {
			this._deps.applyDamageToShip(command.targetShipId, damageResult);
			this._deps.addFluxToShip(command.sourceShipId, damageResult.softFluxGenerated, 0);
		}

		return {
			hit: damageResult.hit,
			damageResult,
			fluxCost: mount.weapon.fluxCost,
		};
	}

	/**
	 * 计算两点之间是否有视线遮挡
	 */
	calculateLineOfSight(from: Point, to: Point, obstacles: Point[]): boolean {
		const dx = to.x - from.x;
		const dy = to.y - from.y;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance === 0) return true;

		const steps = Math.ceil(distance);
		const stepX = dx / steps;
		const stepY = dy / steps;

		for (let i = 1; i < steps; i++) {
			const checkX = from.x + stepX * i;
			const checkY = from.y + stepY * i;

			for (const obstacle of obstacles) {
				const obsDist = Math.sqrt((checkX - obstacle.x) ** 2 + (checkY - obstacle.y) ** 2);
				if (obsDist < LINE_OF_SIGHT_OBSTACLE_RADIUS) {
					return false;
				}
			}
		}

		return true;
	}

	/**
	 * 获取所有可攻击的目标
	 */
	getEngageableTargets(
		sourceShipId: string,
		targetShipIds: string[]
	): Array<{ shipId: string; mountId: string; inRange: boolean }> {
		const sourceShip = this._deps.getShip(sourceShipId);
		if (!sourceShip) {
			return [];
		}

		const results: Array<{ shipId: string; mountId: string; inRange: boolean }> = [];

		for (const mount of this._weaponMounts.values()) {
			for (const targetId of targetShipIds) {
				const targetShip = this._deps.getShip(targetId);
				if (!targetShip) continue;

				const distance = DamageCalculator.calculateDistance(sourceShip.position, targetShip.position);

				const inRange =
					mount.weapon.isWithinRange(distance) &&
					mount.isTargetInArc(targetShip.position, sourceShip.position);

				results.push({
					shipId: targetId,
					mountId: mount.id,
					inRange,
				});
			}
		}

		return results;
	}
}

export default CombatService;
