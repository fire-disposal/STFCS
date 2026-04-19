/**
 * 武器目标计算测试
 */

import { describe, it, expect } from "vitest";
import { calculateShipWeaponTargets } from "./targeting.js";
import type { ShipTokenState } from "../../state/Token.js";

function createTestShip(
	id: string,
	name: string,
	position: { x: number; y: number },
	weapons: Array<{
		mountId: string;
		state: string;
		weapon: {
			category: string;
			damageType: string;
			size: string;
			damage: number;
			range: number;
			fluxCostPerShot: number;
			allowsMultipleTargets?: boolean;
			burstCount?: number;
			projectilesPerShot?: number;
		};
	}>,
	mounts: Array<{
		id: string;
		mountType: string;
		facing?: number;
		position: { x: number; y: number };
	}> = []
): ShipTokenState {
	const now = Date.now();
	return {
		id,
		type: "SHIP",
		position,
		heading: 0,
		scale: 1,
		visible: true,
		selected: false,
		locked: false,
		dataRef: `ship:${id}`,
		shipJson: {
			$schema: "ship-v2",
			$id: `ship:${id}`,
			ship: {
				size: "FRIGATE",
				class: "STRIKE",
				maxHitPoints: 100,
				armorMaxPerQuadrant: 50,
				maxSpeed: 100,
				maxTurnRate: 60,
				mounts: mounts.map((m) => ({
					id: m.id,
					mountType: m.mountType as "TURRET" | "HARDPOINT",
					position: m.position,
					facing: m.facing,
					size: "SMALL",
				})),
			},
			metadata: { name },
		},
		runtime: {
			position,
			heading: 0,
			hull: 100,
			armor: [50, 50, 50, 50, 50, 50],
			fluxSoft: 0,
			fluxHard: 0,
			overloaded: false,
			destroyed: false,
			movement: {
				hasMoved: false,
				phaseAUsed: 0,
				turnAngleUsed: 0,
				phaseCUsed: 0,
			},
			hasFired: false,
			weapons: weapons.map((w) => ({
				mountId: w.mountId,
				state: w.state as "READY" | "COOLDOWN" | "DISABLED",
				weapon: w.weapon as import("@vt/data").WeaponSpec,
				cooldownRemaining: 0,
			})),
		},
		combatState: {
			hull: 100,
			maxHull: 100,
			hullPercentage: 100,
			armor: [50, 50, 50, 50, 50, 50],
			maxArmor: 50,
			armorPercentages: [100, 100, 100, 100, 100, 100],
			fluxSoft: 0,
			fluxHard: 0,
			totalFlux: 0,
			fluxCapacity: 100,
			fluxPercentage: 0,
			fluxState: "NORMAL",
			shieldActive: false,
			shieldValue: 0,
			maxShield: 0,
			shieldPercentage: 0,
			overloaded: false,
			overloadTime: 0,
			destroyed: false,
			hasFired: false,
			weaponsReady: weapons.filter((w) => w.state === "READY").length,
			weaponsTotal: weapons.length,
			weaponsPercentage:
				weapons.length > 0
					? (weapons.filter((w) => w.state === "READY").length / weapons.length) * 100
					: 0,
		},
		movementState: {
			hasMoved: false,
			phaseAUsed: 0,
			turnAngleUsed: 0,
			phaseCUsed: 0,
			maxSpeed: 100,
			maxTurnRate: 60,
			phaseAAvailable: 100,
			phaseCAvailable: 100,
			turnAngleAvailable: 60,
			movePercentage: 0,
			turnPercentage: 0,
		},
		metadata: {
			name,
			description: undefined,
			faction: "PLAYER",
			ownerId: undefined,
			createdAt: now,
			updatedAt: now,
			tags: [],
			customData: undefined,
		},
	};
}

describe("Weapon Targeting", () => {
	it("should calculate targets for a ship with READY weapons", () => {
		const attacker = createTestShip(
			"ship1",
			"Attacker",
			{ x: 0, y: 0 },
			[
				{
					mountId: "mount1",
					state: "READY",
						weapon: {
							category: "BALLISTIC" as const,
							damageType: "KINETIC" as const,
							size: "SMALL" as const,
							damage: 10,
							range: 500,
							fluxCostPerShot: 5,
							allowsMultipleTargets: false,
							burstCount: 1,
						},
				},
			],
			[{ id: "mount1", mountType: "TURRET", position: { x: 0, y: 0 } }]
		);

		const target = createTestShip(
			"ship2",
			"Target",
			{ x: 100, y: 0 },
			[]
		);

		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.canAttack).toBe(true);
		expect(result.weapons).toHaveLength(1);
		expect(result.weapons[0].isAvailable).toBe(true);
		expect(result.weapons[0].validTargets).toHaveLength(1);
		expect(result.weapons[0].validTargets[0].targetId).toBe("ship2");
		expect(result.weapons[0].validTargets[0].inRange).toBe(true);
	});

	it("should mark weapon unavailable when out of range", () => {
		const attacker = createTestShip(
			"ship1",
			"Attacker",
			{ x: 0, y: 0 },
			[
				{
					mountId: "mount1",
					state: "READY",
					weapon: {
						category: "BALLISTIC",
						damageType: "KINETIC",
						size: "SMALL",
						damage: 10,
						range: 50,
						fluxCostPerShot: 5,
					},
				},
			],
			[{ id: "mount1", mountType: "TURRET", position: { x: 0, y: 0 } }]
		);

		const target = createTestShip(
			"ship2",
			"Target",
			{ x: 100, y: 0 },
			[]
		);

		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.weapons[0].validTargets[0].inRange).toBe(false);
	});

	it("should not attack when ship has already fired", () => {
		const attacker = createTestShip(
			"ship1",
			"Attacker",
			{ x: 0, y: 0 },
			[
				{
					mountId: "mount1",
					state: "READY",
					weapon: {
						category: "BALLISTIC",
						damageType: "KINETIC",
						size: "SMALL",
						damage: 10,
						range: 500,
						fluxCostPerShot: 5,
					},
				},
			]
		);
		attacker.runtime.hasFired = true;

		const target = createTestShip("ship2", "Target", { x: 100, y: 0 }, []);
		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.canAttack).toBe(false);
		expect(result.cannotAttackReason).toBe("Ship has already fired this turn");
	});

	it("should not attack destroyed targets", () => {
		const attacker = createTestShip(
			"ship1",
			"Attacker",
			{ x: 0, y: 0 },
			[
				{
					mountId: "mount1",
					state: "READY",
					weapon: {
						category: "BALLISTIC" as const,
						damageType: "KINETIC" as const,
						size: "SMALL" as const,
						damage: 10,
						range: 500,
						fluxCostPerShot: 5,
					},
				},
			],
			[{ id: "mount1", mountType: "TURRET", position: { x: 0, y: 0 } }]
		);

		const target = createTestShip("ship2", "Target", { x: 100, y: 0 }, []);
		target.runtime.destroyed = true;

		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.weapons).toHaveLength(1);
		expect(result.weapons[0].validTargets).toHaveLength(0);
	});
});
