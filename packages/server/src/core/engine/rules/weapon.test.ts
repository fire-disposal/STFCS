import { describe, expect, it, vi } from "vitest";
import type { CombatToken } from "@vt/data";
import type { EngineContext } from "../context.js";
import { applyCombat } from "../modules/combat.js";
import { processTokenTurnEnd } from "./turnEnd.js";

function makeToken(id: string): CombatToken {
	return {
		$id: id,
		spec: {
			maxHitPoints: 100,
			armorMaxPerQuadrant: 100,
			armorMinReduction: 0.1,
			armorMaxReduction: 0.85,
			fluxCapacity: 100,
			mounts: [],
		},
		runtime: {
			position: { x: 0, y: 0 },
			heading: 0,
			hull: 100,
			armor: [100, 100, 100, 100, 100, 100],
			fluxSoft: 0,
			fluxHard: 0,
			overloaded: false,
			destroyed: false,
			weapons: [],
			actionSequence: 0,
		},
	} as CombatToken;
}

describe("weapon turn and hit resolution", () => {
	it("persists each cooldown round and readies after the configured number of following rounds", () => {
		const token = makeToken("ship");
		token.spec.mounts = [{
			id: "main",
			arc: 360,
			size: "SMALL",
			weapon: {
				$id: "weapon",
				spec: { damageType: "ENERGY", size: "SMALL", damage: 10, range: 100, fluxCostPerShot: 0, cooldown: 2 },
			},
		}];
		token.runtime.weapons = [{ mountId: "main", state: "FIRED" }];

		const firedSettlement = processTokenTurnEnd(token);
		expect(firedSettlement.updatedWeapons).toEqual([{ mountId: "main", state: "COOLDOWN", cooldownRemaining: 2 }]);

		token.runtime.weapons = firedSettlement.updatedWeapons;
		const firstCooldownSettlement = processTokenTurnEnd(token);
		expect(firstCooldownSettlement.weaponsUpdated).toBe(true);
		expect(firstCooldownSettlement.updatedWeapons).toEqual([{ mountId: "main", state: "COOLDOWN", cooldownRemaining: 1 }]);

		token.runtime.weapons = firstCooldownSettlement.updatedWeapons;
		const secondCooldownSettlement = processTokenTurnEnd(token);
		expect(secondCooldownSettlement.updatedWeapons).toEqual([{ mountId: "main", state: "READY", cooldownRemaining: 0 }]);
	});

	it("applies EMP hits as hard flux instead of resolving a zero-effect shot", () => {
		const attacker = makeToken("attacker");
		const target = makeToken("target");
		target.runtime.position = { x: 10, y: 0 };
		attacker.spec.mounts = [{
			id: "emp",
			arc: 360,
			size: "SMALL",
			weapon: {
				$id: "emp-weapon",
				spec: { damageType: "ENERGY", size: "SMALL", damage: 0, emp: 40, range: 100, fluxCostPerShot: 0 },
			},
		}];
		attacker.runtime.weapons = [{ mountId: "emp", state: "READY" }];

		const random = vi.spyOn(Math, "random").mockReturnValue(0);
		try {
			const result = applyCombat({
				state: { tokens: { attacker, target } },
				ship: attacker,
				payload: { allocations: [{ mountId: "emp", targets: [{ targetId: "target", shotCount: 1 }] }] },
			} as unknown as EngineContext);

			const targetUpdate = result.runtimeUpdates.find((update) => update.tokenId === target.$id);
			expect(targetUpdate?.updates.fluxHard).toBe(38);
			expect(result.events.find((event) => event.type === "attack")?.data.empDamage).toBe(38);
		} finally {
			random.mockRestore();
		}
	});
});
