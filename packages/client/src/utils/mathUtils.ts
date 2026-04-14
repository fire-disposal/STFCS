/**
 * 数学工具模块
 *
 * 屏幕坐标转换特有功能
 * 基础数学函数（角度、距离）从 @vt/rules 导入
 */

import { angleBetween, distance, normalizeAngle, toDegrees, toRadians } from "@vt/rules";

export { toRadians, toDegrees, normalizeAngle, distance, angleBetween };

export const normalizeAngleSigned = (angle: number): number => {
	let normalized = angle % 360;
	if (normalized > 180) normalized -= 360;
	else if (normalized < -180) normalized += 360;
	return normalized;
};

export const angleDifference = (from: number, to: number): number => {
	const diff = normalizeAngle(to - from);
	return diff > 180 ? diff - 360 : diff;
};

export const screenToWorld = (
	screenX: number,
	screenY: number,
	zoom: number,
	cameraX: number,
	cameraY: number,
	viewRotation: number
): { x: number; y: number } => {
	const theta = toRadians(viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	const rotatedX = screenX * cos - screenY * sin;
	const rotatedY = screenX * sin + screenY * cos;

	return {
		x: cameraX + rotatedX / zoom,
		y: cameraY + rotatedY / zoom,
	};
};

export const worldToScreen = (
	worldX: number,
	worldY: number,
	zoom: number,
	cameraX: number,
	cameraY: number,
	viewRotation: number
): { x: number; y: number } => {
	const relativeX = (worldX - cameraX) * zoom;
	const relativeY = (worldY - cameraY) * zoom;

	const theta = toRadians(-viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	return {
		x: relativeX * cos - relativeY * sin,
		y: relativeX * sin + relativeY * cos,
	};
};

export const screenDeltaToWorldDelta = (
	screenDx: number,
	screenDy: number,
	zoom: number,
	viewRotation: number
): { x: number; y: number } => {
	const theta = toRadians(viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	const rotatedX = screenDx * cos - screenDy * sin;
	const rotatedY = screenDx * sin + screenDy * cos;

	return {
		x: rotatedX / zoom,
		y: rotatedY / zoom,
	};
};

export const worldDeltaToScreenDelta = (
	worldDx: number,
	worldDy: number,
	zoom: number,
	viewRotation: number
): { x: number; y: number } => {
	const theta = toRadians(viewRotation);
	const cos = Math.cos(theta);
	const sin = Math.sin(theta);

	return {
		x: -(worldDx * cos - worldDy * sin) * zoom,
		y: -(worldDx * sin + worldDy * cos) * zoom,
	};
};

export const angleToPoint = (fromX: number, fromY: number, toX: number, toY: number): number => {
	const dx = toX - fromX;
	const dy = toY - fromY;
	return normalizeAngle(toDegrees(Math.atan2(dy, dx)));
};

export const pointAtAngle = (
	fromX: number,
	fromY: number,
	angle: number,
	dist: number
): { x: number; y: number } => {
	const rad = toRadians(angle);
	return {
		x: fromX + Math.cos(rad) * dist,
		y: fromY + Math.sin(rad) * dist,
	};
};

export const lerpAngle = (from: number, to: number, t: number): number => {
	const diff = angleDifference(from, to);
	return normalizeAngle(from + diff * t);
};

export const clampValue = (value: number, min: number, max: number): number => {
	return Math.max(min, Math.min(max, value));
};

export const lerp = (a: number, b: number, t: number): number => {
	return a + (b - a) * t;
};
