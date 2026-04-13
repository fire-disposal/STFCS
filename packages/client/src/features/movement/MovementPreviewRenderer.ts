/**
 * 移动预览渲染工具
 *
 * 在 Canvas 中绘制：
 * - 剩余机动范围圈
 * - 预测移动路径
 * - 燃料消耗指示器
 */

import type { MovementCommand, MovementPhase } from "@/store/slices/movementSlice";
import type { ShipState } from "@vt/contracts";
import { Graphics } from "pixi.js";

interface RenderOptions {
	showRange: boolean;
	showPath: boolean;
	showFuelIndicator: boolean;
	rangeOpacity: number;
	pathWidth: number;
}

const defaultOptions: RenderOptions = {
	showRange: true,
	showPath: true,
	showFuelIndicator: true,
	rangeOpacity: 0.15,
	pathWidth: 2,
};

/**
 * 绘制机动范围圈
 */
export function drawMovementRangePreview(
	graphics: Graphics,
	ship: ShipState,
	remainingForward: number,
	remainingStrafe: number,
	options: Partial<RenderOptions> = {}
): void {
	const opts = { ...defaultOptions, ...options };

	if (!opts.showRange) return;

	const { transform, maxSpeed } = ship;
	const { x, y, heading } = transform;

	// 计算最大可达距离（考虑当前剩余燃料）
	const maxReach = remainingForward + remainingStrafe;

	// 绘制外圈（理论最大范围）
	graphics.circle(x, y, maxReach);
	graphics.stroke({ color: 0x4a9eff, alpha: 0.3, width: 1 });

	// 绘制内圈（当前阶段可用范围）
	graphics.circle(x, y, remainingForward);
	graphics.stroke({ color: 0x4a9eff, alpha: 0.5, width: 2 });

	// 填充半透明区域
	graphics.circle(x, y, remainingForward);
	graphics.fill({ color: 0x4a9eff, alpha: opts.rangeOpacity * 0.5 });

	// 绘制方向指示线（船头方向）
	const headingRad = (heading * Math.PI) / 180;
	const forwardX = x + Math.sin(headingRad) * remainingForward;
	const forwardY = y - Math.cos(headingRad) * remainingForward;

	graphics.moveTo(x, y);
	graphics.lineTo(forwardX, forwardY);
	graphics.stroke({ color: 0x4a9eff, alpha: 0.6, width: 2 });

	// 绘制侧移范围线（右舷）
	const rightRad = ((heading + 90) * Math.PI) / 180;
	const strafeX = x + Math.cos(rightRad) * remainingStrafe;
	const strafeY = y + Math.sin(rightRad) * remainingStrafe;

	graphics.moveTo(x, y);
	graphics.lineTo(strafeX, strafeY);
	graphics.stroke({ color: 0x4a9eff, alpha: 0.6, width: 2 });
}

/**
 * 绘制预测移动路径
 */
export function drawPredictedPath(
	graphics: Graphics,
	ship: ShipState,
	command: MovementCommand,
	options: Partial<RenderOptions> = {}
): void {
	const opts = { ...defaultOptions, ...options };

	if (!opts.showPath) return;

	const { transform } = ship;
	let { x, y, heading } = transform;

	const pathPoints: { x: number; y: number }[] = [{ x, y }];

	// 计算前进/后退移动
	if (command.forward !== undefined && command.forward !== 0) {
		const headingRad = (heading * Math.PI) / 180;
		const newX = x + Math.sin(headingRad) * command.forward;
		const newY = y - Math.cos(headingRad) * command.forward;
		pathPoints.push({ x: newX, y: newY });
		x = newX;
		y = newY;
	}

	// 计算侧移移动
	if (command.strafe !== undefined && command.strafe !== 0) {
		const rightRad = ((heading + 90) * Math.PI) / 180;
		const newX = x + Math.cos(rightRad) * command.strafe;
		const newY = y + Math.sin(rightRad) * command.strafe;
		pathPoints.push({ x: newX, y: newY });
		x = newX;
		y = newY;
	}

	// 绘制路径线
	if (pathPoints.length > 1) {
		graphics.moveTo(pathPoints[0].x, pathPoints[0].y);

		for (let i = 1; i < pathPoints.length; i++) {
			graphics.lineTo(pathPoints[i].x, pathPoints[i].y);
		}

		graphics.stroke({ color: 0x2ecc71, alpha: 0.8, width: opts.pathWidth });

		// 绘制终点标记
		const lastPoint = pathPoints[pathPoints.length - 1];
		graphics.circle(lastPoint.x, lastPoint.y, 6);
		graphics.fill({ color: 0x2ecc71, alpha: 0.6 });
		graphics.stroke({ color: 0xffffff, alpha: 0.9, width: 2 });
	}

	// 绘制转向预览
	if (command.turn !== undefined && command.turn !== 0) {
		const turnRad = (command.turn * Math.PI) / 180;
		const arcRadius = 30;
		const startAngle = ((heading - 90) * Math.PI) / 180;
		const endAngle = startAngle + turnRad;

		graphics.arc(x, y, arcRadius, startAngle, endAngle, command.turn < 0);
		graphics.stroke({ color: 0xf1c40f, alpha: 0.8, width: 3 });

		// 绘制转向箭头
		const arrowX = x + Math.cos(endAngle) * arcRadius;
		const arrowY = y + Math.sin(endAngle) * arcRadius;
		graphics.circle(arrowX, arrowY, 4);
		graphics.fill({ color: 0xf1c40f, alpha: 0.9 });
	}
}

/**
 * 绘制燃料消耗指示器（迷你条）
 */
export function drawFuelIndicator(
	graphics: Graphics,
	ship: ShipState,
	phase: MovementPhase,
	fuelUsed: { forward: number; strafe: number; turn: number },
	fuelMax: { forward: number; strafe: number; turn: number },
	options: Partial<RenderOptions> = {}
): void {
	const opts = { ...defaultOptions, ...options };

	if (!opts.showFuelIndicator) return;

	const { transform } = ship;
	const { x, y } = transform;

	// 在舰船下方绘制燃料条
	const barWidth = 60;
	const barHeight = 4;
	const barSpacing = 6;
	const startY = y + 35;

	let barIndex = 0;

	// 前进燃料条
	if (fuelMax.forward > 0) {
		const percent = fuelUsed.forward / fuelMax.forward;
		const usedWidth = barWidth * percent;

		// 背景
		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, barWidth, barHeight);
		graphics.fill({ color: 0x1a1a2e, alpha: 0.8 });

		// 已使用
		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, usedWidth, barHeight);
		graphics.fill({ color: 0xff6f8f, alpha: 0.9 });

		// 边框
		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, barWidth, barHeight);
		graphics.stroke({ color: 0x4a4a6a, alpha: 0.5, width: 1 });

		barIndex++;
	}

	// 侧移燃料条
	if (fuelMax.strafe > 0) {
		const percent = fuelUsed.strafe / fuelMax.strafe;
		const usedWidth = barWidth * percent;

		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, barWidth, barHeight);
		graphics.fill({ color: 0x1a1a2e, alpha: 0.8 });

		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, usedWidth, barHeight);
		graphics.fill({ color: 0x4a9eff, alpha: 0.9 });

		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, barWidth, barHeight);
		graphics.stroke({ color: 0x4a4a6a, alpha: 0.5, width: 1 });

		barIndex++;
	}

	// 转向燃料条
	if (fuelMax.turn > 0) {
		const percent = fuelUsed.turn / fuelMax.turn;
		const usedWidth = barWidth * percent;

		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, barWidth, barHeight);
		graphics.fill({ color: 0x1a1a2e, alpha: 0.8 });

		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, usedWidth, barHeight);
		graphics.fill({ color: 0xf1c40f, alpha: 0.9 });

		graphics.rect(x - barWidth / 2, startY + barIndex * barSpacing, barWidth, barHeight);
		graphics.stroke({ color: 0x4a4a6a, alpha: 0.5, width: 1 });
	}
}

/**
 * 综合绘制函数：一次性绘制所有移动预览元素
 */
export function drawMovementPreview(
	graphics: Graphics,
	ship: ShipState,
	phase: MovementPhase,
	command: MovementCommand,
	remainingFuel: { forward: number; strafe: number; turn: number },
	usedFuel: { forward: number; strafe: number; turn: number },
	maxFuel: { forward: number; strafe: number; turn: number },
	options: Partial<RenderOptions> = {}
): void {
	graphics.clear();

	// 1. 绘制机动范围
	const forwardRemaining = remainingFuel.forward;
	const strafeRemaining = remainingFuel.strafe;
	drawMovementRangePreview(graphics, ship, forwardRemaining, strafeRemaining, options);

	// 2. 绘制预测路径
	drawPredictedPath(graphics, ship, command, options);

	// 3. 绘制燃料指示器
	drawFuelIndicator(graphics, ship, phase, usedFuel, maxFuel, options);
}

/**
 * 计算并绘制可达区域网格
 */
export function drawReachableGrid(
	graphics: Graphics,
	ship: ShipState,
	remainingForward: number,
	remainingStrafe: number,
	gridSize: number = 20,
	options: Partial<RenderOptions> = {}
): void {
	const opts = { ...defaultOptions, ...options };

	if (!opts.showRange) return;

	const { transform, maxSpeed } = ship;
	const { x, y, heading } = transform;

	const headingRad = (heading * Math.PI) / 180;
	const forwardDir = { x: Math.sin(headingRad), y: -Math.cos(headingRad) };
	const rightRad = ((heading + 90) * Math.PI) / 180;
	const strafeDir = { x: Math.cos(rightRad), y: Math.sin(rightRad) };

	// 计算可达区域边界
	const maxForward = remainingForward;
	const maxStrafe = remainingStrafe;

	// 绘制网格点
	for (let f = -maxForward; f <= maxForward; f += gridSize) {
		for (let s = -maxStrafe; s <= maxStrafe; s += gridSize) {
			// 检查是否在可达范围内
			if (Math.abs(f) + Math.abs(s) * 0.5 > maxForward + maxStrafe) continue;

			const worldX = x + forwardDir.x * f + strafeDir.x * s;
			const worldY = y + forwardDir.y * f + strafeDir.y * s;

			const dist = Math.sqrt(f * f + s * s);
			const alpha = 1 - dist / (maxForward + maxStrafe);

			graphics.circle(worldX, worldY, 2);
			graphics.fill({ color: 0x4a9eff, alpha: alpha * 0.5 });
		}
	}
}
