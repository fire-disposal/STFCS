/**
 * 移动可视化渲染 Hook
 *
 * 职责：
 * 1. 渲染舰船移动预览箭头
 * 2. 显示移动范围（phase A/C forward/strafe）
 * 3. 显示转向范围和锁定标记
 *
 * 渲染层：world.movementVisuals (zIndex 10)
 *
 * 移动阶段可视化：
 * - Phase A: 前进/横移预览（绿色/红色）
 * - Phase C: 前进/横移预览（橙色/粉色）
 * - Turn: 转向范围扇形（蓝色）
 *
 * 颜色编码：
 * - forwardLine: 前进方向（绿色）
 * - backwardLine: 后退方向（红色）
 * - rightLine: 右横移（橙色）
 * - leftLine: 左横移（粉色）
 * - turnRange: 转向范围（蓝色）
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { MovementPreviewState, MoveMode } from "../types";
import type { CombatToken, MovementState, MovementPhase } from "@vt/data";
import { findCollidingShips, getMovementVector } from "@vt/data";
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
	turnFill: 0x4a9eff,
	diamondTarget: 0xffd700,
	aimLine: 0xffd700,
	collisionWarning: 0xff3333,
};

const ALPHA = {
	lineActive: 0.9,
	lineInactive: 0.3,
	targetFill: 0.4,
	targetStroke: 0.9,
	lockMarker: 0.8,
	turnRangeFill: 0.12,
	turnRangeStroke: 0.5,
	diamondFill: 0.6,
	diamondStroke: 1.0,
	aimLine: 0.8,
	aimDotFill: 0.25,
};

const LINE_WIDTH = {
	direction: 2,
	target: 3,
	aim: 2,
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
		phase: MovementPhase | undefined;
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
	ships: CombatToken[],
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
		const selectedShip = ships.find((s) => s.$id === selectedShipId);

		for (const [id, item] of cache) {
			if (id !== selectedShipId) {
				layers.movementVisuals.removeChild(item.root);
				item.directionGraphics.destroy();
				item.targetGraphics.destroy();
				item.root.destroy();
				cache.delete(id);
			}
		}

		if (selectedShip && selectedShip.runtime?.position) {
			const cached = cache.get(selectedShip.$id);
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
			for (const item of cacheRef.current.values()) {
				layers?.movementVisuals.removeChild(item.root);
				item.directionGraphics.destroy();
				item.targetGraphics.destroy();
				item.root.destroy();
			}
			cacheRef.current.clear();
		};
	}, [layers]);
}

function createMovementGraphics(
	layers: LayerRegistry,
	cache: Map<string, MovementGraphicsCache>,
	ship: CombatToken,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE,
	allShips?: CombatToken[]
): void {
	if (!ship.runtime?.position) return;

	const root = new Container();
	root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	root.rotation = (ship.runtime.heading * Math.PI) / 180;

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
		maxTurnRate,
		allShips
	);

	cache.set(ship.$id, {
		root,
		directionGraphics,
		targetGraphics,
		lastState: buildStateSnapshot(ship, preview, maxSpeed, maxTurnRate),
	});
}

function updateMovementGraphics(
	cached: MovementGraphicsCache,
	ship: CombatToken,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE,
	allShips?: CombatToken[]
): void {
	if (!ship.runtime?.position) return;

	const newState = buildStateSnapshot(ship, preview, maxSpeed, maxTurnRate);
	const shouldUpdate = !cached.lastState || needsRedraw(cached.lastState, newState);

	if (shouldUpdate) {
		cached.root.position.set(ship.runtime.position.x, ship.runtime.position.y);
		cached.root.rotation = (ship.runtime.heading * Math.PI) / 180;

		drawMovementIndicators(
			cached.directionGraphics,
			cached.targetGraphics,
			ship,
			preview,
			maxSpeed,
			maxTurnRate,
			allShips
		);
		cached.lastState = newState;
	}
}

function buildStateSnapshot(
	ship: CombatToken,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE
): MovementGraphicsCache["lastState"] {
	return {
		x: ship.runtime?.position?.x ?? 0,
		y: ship.runtime?.position?.y ?? 0,
		heading: ship.runtime?.heading ?? 0,
		phase: preview?.phase ?? getMovePhaseFromMovement(ship.runtime?.movement),
		mode: preview?.mode ?? "forward",
		value: preview?.value ?? 0,
		turn: preview?.turn ?? 0,
		remainingForward: preview?.remaining.forward ?? maxSpeed * 2,
		remainingStrafe: preview?.remaining.strafe ?? maxSpeed,
		remainingTurn: preview?.remaining.turn ?? maxTurnRate,
		directionLocked: preview?.directionLocked ?? false,
	};
}

function getMovePhaseFromMovement(movement?: MovementState): MovementPhase | undefined {
	if (!movement?.currentPhase) return undefined;
	switch (movement.currentPhase) {
		case "A": return "A";
		case "B": return "B";
		case "C": return "C";
		case "DONE": return "DONE";
		default: return undefined;
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
	ship: CombatToken,
	preview?: MovementPreviewState,
	maxSpeed: number = DEFAULT_MAX_SPEED,
	maxTurnRate: number = DEFAULT_MAX_TURN_RATE,
	allShips?: CombatToken[]
): void {
	directionGraphics.clear();
	targetGraphics.clear();

	const phase = preview?.phase ?? getMovePhaseFromMovement(ship.runtime?.movement);
	const remainingForward = preview?.remaining.forward ?? maxSpeed * 2;
	const remainingStrafe = preview?.remaining.strafe ?? maxSpeed;
	const remainingTurn = preview?.remaining.turn ?? maxTurnRate;

	// 碰撞检测：计算预览移动/旋转后的新位置/朝向
	let hasCollision = false;
	if (preview && allShips && allShips.length > 0 && ship.runtime?.position) {
		const shipPos = ship.runtime.position;
		const shipHeading = ship.runtime.heading ?? 0;
		const halfWidth = (ship.spec.width ?? 30) / 2;
		const halfLength = (ship.spec.length ?? 50) / 2;

		if (phase === "A" || phase === "C") {
			const forward = preview.mode === "forward" ? preview.value : 0;
			const strafe = preview.mode === "strafe" ? preview.value : 0;
			const vector = getMovementVector(shipHeading, forward, strafe);
			const newPos = { x: shipPos.x + vector.x, y: shipPos.y + vector.y };
			const colliding = findCollidingShips(newPos, shipHeading, halfWidth, halfLength, ship.$id, allShips);
			hasCollision = colliding.length > 0;
		} else if (phase === "B" && preview.turn !== 0) {
			let newHeading = (shipHeading + preview.turn) % 360;
			if (newHeading < 0) newHeading += 360;
			const colliding = findCollidingShips(shipPos, newHeading, halfWidth, halfLength, ship.$id, allShips);
			hasCollision = colliding.length > 0;
		}
	}

	if (phase === "A" || phase === "C") {
		drawTranslationLines(
			directionGraphics,
			targetGraphics,
			phase === "A" ? remainingForward : remainingStrafe,
			preview?.mode ?? "forward",
			preview?.value ?? 0,
			preview?.directionLocked ?? false,
			hasCollision
		);
	} else if (phase === "B") {
		drawRotationArc(
			directionGraphics,
			targetGraphics,
			remainingTurn,
			preview?.turn ?? 0,
			hasCollision
		);
	}
}

function drawTranslationLines(
	directionGraphics: Graphics,
	targetGraphics: Graphics,
	remaining: number,
	mode: MoveMode,
	value: number,
	directionLocked: boolean,
	hasCollision: boolean = false
): void {
	if (remaining <= 0) return;

	const isForwardActive = mode === "forward";
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(0, -remaining);
	directionGraphics.stroke({
		color: COLORS.forwardLine,
		width: LINE_WIDTH.direction,
		alpha: isForwardActive && value >= 0 ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	drawDashedLine(
		directionGraphics,
		0, 0, 0, remaining,
		COLORS.backwardLine,
		isForwardActive && value < 0 ? ALPHA.lineActive : ALPHA.lineInactive
	);

	const isRightActive = mode === "strafe" && value > 0;
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(remaining, 0);
	directionGraphics.stroke({
		color: COLORS.rightLine,
		width: LINE_WIDTH.direction,
		alpha: isRightActive ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	const isLeftActive = mode === "strafe" && value < 0;
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(-remaining, 0);
	directionGraphics.stroke({
		color: COLORS.leftLine,
		width: LINE_WIDTH.direction,
		alpha: isLeftActive ? ALPHA.lineActive : ALPHA.lineInactive,
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

		// 碰撞警告：将目标标记变为红色
		const finalColor = hasCollision ? COLORS.collisionWarning : color;
		const aimColor = hasCollision ? COLORS.collisionWarning : COLORS.aimLine;

		targetGraphics.moveTo(0, 0);
		targetGraphics.lineTo(targetX, targetY);
		targetGraphics.stroke({
			color: aimColor,
			width: LINE_WIDTH.aim,
			alpha: ALPHA.aimLine,
		});

		targetGraphics.circle(targetX, targetY, 5);
		targetGraphics.fill({ color: aimColor, alpha: ALPHA.aimDotFill });

		const diamondSize = 10;
		drawDiamond(targetGraphics, targetX, targetY, diamondSize, finalColor);
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
	turn: number,
	hasCollision: boolean = false
): void {
	if (remainingTurn <= 0) return;

	const baseAngle = -Math.PI / 2;
	const turnRad = (remainingTurn * Math.PI) / 180;
	const startAngle = baseAngle - turnRad;
	const endAngle = baseAngle + turnRad;
	const arcRadius = 60;

	directionGraphics.moveTo(0, 0);
	directionGraphics.arc(0, 0, arcRadius, startAngle, endAngle);
	directionGraphics.lineTo(0, 0);
	directionGraphics.closePath();
	directionGraphics.fill({ color: COLORS.turnFill, alpha: ALPHA.turnRangeFill });

	directionGraphics.moveTo(arcRadius * Math.cos(startAngle), arcRadius * Math.sin(startAngle));
	directionGraphics.arc(0, 0, arcRadius, startAngle, endAngle);
	directionGraphics.stroke({
		color: COLORS.turnRange,
		width: LINE_WIDTH.direction,
		alpha: ALPHA.turnRangeStroke,
	});

	const leftBorderX = arcRadius * Math.cos(startAngle);
	const leftBorderY = arcRadius * Math.sin(startAngle);
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(leftBorderX, leftBorderY);
	directionGraphics.stroke({ color: COLORS.turnRange, width: 2, alpha: 0.6 });

	const rightBorderX = arcRadius * Math.cos(endAngle);
	const rightBorderY = arcRadius * Math.sin(endAngle);
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(rightBorderX, rightBorderY);
	directionGraphics.stroke({ color: COLORS.turnRange, width: 2, alpha: 0.6 });

	directionGraphics.circle(leftBorderX, leftBorderY, 4);
	directionGraphics.fill({ color: COLORS.turnRange, alpha: 0.8 });
	directionGraphics.circle(rightBorderX, rightBorderY, 4);
	directionGraphics.fill({ color: COLORS.turnRange, alpha: 0.8 });

	if (turn !== 0) {
		const targetAngle = baseAngle + (turn * Math.PI) / 180;
		const tipX = arcRadius * Math.cos(targetAngle);
		const tipY = arcRadius * Math.sin(targetAngle);

		const headX = arcRadius * Math.cos(baseAngle);
		const headY = arcRadius * Math.sin(baseAngle);

		const aimColor = hasCollision ? COLORS.collisionWarning : COLORS.aimLine;
		const targetColor = hasCollision ? COLORS.collisionWarning : COLORS.targetPreview;

		targetGraphics.moveTo(0, 0);
		targetGraphics.lineTo(tipX, tipY);
		targetGraphics.stroke({
			color: aimColor,
			width: LINE_WIDTH.aim,
			alpha: ALPHA.aimLine,
		});

		targetGraphics.moveTo(headX, headY);
		targetGraphics.lineTo(tipX, tipY);
		targetGraphics.stroke({
			color: targetColor,
			width: LINE_WIDTH.target,
			alpha: ALPHA.targetStroke,
		});

		targetGraphics.circle(tipX, tipY, 6);
		targetGraphics.fill({ color: targetColor, alpha: ALPHA.targetFill });
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

function drawDiamond(
	graphics: Graphics,
	x: number,
	y: number,
	size: number,
	color: number
): void {
	// 钻石形：上下左右四个顶点
	const points = [
		x, y - size,        // 上
		x + size, y,        // 右
		x, y + size,        // 下
		x - size, y,        // 左
	];

	graphics.poly(points);
	graphics.fill({ color, alpha: ALPHA.diamondFill });
	graphics.poly(points);
	graphics.stroke({ color, width: 2, alpha: ALPHA.diamondStroke });
}