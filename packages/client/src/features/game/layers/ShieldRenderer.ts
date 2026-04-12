import { Container, Graphics } from "pixi.js";
import type { ShieldSpec } from "@vt/contracts/types";

/**
 * 护盾渲染器配置
 */
export interface ShieldRenderConfig {
	position: { x: number; y: number };
	heading: number;
	shield: ShieldSpec;
	color?: number;
	alpha?: number;
}

/**
 * 默认护盾颜色
 */
const SHIELD_COLORS = {
	front: 0x4a9eff, // 前盾 - 蓝色
	full: 0x9eff4a, // 全盾 - 绿色
	active: 0xffffff, // 激活时高亮
} as const;

/**
 * 渲染护盾
 * @param layer 护盾图层
 * @param config 护盾配置
 */
export function renderShield(layer: Container, config: ShieldRenderConfig): void {
	const { position, heading, shield } = config;

	if (!shield.active) {
		layer.removeChildren();
		return;
	}

	const container = new Container();
	container.position.set(position.x, position.y);
	container.rotation = (heading * Math.PI) / 180;

	const color = shield.type === "front" ? SHIELD_COLORS.front : SHIELD_COLORS.full;
	const alpha = config.alpha ?? 0.3;

	// 绘制护盾弧
	const shieldArc = new Graphics();

	if (shield.type === "front") {
		// 前盾：固定中心点，覆盖前方扇形区域
		drawFrontShield(shieldArc, shield, color, alpha);
	} else {
		// 全盾：自由中心点，360 度覆盖
		drawFullShield(shieldArc, shield, color, alpha);
	}

	container.addChild(shieldArc);

	// 绘制护盾中心点（如果是全盾）
	if (shield.type === "full") {
		const centerMarker = new Graphics();
		centerMarker.circle(shield.centerOffset.x, shield.centerOffset.y, 3);
		centerMarker.fill({ color: SHIELD_COLORS.active, alpha: 0.8 });
		container.addChild(centerMarker);
	}

	layer.addChild(container);
}

/**
 * 绘制前盾
 */
function drawFrontShield(
	graphics: Graphics,
	shield: ShieldSpec,
	color: number,
	alpha: number
): void {
	const { radius, coverageAngle } = shield;

	// 绘制扇形护盾区域
	graphics.moveTo(0, 0);
	graphics.arc(0, 0, radius, -coverageAngle / 2, coverageAngle / 2);
	graphics.closePath();

	// 填充半透明颜色
	graphics.fill({ color, alpha });

	// 绘制护盾边缘
	graphics.setStrokeStyle({ width: 2, color, alpha: alpha * 2 });
	graphics.arc(0, 0, radius, -coverageAngle / 2, coverageAngle / 2);
	graphics.stroke();

	// 绘制角度刻度线
	drawAngleMarkers(graphics, radius, coverageAngle, color, alpha);
}

/**
 * 绘制全盾
 */
function drawFullShield(
	graphics: Graphics,
	shield: ShieldSpec,
	color: number,
	alpha: number
): void {
	const { radius, centerOffset } = shield;

	// 绘制圆形护盾区域（以偏移点为中心）
	graphics.circle(centerOffset.x, centerOffset.y, radius);

	// 填充半透明颜色
	graphics.fill({ color, alpha });

	// 绘制护盾边缘
	graphics.setStrokeStyle({ width: 2, color, alpha: alpha * 2 });
	graphics.circle(centerOffset.x, centerOffset.y, radius);
	graphics.stroke();

	// 绘制中心点到舰船的连线
	graphics.setStrokeStyle({ width: 1, color, alpha: alpha * 0.5 });
	graphics.moveTo(0, 0);
	graphics.lineTo(centerOffset.x, centerOffset.y);
	graphics.stroke();
}

/**
 * 绘制角度刻度线
 */
function drawAngleMarkers(
	graphics: Graphics,
	radius: number,
	coverageAngle: number,
	color: number,
	alpha: number
): void {
	const markerCount = 5;
	const halfAngle = coverageAngle / 2;
	const step = coverageAngle / markerCount;

	for (let i = 0; i <= markerCount; i++) {
		const angle = (-halfAngle + i * step) * (Math.PI / 180);
		const innerR = radius * 0.9;
		const outerR = radius;

		const x1 = Math.cos(angle) * innerR;
		const y1 = Math.sin(angle) * innerR;
		const x2 = Math.cos(angle) * outerR;
		const y2 = Math.sin(angle) * outerR;

		graphics.setStrokeStyle({ width: 1, color, alpha: alpha * 0.5 });
		graphics.moveTo(x1, y1);
		graphics.lineTo(x2, y2);
		graphics.stroke();
	}
}

/**
 * 清除护盾
 */
export function clearShield(layer: Container): void {
	layer.removeChildren();
}

/**
 * 更新护盾
 */
export function updateShield(
	layer: Container,
	config: ShieldRenderConfig
): void {
	renderShield(layer, config);
}
