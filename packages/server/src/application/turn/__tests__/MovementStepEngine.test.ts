import { describe, expect, it } from "vitest";
import { MovementStepEngine } from "../MovementStepEngine";

describe("MovementStepEngine", () => {
	it("should apply phase 1 forward movement", () => {
		const result = MovementStepEngine.applyStep(
			{ position: { x: 100, y: 100 }, heading: 0 },
			{ stepIndex: 1, forward: 40 }
		);
		expect(result.nextPosition.x).toBeCloseTo(140);
		expect(result.nextPosition.y).toBeCloseTo(100);
		expect(result.consumedDistance).toBeCloseTo(40);
	});

	it("should apply phase 2 rotation only", () => {
		const result = MovementStepEngine.applyStep(
			{ position: { x: 100, y: 100 }, heading: 350 },
			{ stepIndex: 2, rotation: 20 }
		);
		expect(result.nextHeading).toBe(10);
		expect(result.nextPosition).toEqual({ x: 100, y: 100 });
	});

	it("should reject forward+strafe mix in a single step", () => {
		expect(() =>
			MovementStepEngine.applyStep(
				{ position: { x: 100, y: 100 }, heading: 0 },
				{ stepIndex: 1, forward: 10, strafe: 10 }
			)
		).toThrowError("Cannot apply forward and strafe");
	});
});

