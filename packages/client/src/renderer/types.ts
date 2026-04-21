/**
 * 渲染层类型定义
 *
 * 定义所有渲染相关的类型：
 * - ShipViewModel: 舰船视图模型（适配 ShipRuntime）
 * - RenderContext: 渲染上下文（相机参数）
 * - MovementPreviewState: 移动预览状态
 * - 各渲染选项类型
 */

import type { ShipRuntime, MovementPhase } from "@vt/data";

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
	movePhase?: MovementPhase | undefined;
	movementUsed?: {
		phaseAForward: number;
		phaseAStrafe: number;
		phaseTurn: number;
		phaseCForward: number;
		phaseCStrafe: number;
	};
	selected?: boolean;
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