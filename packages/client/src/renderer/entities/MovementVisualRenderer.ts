/**
 * 移动可视化渲染器
 *
 * 在舰船周围绘制移动指示：
 * - Phase A/C: 三条方向线（前、后、左、右），不使用矩形
 * - Phase B: 旋转角度指示（左右夹角线）
 * - 目标点预览：根据滑动条数值显示实际移动目标
 *
 * 规则说明：
 * - Phase A: 前进 maxSpeed*2, 侧移 maxSpeed
 * - Phase B: 转向 maxTurnRate
 * - Phase C: 前进 maxSpeed*2, 侧移 maxSpeed（转向后）
 *
 * 移动模式：
 * - 前向模式：正值=前进，负值=后退
 * - 侧向模式：正值=右移，负值=左移
 * - 一个阶段内锁定方向，不能换向
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipState } from "@/sync/types";
import type { MovementPhaseValue } from "@/state/stores/gameStore";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import { useGameStore } from "@/state/stores";

/** 颜色配置 */
const COLORS = {
	/** 前向线 - 绿色 */
	forwardLine: 0x00ff88,
	/** 后退线 - 红色 */
	backwardLine: 0xff5d7e,
	/** 右移线 - 黄色 */
	rightLine: 0xffce66,
	/** 左移线 - 紫色 */
	leftLine: 0xff7f9f,
	/** 目标点预览 */
	targetPreview: 0x00ff88,
	/** 方向锁定标记 */
	lockMarker: 0xffffff,
	/** 转向范围 */
	turnRange: 0x4a9eff,
};

/** 透明度配置 */
const ALPHA = {
	lineActive: 0.9,
	lineInactive: 0.4,
	targetFill: 0.3,
	targetStroke: 0.8,
	lockMarker: 0.8,
	turnRangeFill: 0.08,
	turnRangeStroke: 0.4,
};

/** 线宽配置 */
const LINE_WIDTH = {
	direction: 2,
	target: 3,
};

/** 移动模式类型 */
export type MoveMode = "forward" | "strafe";

/** 移动方向类型（兼容旧代码） */
export type MoveDirection = "forward" | "left" | "right";

export interface MovementPreviewState {
	/** 当前移动阶段 */
	phase: MovementPhaseValue;
	/** 移动模式：前向或侧向 */
	mode: MoveMode;
	/** 移动量（正负表示方向：前向模式正值前进负值后退，侧向模式正值右移负值左移） */
	value: number;
	/** 转向输入值（度数） */
	turn: number;
	/** 剩余资源 */
	remaining: {
		forward: number;
		strafe: number;
		turn: number;
	};
	/** 是否已锁定方向（本阶段已执行过移动） */
	directionLocked: boolean;
}

export interface MovementVisualOptions {
	/** 是否显示移动可视化 */
	show?: boolean;
	/** 预览状态（从 BattleCommandPanel 同步） */
	preview?: MovementPreviewState;
}

interface MovementGraphicsCache {
	root: Container;
	directionGraphics: Graphics;
	targetGraphics: Graphics;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		phase: MovementPhaseValue;
		mode: MoveMode;
		value: number;
		turn: number;
		remainingForward: number;
		remainingStrafe: number;
		remainingTurn: number;
		directionLocked: boolean;
	};
}

export function useMovementVisualRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	options: MovementVisualOptions = {}
) {
	const cacheRef = useRef<Map<string, MovementGraphicsCache>>(new Map());
	const showMovementRange = useGameStore((state) => state.showMovementRange);
	const show = options.show ?? showMovementRange;
	const preview = options.preview;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const selectedShip = selectedShipId ? ships.find((s) => s.id === selectedShipId) : null;

		// 清理未选中的舰船
		for (const [id, item] of cache) {
			if (id !== selectedShipId) {
				layers.movementVisuals.removeChild(item.root);
				cache.delete(id);
			}
		}

		if (!selectedShip || !show) {
			// 清理当前选中的舰船图形
			const existing = cache.get(selectedShipId ?? "");
			if (existing) {
				layers.movementVisuals.removeChild(existing.root);
				cache.delete(selectedShipId ?? "");
			}
			return;
		}

		const cached = cache.get(selectedShip.id);
		if (!cached) {
			createMovementGraphics(layers, cache, selectedShip, preview);
		} else {
			updateMovementGraphics(cached, selectedShip, preview);
		}

		layers.movementVisuals.visible = show;
	}, [layers, ships, selectedShipId, show, preview]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function createMovementGraphics(
	layers: LayerRegistry,
	cache: Map<string, MovementGraphicsCache>,
	ship: ShipState,
	preview?: MovementPreviewState
): void {
	const root = new Container();
	root.position.set(ship.transform.x, ship.transform.y);
	root.rotation = (ship.transform.heading * Math.PI) / 180;

	const directionGraphics = new Graphics();
	const targetGraphics = new Graphics();

	root.addChild(directionGraphics, targetGraphics);
	layers.movementVisuals.addChild(root);

	drawMovementIndicators(directionGraphics, targetGraphics, ship, preview);

	cache.set(ship.id, {
		root,
		directionGraphics,
		targetGraphics,
		lastState: buildStateSnapshot(ship, preview),
	});
}

function updateMovementGraphics(
	cached: MovementGraphicsCache,
	ship: ShipState,
	preview?: MovementPreviewState
): void {
	const newState = buildStateSnapshot(ship, preview);
	const shouldUpdate = !cached.lastState || needsRedraw(cached.lastState, newState);

	if (shouldUpdate) {
		cached.root.position.set(ship.transform.x, ship.transform.y);
		cached.root.rotation = (ship.transform.heading * Math.PI) / 180;

		drawMovementIndicators(cached.directionGraphics, cached.targetGraphics, ship, preview);
		cached.lastState = newState;
	}
}

function buildStateSnapshot(
	ship: ShipState,
	preview?: MovementPreviewState
): MovementGraphicsCache["lastState"] {
	return {
		x: ship.transform.x,
		y: ship.transform.y,
		heading: ship.transform.heading,
		phase: preview?.phase ?? "PHASE_A",
		mode: preview?.mode ?? "forward",
		value: preview?.value ?? 0,
		turn: preview?.turn ?? 0,
		remainingForward: preview?.remaining.forward ?? ship.maxSpeed * 2,
		remainingStrafe: preview?.remaining.strafe ?? ship.maxSpeed,
		remainingTurn: preview?.remaining.turn ?? ship.maxTurnRate,
		directionLocked: preview?.directionLocked ?? false,
	};
}

function needsRedraw(old: MovementGraphicsCache["lastState"] | undefined, new_: MovementGraphicsCache["lastState"] | undefined): boolean {
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

/**
 * 绘制移动指示器
 */
function drawMovementIndicators(
	directionGraphics: Graphics,
	targetGraphics: Graphics,
	ship: ShipState,
	preview?: MovementPreviewState
): void {
	directionGraphics.clear();
	targetGraphics.clear();

	const phase = preview?.phase ?? ship.movePhase ?? "PHASE_A";
	const remainingForward = preview?.remaining.forward ?? ship.maxSpeed * 2;
	const remainingStrafe = preview?.remaining.strafe ?? ship.maxSpeed;
	const remainingTurn = preview?.remaining.turn ?? ship.maxTurnRate;

	if (phase === "PHASE_A" || phase === "PHASE_C") {
		drawTranslationLines(
			directionGraphics,
			targetGraphics,
			remainingForward,
			remainingStrafe,
			preview?.mode ?? "forward",
			preview?.value ?? 0,
			preview?.directionLocked ?? false
		);
	} else if (phase === "PHASE_B") {
		drawRotationArc(
			directionGraphics,
			targetGraphics,
			remainingTurn,
			preview?.turn ?? 0
		);
	}
}

/**
 * 绘制平移指示器 - 三条方向线
 *
 * 线条颜色：
 * - 前方（上）：绿色
 * - 后方（下）：红色（虚线）
 * - 左侧（左）：紫色
 * - 右侧（右）：黄色
 */
function drawTranslationLines(
	directionGraphics: Graphics,
	targetGraphics: Graphics,
	remainingForward: number,
	remainingStrafe: number,
	mode: MoveMode,
	value: number,
	directionLocked: boolean
): void {
	// 前方线（向上，绿色）
	const isForwardActive = mode === "forward";
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(0, -remainingForward);
	directionGraphics.stroke({
		color: COLORS.forwardLine,
		width: LINE_WIDTH.direction,
		alpha: isForwardActive && value >= 0 ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	// 后方虚线（向下，红色）
	drawDashedLine(directionGraphics, 0, 0, 0, remainingForward, COLORS.backwardLine,
		isForwardActive && value < 0 ? ALPHA.lineActive : ALPHA.lineInactive);

	// 左侧线（向左，紫色）
	const isLeftActive = mode === "strafe" && value < 0;
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(-remainingStrafe, 0);
	directionGraphics.stroke({
		color: COLORS.leftLine,
		width: LINE_WIDTH.direction,
		alpha: isLeftActive ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	// 右侧线（向右，黄色）
	const isRightActive = mode === "strafe" && value > 0;
	directionGraphics.moveTo(0, 0);
	directionGraphics.lineTo(remainingStrafe, 0);
	directionGraphics.stroke({
		color: COLORS.rightLine,
		width: LINE_WIDTH.direction,
		alpha: isRightActive ? ALPHA.lineActive : ALPHA.lineInactive,
	});

	// 绘制目标点
	if (value !== 0) {
		let targetX = 0;
		let targetY = 0;
		let color = COLORS.targetPreview;

		if (mode === "forward") {
			// 前向模式：正值前进（向上），负值后退（向下）
			targetY = -value;
			color = value > 0 ? COLORS.forwardLine : COLORS.backwardLine;
		} else {
			// 侧向模式：正值右移，负值左移
			targetX = value;
			color = value > 0 ? COLORS.rightLine : COLORS.leftLine;
		}

		// 目标点圆圈
		targetGraphics.circle(targetX, targetY, 6);
		targetGraphics.fill({ color, alpha: ALPHA.targetFill });
		targetGraphics.stroke({ color, alpha: ALPHA.targetStroke, width: LINE_WIDTH.target });

		// 连线
		targetGraphics.moveTo(0, 0);
		targetGraphics.lineTo(targetX, targetY);
		targetGraphics.stroke({ color, width: 2, alpha: ALPHA.targetStroke * 0.5 });
	}

	// 方向锁定标记
	if (directionLocked) {
		const lockX = mode === "strafe" ? (value > 0 ? remainingStrafe * 0.3 : -remainingStrafe * 0.3) : 0;
		const lockY = mode === "forward" ? -remainingForward * 0.3 : 0;
		directionGraphics.circle(lockX, lockY, 10);
		directionGraphics.stroke({ color: COLORS.lockMarker, width: 2, alpha: ALPHA.lockMarker });
	}
}

/**
 * 绘制虚线
 */
function drawDashedLine(
	g: Graphics,
	x1: number,
	y1: number,
	x2: number,
	y2: number,
	color: number,
	alpha: number
): void {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len === 0) return;

	const dashLen = 6;
	const gapLen = 4;
	const unitX = dx / len;
	const unitY = dy / len;

	let pos = 0;
	while (pos < len) {
		const startX = x1 + unitX * pos;
		const startY = y1 + unitY * pos;
		const endPos = Math.min(pos + dashLen, len);
		const endX = x1 + unitX * endPos;
		const endY = y1 + unitY * endPos;

		g.moveTo(startX, startY);
		g.lineTo(endX, endY);
		g.stroke({ color, width: LINE_WIDTH.direction, alpha });

		pos += dashLen + gapLen;
	}
}

/**
 * 绘制旋转指示器 - 扇形 + 目标角度线
 */
function drawRotationArc(
	directionGraphics: Graphics,
	targetGraphics: Graphics,
	remainingTurn: number,
	turnInput: number
): void {
	const arcRadius = 50;

	// 左右边界线
	const leftRad = (-remainingTurn * Math.PI) / 180 - Math.PI / 2;
	const rightRad = (remainingTurn * Math.PI) / 180 - Math.PI / 2;

	// 扇形范围
	directionGraphics.moveTo(0, 0);
	directionGraphics.arc(0, 0, arcRadius, leftRad, rightRad);
	directionGraphics.lineTo(0, 0);
	directionGraphics.fill({ color: COLORS.turnRange, alpha: ALPHA.turnRangeFill });
	directionGraphics.stroke({ color: COLORS.turnRange, alpha: ALPHA.turnRangeStroke, width: LINE_WIDTH.direction });

	// 目标角度线
	if (turnInput !== 0) {
		const targetRad = (turnInput * Math.PI) / 180 - Math.PI / 2;
		const targetX = Math.cos(targetRad) * arcRadius;
		const targetY = Math.sin(targetRad) * arcRadius;
		const color = turnInput > 0 ? COLORS.rightLine : COLORS.leftLine;

		targetGraphics.moveTo(0, 0);
		targetGraphics.lineTo(targetX, targetY);
		targetGraphics.stroke({ color, width: LINE_WIDTH.target, alpha: ALPHA.targetStroke });

		targetGraphics.circle(targetX, targetY, 5);
		targetGraphics.fill({ color, alpha: ALPHA.targetFill });
	}
}