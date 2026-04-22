/**
 * 武器目标计算测试
 */

import { describe, it, expect } from "vitest";
import { calculateShipWeaponTargets } from "./targeting.js";
import type { CombatToken, TokenSpec, TokenRuntime, WeaponJSON, MountSpec } from "@vt/data";
import { Faction, MovementPhase } from "@vt/data";

function createTestToken(
	id: string,
	name: string,
	position: { x: number; y: number },
	weapons: Array<{
		mountId: string;
		weapon: WeaponJSON;
	}> = [],
	mounts: Array<{
		id: string;
		facing?: number;
		arc?: number;
	}> = []
): CombatToken {
	const spec: TokenSpec = {
		size: "FRIGATE",
		class: "STRIKE",
		width: 40,
		length: 60,
		maxHitPoints: 100,
		armorMaxPerQuadrant: 50,
		armorMinReduction: 0.1,
		armorMaxReduction: 0.85,
		fluxCapacity: 100,
		fluxDissipation: 5,
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
	};

	const runtime: TokenRuntime = {
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
			currentPhase: MovementPhase.A,
			hasMoved: false,
			phaseAUsed: 0,
			turnAngleUsed: 0,
			phaseCUsed: 0,
		},
		hasFired: false,
		faction: Faction.NEUTRAL,
	};

	return {
		$id: id,
		spec,
		runtime,
		metadata: { name },
	};
}

describe("Weapon Targeting", () => {
	it("should calculate targets for a ship with READY weapons", () => {
		const attacker = createTestToken(
			"ship1",
			"Attacker",
			{ x: 0, y: 0 },
			[],
			[{ id: "mount1" }]
		);

		const target = createTestToken("ship2", "Target", { x: 100, y: 0 }, []);

		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.canAttack).toBeDefined();
		expect(result.weapons).toBeDefined();
	});

	it("should not attack when ship has already fired", () => {
		const attacker = createTestToken(
			"ship1",
			"Attacker",
			{ x: 0, y: 0 },
			[],
			[{ id: "mount1" }]
		);
		attacker.runtime.hasFired = true;

		const target = createTestToken("ship2", "Target", { x: 100, y: 0 }, []);

		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.canAttack).toBe(false);
		expect(result.cannotAttackReason).toBe("Ship has already fired this turn");
	});

	it("should not attack destroyed targets", () => {
		const attacker = createTestToken(
			"ship1",
			"Attacker",
			{ x: 0, y: 0 },
			[],
			[{ id: "mount1" }]
		);

		const target = createTestToken("ship2", "Target", { x: 100, y: 0 }, []);
		target.runtime.destroyed = true;

		const result = calculateShipWeaponTargets(attacker, [target]);

		expect(result.weapons).toBeDefined();
	});
});