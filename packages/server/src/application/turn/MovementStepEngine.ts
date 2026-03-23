import type { Point } from "@vt/shared/types";

export interface MovementStepCommand {
	stepIndex: 1 | 2 | 3;
	forward?: number;
	strafe?: number;
	rotation?: number;
}

export interface MovementStepContext {
	position: Point;
	heading: number;
}

export interface MovementStepResult {
	nextPosition: Point;
	nextHeading: number;
	consumedDistance: number;
}

export class MovementStepEngine {
	static applyStep(context: MovementStepContext, command: MovementStepCommand): MovementStepResult {
		if (command.stepIndex === 2) {
			const rotation = command.rotation ?? 0;
			return {
				nextPosition: context.position,
				nextHeading: ((context.heading + rotation) % 360 + 360) % 360,
				consumedDistance: 0,
			};
		}

		if (typeof command.forward === "number" && typeof command.strafe === "number") {
			throw new Error("Cannot apply forward and strafe at the same movement step");
		}

		const headingRad = (context.heading * Math.PI) / 180;
		const forward = command.forward ?? 0;
		const strafe = command.strafe ?? 0;
		const moveX = forward * Math.cos(headingRad) + strafe * Math.cos(headingRad + Math.PI / 2);
		const moveY = forward * Math.sin(headingRad) + strafe * Math.sin(headingRad + Math.PI / 2);
		const nextPosition = {
			x: context.position.x + moveX,
			y: context.position.y + moveY,
		};

		return {
			nextPosition,
			nextHeading: context.heading,
			consumedDistance: Math.hypot(moveX, moveY),
		};
	}
}

