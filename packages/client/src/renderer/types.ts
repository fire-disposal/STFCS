/**
 * 渲染层类型定义
 */

import type { ShipRuntime } from "@vt/data";
import type { MovePhaseUIValue } from "@/types";

export type ShipViewModel = ShipRuntime & {
	id: string;
	name?: string;
	hullId?: string;
	hullMax?: number;
	width?: number;
	length?: number;
	fluxCapacity?: number;
	shieldRadius?: number;
	shieldArc?: number;
	maxSpeed?: number;
	maxTurnRate?: number;
	movePhase?: MovePhaseUIValue;
	movementUsed?: {
		phaseAForward: number;
		phaseAStrafe: number;
		phaseTurn: number;
		phaseCForward: number;
		phaseCStrafe: number;
	};
};

export interface RenderContext {
	zoom: number;
	x: number;
	y: number;
	viewRotation: number;
	canvasWidth: number;
	canvasHeight: number;
}

export interface ShipRenderOptions {
	onSelectShip?: (shipId: string) => void;
	setMouseWorldPosition?: (x: number, y: number) => void;
	storeSelectShip?: (shipId: string) => void;
}

export interface ShipHUDRenderOptions {
	defaultHullMax?: number;
}

export interface ShieldArcOptions {
	defaultRadius?: number;
	defaultArc?: number;
}

export interface FluxIndicatorOptions {
	defaultCapacity?: number;
}

export type MoveMode = "forward" | "strafe";

export interface MovementPreviewState {
	phase: MovePhaseUIValue;
	mode: MoveMode;
	value: number;
	turn: number;
	remaining: {
		forward: number;
		strafe: number;
		turn: number;
	};
	directionLocked: boolean;
}