/**
 * 移动可视化渲染器
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipViewModel, MovementPreviewState, MoveMode } from "../types";
import type { MovementState } from "@vt/data";
import type { MovePhaseUIValue } from "@/types";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

const COLORS = {
	forwardLine: 0x00ff88,
	backwardLine: 0xff5d7e,
	rightLine: 0xffce66,
	leftLine: 0xff7f9f,
	targetPreview: 0x00ff88,
	lockMarker: 0xffffff,
	turnRange: 0x4a9eff,
};

const ALPHA = {
	lineActive: 0.9,
	lineInactive: 0.4,
	targetFill: 0.3,
	targetStroke: 0.8,
	lockMarker: 0.8,
	turnRangeFill: 0.08,
	turnRangeStroke: 0.4,
};

const LINE_WIDTH = {
	direction: 2,
	target: 3,
};

const DEFAULT_MAX_SPEED = 100;
const DEFAULT_MAX_TURN_RATE = 60;

interface MovementGraphicsCache {
	root: Container;
	directionGraphics: Graphics;
	targetGraphics: Graphics;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		phase: MovePhaseUIValue;
		mode: MoveMode;
		value: number;
		turn: number;
		remainingForward: number;
		remainingStrafe: number;
		remainingTurn: number;
		directionLocked: boolean;
	};
}

export interface MovementVisualOptions {
	show?: boolean;
	maxSpeed?: number;
	maxTurnRate?: number;
}

export function useMovementVisualRendering(
	layers: LayerRegistry | null,
	ships: ShipViewModel[],
	selectedShipId: string | null,
	preview?: MovementPreviewState,
	options: MovementVisualOptions = {}
) {
	const cacheRef = useRef<Map<string, MovementGraphicsCache>>(new Map());
	const showMovementRange = useUIStore((state) => state.showMovementRange);
	const show = options.show ?? showMovementRange;
	const defaultMaxSpeed = options.maxSpeed ?? DEFAULT_MAX_SPEED;
	const defaultMaxTurnRate = options.maxTurnRate ?? DEFAULT_MAX_TURN_RATE;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const selectedShip = ships.find((s) => s.id === selectedShipId);

		for (const [id, item] of cache) {
			if (id !== selectedShipId) {
				layers.movementVisuals.removeChild(item.root);
				cache.delete(id);
			}
		}

		if (selectedShip && selectedShip.position) {
			const cached = cache.get(selectedShip.id);
			if (!cached) {
				createMovementGraphics(
					layers,
					cache,
					selectedShip,
					preview,
					defaultMaxSpeed,
					defaultMaxTurnRate
				);
			} else {
				updateMovementGraphics(
					cached,
					selectedShip,
					preview,
					defaultMaxSpeed,
					defaultMaxTurnRate
				);
			}
		}

		layers.movementVisuals.visible = show && !!selectedShip;
	}, [layers, ships, selectedShipId, preview, show, defaultMaxSpeed, defaultMaxTurnRate]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function createMovementGraphics(
	layers: LayerRegistry,
	cache: Map<string, MovementGraphicsCache>,
	ship: ShipViewModel,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE
): void {
	if (!ship.position) return;

	const root = new Container();
	root.position.set(ship.position.x, ship.position.y);
	root.rotation = (ship.heading * Math.PI) / 180;

	const directionGraphics = new Graphics();
	const targetGraphics = new Graphics();

	root.addChild(directionGraphics, targetGraphics);
	layers.movementVisuals.addChild(root);

	drawMovementIndicators(
		directionGraphics,
		targetGraphics,
		ship,
		preview,
		maxSpeed,
		maxTurnRate
	);

	cache.set(ship.id, {
		root,
		directionGraphics,
		targetGraphics,
		lastState: buildStateSnapshot(ship, preview, maxSpeed, maxTurnRate),
	});
}

function updateMovementGraphics(
	cached: MovementGraphicsCache,
	ship: ShipViewModel,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE
): void {
	if (!ship.position) return;

	const newState = buildStateSnapshot(ship, preview, maxSpeed, maxTurnRate);
	const shouldUpdate = !cached.lastState || needsRedraw(cached.lastState, newState);

	if (shouldUpdate) {
		cached.root.position.set(ship.position.x, ship.position.y);
		cached.root.rotation = (ship.heading * Math.PI) / 180;

		drawMovementIndicators(
			cached.directionGraphics,
			cached.targetGraphics,
			ship,
			preview,
			maxSpeed,
			maxTurnRate
		);
		cached.lastState = newState;
	}
}

function buildStateSnapshot(
	ship: ShipViewModel,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE
): MovementGraphicsCache["lastState"] {
	return {
		x: ship.position?.x ?? 0,
		y: ship.position?.y ?? 0,
		heading: ship.heading ?? 0,
		phase: preview?.phase ?? getMovePhaseFromMovement(ship.movement) ?? "NONE",
		mode: preview?.mode ?? "forward",
		value: preview?.value ?? 0,
		turn: preview?.turn ?? 0,
		remainingForward: preview?.remaining.forward ?? maxSpeed * 2,
		remainingStrafe: preview?.remaining.strafe ?? maxSpeed,
		remainingTurn: preview?.remaining.turn ?? maxTurnRate,
		directionLocked: preview?.directionLocked ?? false,
	};
}

function getMovePhaseFromMovement(movement?: MovementState): MovePhaseUIValue {
	if (!movement?.currentPhase) return "NONE";
	switch (movement.currentPhase) {
		case "A": return "A";
		case "B": return "B";
		case "C": return "C";
		case "DONE": return "DONE";
		default: return "NONE";
	}
}

function needsRedraw(
	old: MovementGraphicsCache["lastState"] | undefined,
	new_: MovementGraphicsCache["lastState"] | undefined
): boolean {
	if (!old || !new_) return true;
	return (
		old.x !== new_.x ||
		old.y !== new_.y ||
		old.heading !== new_.heading ||
		old.phase !== new_.phase ||
		old.mode !== new_.mode ||
		old.value !== new_.value ||
		old.turn !== new_.turn ||
		old.remainingForward !== new_.remainingForward ||
		old.remainingStrafe !== new_.remainingStrafe ||
		old.remainingTurn !== new_.remainingTurn ||
		old.directionLocked !== new_.directionLocked
	);
}

function drawMovementIndicators(
	directionGraphics: Graphics,
	targetGraphics: Graphics,
	ship: ShipViewModel,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE
): void {
	directionGraphics.clear();
	targetGraphics.clear();

	const phase = preview?.phase ?? getMovePhaseFromMovement(ship.movement);
	const remainingForward = preview?.remaining.forward ?? maxSpeed * 2;
	const remainingStrafe = preview?.remaining.strafe ?? maxSpeed;
	const remainingTurn = preview?.remaining.turn ?? maxTurnRate;

	if (phase === "A" || phase === "C") {
		drawTranslationLines(
			directionGraphics,
			targetGraphics,
			remainingForward,
			remainingStrafe,
			preview?.mode ?? "forward",
			preview?.value ?? 0,
			preview?.directionLocked ?? false
		);
	} else if (phase === "B") {
		drawRotationArc(
			directionGraphics,
			targetGraphics,
			remainingTurn,
			preview?.turn ?? 0
		);
	}
}

function drawTranslationLines(
	directionGraphics: Graphics,
	targetGraphics: Graphics,
	remainingForward: number,
	remainingStrafe: number,
	mode: MoveMode,
	value: number,
	directionLocked: boolean
): void {
	const isForwardActive = mode === "forward";
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(0, -remainingForward);
	directionGraphics.stroke({
		color: COLORS.forwardLine,
		width: LINE_WIDTH.direction,
		alpha: isForwardActive && value >= 0 ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	drawDashedLine(
		directionGraphics,
		0, 0, 0, remainingForward,
		COLORS.backwardLine,
		isForwardActive && value < 0 ? ALPHA.lineActive : ALPHA.lineInactive
	);

	const isLeftActive = mode === "strafe" && value < 0;
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(-remainingStrafe, 0);
	directionGraphics.stroke({
		color: COLORS.leftLine,
		width: LINE_WIDTH.direction,
		alpha: isLeftActive ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	const isRightActive = mode === "strafe" && value > 0;
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(remainingStrafe, 0);
	directionGraphics.stroke({
		color: COLORS.rightLine,
		width: LINE_WIDTH.direction,
		alpha: isRightActive ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	if (value !== 0) {
		let targetX = 0;
		let targetY = 0;
		let color = COLORS.targetPreview;

		if (mode === "forward") {
			targetY = -value;
			color = value >= 0 ? COLORS.forwardLine : COLORS.backwardLine;
		} else {
			targetX = value;
			color = value >= 0 ? COLORS.rightLine : COLORS.leftLine;
		}

		targetGraphics.circle(targetX, targetY, 8);
		targetGraphics.fill({ color, alpha: ALPHA.targetFill });
		targetGraphics.circle(targetX, targetY, 8);
		targetGraphics.stroke({ color, width: LINE_WIDTH.target, alpha: ALPHA.targetStroke });
	}

	if (directionLocked) {
		targetGraphics.circle(0, 0, 6);
		targetGraphics.stroke({ color: COLORS.lockMarker, width: 2, alpha: ALPHA.lockMarker });
	}
}

function drawRotationArc(
	directionGraphics: Graphics,
	targetGraphics: Graphics,
	remainingTurn: number,
	turn: number
): void {
	const turnRad = (remainingTurn * Math.PI) / 180;

	directionGraphics.arc(0, 0, 50, -turnRad, turnRad);
	directionGraphics.stroke({
		color: COLORS.turnRange,
		width: LINE_WIDTH.direction,
		alpha: ALPHA.turnRangeStroke,
	});

	if (turn !== 0) {
		const targetRad = (turn * Math.PI) / 180;
		const tipX = 50 * Math.sin(targetRad);
		const tipY = -50 * Math.cos(targetRad);

		targetGraphics.moveTo(0, -50);
		targetGraphics.lineTo(tipX, tipY);
		targetGraphics.stroke({
			color: COLORS.targetPreview,
			width: LINE_WIDTH.target,
			alpha: ALPHA.targetStroke,
		});

		targetGraphics.circle(tipX, tipY, 6);
		targetGraphics.fill({ color: COLORS.targetPreview, alpha: ALPHA.targetFill });
	}
}

function drawDashedLine(
	graphics: Graphics,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: number,
	alpha: number,
	dashLength: number = 8,
	gapLength: number = 6
): void {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const totalLength = Math.sqrt(dx * dx + dy * dy);
	const steps = Math.ceil(totalLength / (dashLength + gapLength));

	for (let i = 0; i < steps; i++) {
		const startRatio = i * (dashLength + gapLength) / totalLength;
		const endRatio = Math.min((i * (dashLength + gapLength) + dashLength) / totalLength, 1);

		const startX = x1 + dx * startRatio;
		const startY = y1 + dy * startRatio;
		const endX = x1 + dx * endRatio;
		const endY = y1 + dy * endRatio;

		graphics.moveTo(startX, startY);
		graphics.lineTo(endX, endY);
		graphics.stroke({ color, width: LINE_WIDTH.direction, alpha });
	}
}