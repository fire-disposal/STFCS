/**
 * 移动可视化组件
 *
 * 在 GameCanvas 上渲染：
 * - 机动范围圈（可达区域）
 * - 转向弧线
 * - 移动路径预览
 */

import type { MovementCommand } from "@/store/slices/movementSlice";
import type { ShipState } from "@vt/types";
import type { Graphics } from "pixi.js";

// 颜色配置
const COLORS = {
	rangeRing: 0x4a9eff, // 蓝色 - 范围圈
	rangeFill: 0x4a9eff40, // 半透明填充
	turnArc: 0xf1c40f, // 黄色 - 转向弧
	movePath: 0x2ecc71, // 绿色 - 移动路径
	invalid: 0xff4a4a, // 红色 - 无效区域
};

export interface MovementVisualsConfig {
	showRange: boolean;
	showTurnArc: boolean;
	showPath: boolean;
	rangeOpacity: number;
}

/**
 * 绘制机动范围圈
 */
export function drawMovementRange(
	graphics: Graphics,
	ship: ShipState,
	maxSpeed: number,
	config: MovementVisualsConfig
): void {
	if (!config.showRange || !ship) return;

	const { rangeRing, rangeFill } = COLORS;
	const alpha = config.rangeOpacity || 0.3;

	graphics.circle(ship.transform.x, ship.transform.y, maxSpeed * 4);
	graphics.setStrokeStyle({ width: 1, color: rangeRing, alpha: 0.5 });
	graphics.stroke();
	graphics.setFillStyle({ color: rangeFill, alpha });
	graphics.fill();

	for (let i = 1; i <= 4; i++) {
		const radius = maxSpeed * i;
		graphics.circle(ship.transform.x, ship.transform.y, radius);
		graphics.setStrokeStyle({ width: 1, color: rangeRing, alpha: 0.2 });
		graphics.stroke();
	}

	graphics.moveTo(ship.transform.x - maxSpeed * 4, ship.transform.y);
	graphics.lineTo(ship.transform.x + maxSpeed * 4, ship.transform.y);
	graphics.moveTo(ship.transform.x, ship.transform.y - maxSpeed * 4);
	graphics.lineTo(ship.transform.x, ship.transform.y + maxSpeed * 4);
	graphics.setStrokeStyle({ width: 1, color: rangeRing, alpha: 0.2 });
	graphics.stroke();
}

/**
 * 绘制转向弧线
 */
export function drawTurnArc(
	graphics: Graphics,
	ship: ShipState,
	turnAngle: number,
	maxTurnRate: number,
	config: MovementVisualsConfig
): void {
	if (!config.showTurnArc || !ship || Math.abs(turnAngle) < 1) return;

	const { turnArc, invalid } = COLORS;
	const isValid = Math.abs(turnAngle) <= maxTurnRate;
	const color = isValid ? turnArc : invalid;

	const arcRadius = 60;
	const startAngle = degToRad(ship.transform.heading - 90);
	const turnRad = degToRad(turnAngle);

	graphics.arc(
		ship.transform.x,
		ship.transform.y,
		arcRadius,
		startAngle,
		startAngle + turnRad,
		turnAngle < 0
	);
	graphics.setStrokeStyle({ width: 3, color, alpha: 0.8 });
	graphics.stroke();

	const arrowAngle = startAngle + turnRad * 0.5;
	const arrowX = ship.transform.x + Math.cos(arrowAngle) * (arcRadius + 10);
	const arrowY = ship.transform.y + Math.sin(arrowAngle) * (arcRadius + 10);

	graphics.beginFill(color, 0.8);
	graphics.drawCircle(arrowX, arrowY, 4);
	graphics.endFill();

	const textAngle = startAngle + turnRad * 0.5;
	const textRadius = arcRadius + 25;
	const textX = ship.transform.x + Math.cos(textAngle) * textRadius;
	const textY = ship.transform.y + Math.sin(textAngle) * textRadius;

	graphics.beginFill(color, 0.5);
	graphics.drawCircle(textX, textY, 3);
	graphics.endFill();
}

/**
 * 绘制移动路径（基于当前阶段的增量移动）
 */
export function drawMovementPath(
	graphics: Graphics,
	ship: ShipState,
	command: MovementCommand,
	currentPhase: string,
	maxSpeed: number,
	maxTurnRate: number,
	config: MovementVisualsConfig
): void {
	if (!config.showPath || !ship) return;

	const { movePath, invalid } = COLORS;
	const isValid =
		(command.forward === undefined || Math.abs(command.forward) <= maxSpeed * 2) &&
		(command.strafe === undefined || Math.abs(command.strafe) <= maxSpeed) &&
		(command.turn === undefined || Math.abs(command.turn) <= maxTurnRate);

	const color = isValid ? movePath : invalid;

	const startPos = { x: ship.transform.x, y: ship.transform.y };
	const headingRad = degToRad(ship.transform.heading);

	if (currentPhase === "PHASE_A" || currentPhase === "PHASE_C") {
		const forward = { x: Math.sin(headingRad), y: -Math.cos(headingRad) };
		const right = { x: Math.cos(headingRad), y: Math.sin(headingRad) };

		const endPos = {
			x: startPos.x + forward.x * (command.forward || 0) + right.x * (command.strafe || 0),
			y: startPos.y + forward.y * (command.forward || 0) + right.y * (command.strafe || 0),
		};

		graphics.moveTo(startPos.x, startPos.y);
		graphics.lineTo(endPos.x, endPos.y);
		graphics.setStrokeStyle({ width: 2, color, alpha: 0.8 });
		graphics.stroke();

		graphics.beginFill(color, 0.8);
		graphics.drawCircle(startPos.x, startPos.y, 5);
		graphics.endFill();

		graphics.beginFill(color, 1);
		graphics.drawCircle(endPos.x, endPos.y, 6);
		graphics.endFill();
	} else if (currentPhase === "PHASE_B" && command.turn) {
		const newHeading = normalizeAngle(ship.transform.heading + command.turn);
		const newHeadingRad = degToRad(newHeading);
		const arrowLength = 30;
		const arrowEnd = {
			x: startPos.x + Math.sin(newHeadingRad) * arrowLength,
			y: startPos.y - Math.cos(newHeadingRad) * arrowLength,
		};

		graphics.moveTo(startPos.x, startPos.y);
		graphics.lineTo(arrowEnd.x, arrowEnd.y);
		graphics.setStrokeStyle({ width: 3, color, alpha: 1 });
		graphics.stroke();

		graphics.beginFill(color, 0.8);
		graphics.drawCircle(startPos.x, startPos.y, 5);
		graphics.endFill();
	}
}

/**
 * 清除移动可视化
 */
export function clearMovementVisuals(graphics: Graphics): void {
	graphics.clear();
}

function degToRad(degrees: number): number {
	return (degrees * Math.PI) / 180;
}

function normalizeAngle(angle: number): number {
	let normalized = angle % 360;
	if (normalized < 0) normalized += 360;
	return normalized;
}
