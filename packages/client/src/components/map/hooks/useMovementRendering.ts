import { drawMovementPreview } from "@/features/movement/MovementPreviewRenderer";
import {
	drawMovementPath,
	drawMovementRange,
	drawTurnArc,
} from "@/features/movement/MovementVisuals";
import type { MovementPhase, PhaseFuelState } from "@/store/slices/movementSlice";
import type { ShipState } from "@vt/contracts";
import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface MovementState {
	currentPlan?: {
		turnAngle: number;
	};
	currentPhase: MovementPhase;
	isAnimating: boolean;
	phaseA: PhaseFuelState;
	phaseB: PhaseFuelState;
	phaseC: PhaseFuelState;
}

function getPhaseFuelState(
	movementState: MovementState,
	phase: MovementPhase
): PhaseFuelState | null {
	switch (phase) {
		case "PHASE_A":
			return movementState.phaseA;
		case "PHASE_B":
			return movementState.phaseB;
		case "PHASE_C":
			return movementState.phaseC;
		default:
			return null;
	}
}

export function useMovementRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	movementState: MovementState
) {
	const graphicsRef = useRef<Graphics | null>(null);

	useEffect(() => {
		if (!layers) {
			graphicsRef.current = null;
			return;
		}

		if (!selectedShipId || !movementState) {
			if (graphicsRef.current) {
				graphicsRef.current.clear();
			}
			return;
		}

		let graphics = graphicsRef.current;
		if (!graphics) {
			graphics = new Graphics();
			graphicsRef.current = graphics;
			if (!layers.movementVisuals.children.includes(graphics)) {
				layers.movementVisuals.addChild(graphics);
			}
		}

		graphics.clear();

		const selectedShip = ships.find((s) => s.id === selectedShipId);
		if (!selectedShip) return;

		const maxSpeed = selectedShip.maxSpeed || 100;
		const maxTurnRate = selectedShip.maxTurnRate || 45;

		const currentPhase = movementState.currentPhase;
		const isAnimating = movementState.isAnimating;

		drawMovementRange(graphics, selectedShip, maxSpeed, {
			showRange: true,
			showTurnArc: true,
			showPath: true,
			rangeOpacity: 0.15,
		});

		if (movementState.currentPlan) {
			drawTurnArc(graphics, selectedShip, movementState.currentPlan.turnAngle, maxTurnRate, {
				showRange: true,
				showTurnArc: true,
				showPath: true,
				rangeOpacity: 0.15,
			});

			drawMovementPath(
				graphics,
				selectedShip,
				{ turn: movementState.currentPlan.turnAngle },
				currentPhase,
				maxSpeed,
				maxTurnRate,
				{ showRange: true, showTurnArc: true, showPath: true, rangeOpacity: 0.15 }
			);
		}

		if (currentPhase && currentPhase !== "NONE" && currentPhase !== "COMPLETED" && !isAnimating) {
			const phaseState = getPhaseFuelState(movementState, currentPhase);
			if (!phaseState) return;

			const { fuel } = phaseState;

			const remainingFuel = {
				forward: fuel.forwardMax - fuel.forwardUsed,
				strafe: fuel.strafeMax - fuel.strafeUsed,
				turn: fuel.turnMax - fuel.turnUsed,
			};

			const usedFuel = {
				forward: fuel.forwardUsed,
				strafe: fuel.strafeUsed,
				turn: fuel.turnUsed,
			};

			const maxFuel = {
				forward: currentPhase === "PHASE_A" || currentPhase === "PHASE_C" ? maxSpeed * 2 : 0,
				strafe: currentPhase === "PHASE_A" || currentPhase === "PHASE_C" ? maxSpeed : 0,
				turn: currentPhase === "PHASE_B" ? maxTurnRate : 0,
			};

			const predictedCommand = phaseState.lastMove || {
				forward: 0,
				strafe: 0,
				turn: 0,
			};

			drawMovementPreview(
				graphics,
				selectedShip,
				currentPhase,
				predictedCommand,
				remainingFuel,
				usedFuel,
				maxFuel,
				{
					showRange: true,
					showPath: true,
					showFuelIndicator: true,
					rangeOpacity: 0.12,
					pathWidth: 2,
				}
			);
		}
	}, [layers, ships, selectedShipId, movementState]);

	useEffect(() => {
		return () => {
			if (graphicsRef.current && layers?.movementVisuals.children.includes(graphicsRef.current)) {
				layers.movementVisuals.removeChild(graphicsRef.current);
			}
		};
	}, [layers]);
}