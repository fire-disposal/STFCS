/**
 * 武器目标计算测试
 */

import { describe, it, expect } from "vitest";
import { calculateShipWeaponTargets } from "./targeting.js";
import type { CombatToken } from "../../state/Token.js";
import type { TokenJSON, WeaponSpec, MountSpec } from "@vt/data";

function createTestShip(
	id: string,
	name: string,
	position: { x: number; y: number },
	weapons: Array<{
		mountId: string;
		state: string;
		weapon: WeaponSpec;
	}>,
	mounts: Array<{
		id: string;
		facing?: number;
		arc?: number;
	}> = []
): CombatToken {
	const tokenJson: TokenJSON = {
		$schema: "token-v2",
		$id: `ship:${id}`,
		token: {
			size: "FRIGATE",
			class: "STRIKE",
			maxHitPoints: 100,
			armorMaxPerQuadrant: 50,
			armorMinReduction: 0.1,
			armorMaxReduction: 0.85,
			maxSpeed: 100,
			maxTurnRate: 60,
			rangeModifier: 1.0,
			mounts: mounts.map((m) => ({
				id: m.id,
				position: { x: 0, y: 0 },
				facing: m.facing ?? 0,
				arc: m.arc ?? 360,
				size: "SMALL",
			})),
		},
		metadata: { name },
		runtime: {
			position,
			heading: 0,
			hull: 100,
			armor: [50, 50, 50, 50, 50, 50],
			fluxSoft: 0,
			fluxHard: 0,
			overloaded: false,
			overloadTime: 0,
			destroyed: false,
			movement: {
				currentPhase: "A",
				hasMoved: false,
				phaseAUsed: 0,
				turnAngleUsed: 0,
				phaseCUsed: 0,
			},
			hasFired: false,
			weapons: weapons.map((w) => ({
				mountId: w.mountId,
				state: w.state as "READY" | "COOLDOWN" | "DISABLED" | "FIRED",
				weapon: w.weapon,
			})),
		},
	};

	return {
		id,
		type: "SHIP",
		tokenJson,
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
						damageType: "KINETIC",
						size: "SMALL",
						damage: 10,
						range: 500,
						fluxCostPerShot: 5,
					},
				},
			],
			[{ id: "mount1" }]
		);

		const target = createTestShip("ship2", "Target", { x: 100, y: 0 }, []);

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
						damageType: "KINETIC",
						size: "SMALL",
						damage: 10,
						range: 50,
						fluxCostPerShot: 5,
					},
				},
			],
			[{ id: "mount1" }]
		);

		const target = createTestShip("ship2", "Target", { x: 100, y: 0 }, []);

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
						damageType: "KINETIC",
						size: "SMALL",
						damage: 10,
						range: 500,
						fluxCostPerShot: 5,
					},
				},
			]
		);
		attacker.tokenJson.runtime!.hasFired = true;

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
						damageType: "KINETIC",
						size: "SMALL",
						damage: 10,
						range: 500,
						fluxCostPerShot: 5,
					},
				},
			],
			[{ id: "mount1" }]
		);

		const target = createTestShip("ship2", "Target", { x: 100, y: 0 }, []);
		target.tokenJson.runtime!.destroyed = true;

		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.weapons).toHaveLength(1);
		expect(result.weapons[0].validTargets).toHaveLength(0);
	});
});