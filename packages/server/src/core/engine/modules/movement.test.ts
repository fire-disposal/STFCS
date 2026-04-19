/**
 * 移动模块测试 - ABC 阶段系统
 */

import { describe, it, expect } from "vitest";
import {
	validateMovement,
	validateRotation,
	validatePhaseAdvance,
	getMovementStatus,
	applyMovement,
} from "./movement.js";

function createTestShip(
	movementState: any = {},
	maxSpeed = 100,
	maxTurnRate = 60
) {
	return {
		id: "ship1",
		shipJson: {
			ship: {
				maxSpeed,
				maxTurnRate,
			},
		},
		runtime: {
			position: { x: 0, y: 0 },
			heading: 0,
			movement: {
				currentPhase: "A",
				hasMoved: false,
				phaseAUsed: 0,
				turnAngleUsed: 0,
				phaseCUsed: 0,
				phaseALock: null,
				phaseCLock: null,
				...movementState,
			},
		},
	};
}

describe("Movement Module - ABC Phase System", () => {
	describe("validateMovement", () => {
		it("should allow forward movement in phase A", () => {
			const ship = createTestShip();
			const result = validateMovement(ship, 10, 0);
			expect(result.valid).toBe(true);
		});

		it("should allow backward movement (negative forwardDistance)", () => {
			const ship = createTestShip();
			const result = validateMovement(ship, -10, 0);
			expect(result.valid).toBe(true);
		});

		it("should allow left strafe (positive strafeDistance)", () => {
			const ship = createTestShip();
			const result = validateMovement(ship, 0, 10);
			expect(result.valid).toBe(true);
		});

		it("should allow right strafe (negative strafeDistance)", () => {
			const ship = createTestShip();
			const result = validateMovement(ship, 0, -10);
			expect(result.valid).toBe(true);
		});

		it("should reject non-integer distances", () => {
			const ship = createTestShip();
			const result = validateMovement(ship, 10.5, 0);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("integer");
		});

		it("should reject simultaneous forward and strafe", () => {
			const ship = createTestShip();
			const result = validateMovement(ship, 10, 10);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("Cannot move forward/backward and strafe");
		});

		it("should reject movement exceeding phase capacity", () => {
			const ship = createTestShip();
			const result = validateMovement(ship, 150, 0);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("Exceeds available");
		});

		it("should lock direction after first move in phase A", () => {
			const ship = createTestShip({
				phaseALock: "FORWARD_BACKWARD",
			});
			const result = validateMovement(ship, 0, 10);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("locked");
		});

		it("should reject movement in phase B", () => {
			const ship = createTestShip({ currentPhase: "B" });
			const result = validateMovement(ship, 10, 0);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("phase B");
		});
	});

	describe("validateRotation", () => {
		it("should allow rotation in phase B", () => {
			const ship = createTestShip({ currentPhase: "B" });
			const result = validateRotation(ship, 30);
			expect(result.valid).toBe(true);
		});

		it("should reject rotation in phase A", () => {
			const ship = createTestShip();
			const result = validateRotation(ship, 30);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("phase A");
		});

		it("should reject non-integer angles", () => {
			const ship = createTestShip({ currentPhase: "B" });
			const result = validateRotation(ship, 30.5);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("integer");
		});

		it("should reject zero angle", () => {
			const ship = createTestShip({ currentPhase: "B" });
			const result = validateRotation(ship, 0);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("non-zero");
		});

		it("should reject rotation exceeding max turn rate", () => {
			const ship = createTestShip({ currentPhase: "B" });
			const result = validateRotation(ship, 100);
			expect(result.valid).toBe(false);
			expect(result.error).toContain("Exceeds available");
		});
	});

	describe("validatePhaseAdvance", () => {
		it("should allow advancing from phase A", () => {
			const ship = createTestShip();
			const result = validatePhaseAdvance(ship);
			expect(result.valid).toBe(true);
		});

		it("should reject advancing when done", () => {
			const ship = createTestShip({ currentPhase: "DONE" });
			const result = validatePhaseAdvance(ship);
			expect(result.valid).toBe(false);
		});
	});

	describe("getMovementStatus", () => {
		it("should return correct available resources", () => {
			const ship = createTestShip({
				phaseAUsed: 30,
				turnAngleUsed: 15,
				phaseCUsed: 0,
			});
			const status = getMovementStatus(ship);
			expect(status.currentPhase).toBe("A");
			expect(status.phaseAAvailable).toBe(70);
			expect(status.turnAngleAvailable).toBe(45);
			expect(status.phaseCAvailable).toBe(100);
			expect(status.canMove).toBe(true);
		});
	});
});
