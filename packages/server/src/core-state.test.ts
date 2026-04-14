import {
	PRESET_SHIPS,
	PRESET_WEAPONS,
	getAvailableShips,
	getAvailableWeapons,
	getShipHullSpec,
	getWeaponSpec,
} from "@vt/data";
import {
	angleDifference,
	calculateThreePhaseMove,
	distance,
	validateThreePhaseMove,
} from "@vt/rules";
import { ClientCommand, ConnectionQuality, Faction, PlayerRole } from "@vt/types";
import type { PlayerState, ShipState } from "@vt/types";
import { describe, expect, it } from "vitest";

describe("core contracts and rules", () => {
	it("keeps command constants stable", () => {
		expect(ClientCommand.CMD_MOVE_TOKEN).toBe("CMD_MOVE_TOKEN");
		expect(ClientCommand.CMD_NEXT_PHASE).toBe("CMD_NEXT_PHASE");
	});

	it("computes movement plans within bounds", () => {
		const plan = {
			phaseAForward: 40,
			phaseAStrafe: 10,
			turnAngle: 15,
			phaseBForward: 20,
			phaseBStrafe: -5,
		};

		const validation = validateThreePhaseMove(0, 0, 0, plan, 30, 45);
		expect(validation.valid).toBe(true);
		expect(validation.finalPosition).toBeDefined();
		expect(validation.finalHeading).toBe(15);

		const result = calculateThreePhaseMove(0, 0, 0, plan);
		expect(result.heading).toBe(15);
		expect(result.x).toBeCloseTo(validation.finalPosition?.x ?? 0);
		expect(result.y).toBeCloseTo(validation.finalPosition?.y ?? 0);
		expect(distance(0, 0, result.x, result.y)).toBeGreaterThan(0);
		expect(angleDifference(350, 10)).toBe(20);
	});

	it("rejects out-of-range movement plans", () => {
		const invalidPlan = {
			phaseAForward: 999,
			phaseAStrafe: 0,
			turnAngle: 0,
			phaseBForward: 0,
			phaseBStrafe: 0,
		};

		const validation = validateThreePhaseMove(0, 0, 0, invalidPlan, 30, 45);
		expect(validation.valid).toBe(false);
		expect(validation.error).toContain("Phase A forward distance");
	});

	it("exposes weapon and hull presets through the data package", () => {
		expect(PRESET_WEAPONS.autocannon).toBeDefined();
		expect(PRESET_SHIPS.frigate_assault).toBeDefined();
		expect(getWeaponSpec("autocannon")?.id).toBe("autocannon");
		expect(getShipHullSpec("frigate_assault")?.id).toBe("frigate_assault");
		expect(getAvailableWeapons().length).toBeGreaterThan(0);
		expect(getAvailableShips().length).toBeGreaterThan(0);
	});

	it("models game room state with map-like collections", () => {
		const player: PlayerState = {
			sessionId: "session-1",
			shortId: 123456,
			role: PlayerRole.DM,
			name: "Commander",
			nickname: "",
			avatar: "👤",
			isReady: false,
			connected: true,
			pingMs: 33,
			jitterMs: 2,
			connectionQuality: ConnectionQuality.EXCELLENT,
		};

		const ship: ShipState = {
			id: "ship-1",
			ownerId: "session-1",
			faction: Faction.DM,
			hullType: "frigate",
			name: "",
			width: 20,
			length: 40,
			transform: { x: 12, y: 24, heading: 90 },
			hull: { current: 100, max: 100 },
			armor: { maxPerQuadrant: 10, quadrants: [10, 10, 10, 10, 10, 10] },
			shield: { type: "FRONT", active: false, orientation: 0, arc: 120, radius: 50 },
			flux: { hard: 0, soft: 0, max: 100, dissipation: 10 },
			weapons: new Map(),
			maxSpeed: 30,
			maxTurnRate: 45,
			isOverloaded: false,
			overloadTime: 0,
			isDestroyed: false,
			hasMoved: false,
			hasFired: false,
			movePhaseAX: 0,
			movePhaseAStrafe: 0,
			movePhaseBX: 0,
			movePhaseBStrafe: 0,
			turnAngle: 0,
		};

		expect(player.sessionId).toBe("session-1");
		expect(ship.transform.heading).toBe(90);
		expect(ship.weapons.size).toBe(0);
	});
});
