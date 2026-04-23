/**
 * 渲染层类型定义
 */

import type { MovementPhase } from "@vt/data";

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
	phase: MovementPhase | undefined;
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