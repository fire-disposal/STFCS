/**
 * Token 附加组件系统
 * 提供可扩展的组件化附加组件架构
 */

import { ScalableText } from "@/features/game/utils/TextRenderer";
import type { TokenInfo } from "@vt/types";
import { TokenType } from "@vt/types";
import { Container, Graphics } from "pixi.js";

/**
 * 附加组件类型
 */
export type AddonType =
	| "headingIndicator"
	| "angleDisplay"
	| "armorQuadrants"
	| "hexagonArmor"
	| "shieldIndicator"
	| "weaponArcs"
	| "selectionGlow"
	| "selectionLock"
	| "controlLock"; // 控制权限锁定标识

/**
 * 附加组件配置
 */
export interface AddonConfig {
	type: AddonType;
	enabled?: boolean;
	options?: Record<string, any>;
}

/**
 * 附加组件渲染器接口
 */
export interface AddonRenderer {
	type: AddonType;
	render(token: TokenInfo, config: any, zoom: number): Container;
	update?(container: Container, token: TokenInfo, config: any, zoom: number): void;
}

/**
 * 科幻风格朝向指示器配置
 */
export interface HeadingIndicatorConfig {
	color?: number;
	alpha?: number;
	size?: number;
	style?: "arrow" | "line" | "triangle" | "sci-fi";
	showCenterDot?: boolean;
}

/**
 * 角度指示器配置
 */
export interface AngleDisplayConfig {
	color?: number;
	fontSize?: number;
	position?: "top" | "bottom" | "left" | "right";
	showDegrees?: boolean;
	showCardinal?: boolean;
}

/**
 * 护甲象限显示配置
 */
export interface ArmorQuadrantsConfig {
	showValues?: boolean;
	colorLow?: number;
	colorMedium?: number;
	colorHigh?: number;
	thresholdLow?: number;
	thresholdHigh?: number;
}

/**
 * 六边形护甲渲染配置
 */
export interface HexagonArmorConfig {
	/** 护甲颜色渐变起点（绿色） */
	colorGood?: number;
	/** 护甲颜色渐变中点（黄色） */
	colorMedium?: number;
	/** 护甲颜色渐变终点（红色） */
	colorLow?: number;
	/** 低护甲阈值（0-1） */
	thresholdLow?: number;
	/** 高护甲阈值（0-1） */
	thresholdHigh?: number;
	/** 六边形边线宽度 */
	lineWidth?: number;
	/** 六边形与舰船边缘的距离 */
	padding?: number;
}

/**
 * 创建朝向指示器（科幻简约风格）
 */
export function createHeadingIndicator(
	token: TokenInfo,
	config: HeadingIndicatorConfig = {},
	_zoom: number // 保留参数用于接口一致性
): Container {
	const container = new Container();
	const {
		color = 0x00ffff,
		alpha = 0.9,
		size = 1.2,
		style = "sci-fi",
		showCenterDot = true,
	} = config;

	const tokenSize = token.type === TokenType.STATION ? token.size * 1.5 : token.size;
	const indicatorSize = tokenSize * size;

	if (style === "arrow") {
		// 箭头风格
		const arrow = new Graphics();
		arrow.moveTo(0, -indicatorSize);
		arrow.lineTo(-indicatorSize * 0.3, -indicatorSize * 0.5);
		arrow.lineTo(-indicatorSize * 0.15, -indicatorSize * 0.5);
		arrow.lineTo(-indicatorSize * 0.15, indicatorSize * 0.3);
		arrow.lineTo(indicatorSize * 0.15, indicatorSize * 0.3);
		arrow.lineTo(indicatorSize * 0.15, -indicatorSize * 0.5);
		arrow.lineTo(indicatorSize * 0.3, -indicatorSize * 0.5);
		arrow.closePath();
		arrow.fill({ color, alpha });
		container.addChild(arrow);
	} else if (style === "triangle") {
		// 三角形风格
		const triangle = new Graphics();
		triangle.moveTo(0, -indicatorSize);
		triangle.lineTo(-indicatorSize * 0.4, indicatorSize * 0.5);
		triangle.lineTo(indicatorSize * 0.4, indicatorSize * 0.5);
		triangle.closePath();
		triangle.fill({ color, alpha: alpha * 0.7 });
		triangle.setStrokeStyle({ width: 2, color, alpha });
		triangle.stroke();
		container.addChild(triangle);
	} else if (style === "line") {
		// 线条风格
		const line = new Graphics();
		line.setStrokeStyle({ width: 3, color, alpha });
		line.moveTo(0, -indicatorSize * 0.8);
		line.lineTo(0, indicatorSize * 0.3);
		line.stroke();
		container.addChild(line);
	} else {
		// 科幻风格（默认）- 组合元素
		const sciFiGroup = new Container();

		// 主箭头
		const mainArrow = new Graphics();
		mainArrow.moveTo(0, -indicatorSize);
		mainArrow.lineTo(-indicatorSize * 0.25, -indicatorSize * 0.6);
		mainArrow.lineTo(-indicatorSize * 0.1, -indicatorSize * 0.6);
		mainArrow.lineTo(-indicatorSize * 0.1, indicatorSize * 0.2);
		mainArrow.lineTo(indicatorSize * 0.1, indicatorSize * 0.2);
		mainArrow.lineTo(indicatorSize * 0.1, -indicatorSize * 0.6);
		mainArrow.lineTo(indicatorSize * 0.25, -indicatorSize * 0.6);
		mainArrow.closePath();
		mainArrow.fill({ color, alpha: alpha * 0.8 });
		sciFiGroup.addChild(mainArrow);

		// 两侧装饰线
		const decorLines = new Graphics();
		decorLines.setStrokeStyle({ width: 2, color, alpha: alpha * 0.5 });
		decorLines.moveTo(-indicatorSize * 0.35, -indicatorSize * 0.4);
		decorLines.lineTo(-indicatorSize * 0.35, indicatorSize * 0.1);
		decorLines.moveTo(indicatorSize * 0.35, -indicatorSize * 0.4);
		decorLines.lineTo(indicatorSize * 0.35, indicatorSize * 0.1);
		decorLines.stroke();
		sciFiGroup.addChild(decorLines);

		// 底部基座
		const base = new Graphics();
		base.setStrokeStyle({ width: 2, color, alpha: alpha * 0.6 });
		base.moveTo(-indicatorSize * 0.2, indicatorSize * 0.25);
		base.lineTo(indicatorSize * 0.2, indicatorSize * 0.25);
		base.stroke();
		sciFiGroup.addChild(base);

		container.addChild(sciFiGroup);
	}

	// 中心点
	if (showCenterDot) {
		const centerDot = new Graphics();
		centerDot.circle(0, 0, 3);
		centerDot.fill({ color: 0xffffff, alpha: 0.8 });
		container.addChild(centerDot);
	}

	return container;
}

/**
 * 创建角度指示器（显示当前朝向角度）
 */
export function createAngleDisplay(
	token: TokenInfo,
	config: AngleDisplayConfig = {},
	zoom: number
): Container {
	const container = new Container();
	const {
		color = 0x00ff88,
		fontSize = 10,
		position = "top",
		showDegrees = true,
		showCardinal = false,
	} = config;

	const tokenSize = token.type === TokenType.STATION ? token.size * 1.5 : token.size;
	const heading = Math.round(token.heading % 360);

	// 计算基数方向
	const getCardinalDirection = (angle: number): string => {
		const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
		const index = Math.round(angle / 45) % 8;
		return directions[index];
	};

	// 创建角度文本
	const angleText = showDegrees ? `${heading}°` : "";
	const cardinalText = showCardinal ? getCardinalDirection(heading) : "";
	const fullText = [angleText, cardinalText].filter(Boolean).join(" ");

	// 使用 ScalableText 保持清晰
	const labelText = new ScalableText(fullText, {
		baseFontSize: fontSize,
		keepSize: true,
		styleOptions: {
			fill: color,
			stroke: { color: 0x000000, width: 2 },
			fontWeight: "bold",
		},
	});
	labelText.anchor.set(0.5, 0.5);
	labelText.updateForZoom(zoom);

	// 根据位置设置标签
	const offset = tokenSize + 15;
	switch (position) {
		case "top":
			labelText.position.set(0, -offset);
			break;
		case "bottom":
			labelText.position.set(0, offset);
			break;
		case "left":
			labelText.position.set(-offset, 0);
			break;
		case "right":
			labelText.position.set(offset, 0);
			break;
	}

	// 添加背景框
	const bg = new Graphics();
	const padding = 4;
	const bounds = labelText.getBounds();
	bg.roundRect(
		bounds.x - padding,
		bounds.y - padding,
		bounds.width + padding * 2,
		bounds.height + padding * 2,
		3
	);
	bg.fill({ color: 0x000000, alpha: 0.6 });
	bg.setStrokeStyle({ width: 1, color, alpha: 0.5 });
	bg.stroke();
	container.addChild(bg);

	container.addChild(labelText);

	// 添加角度刻度环（可选）
	const scaleRing = new Graphics();
	const ringRadius = tokenSize * 1.4;
	scaleRing.setStrokeStyle({ width: 1, color, alpha: 0.3 });

	// 绘制 4 个主方向刻度
	for (let i = 0; i < 4; i++) {
		const angle = (i * 90 * Math.PI) / 180;
		const innerR = ringRadius - 3;
		const outerR = ringRadius;
		const x1 = Math.cos(angle) * innerR;
		const y1 = Math.sin(angle) * innerR;
		const x2 = Math.cos(angle) * outerR;
		const y2 = Math.sin(angle) * outerR;
		scaleRing.moveTo(x1, y1);
		scaleRing.lineTo(x2, y2);
	}
	scaleRing.stroke();
	container.addChild(scaleRing);

	return container;
}

/**
 * 创建护甲象限指示器
 */
export function createArmorQuadrantsIndicator(
	token: TokenInfo,
	config: ArmorQuadrantsConfig = {},
	zoom: number
): Container {
	const container = new Container();
	const {
		showValues = true,
		colorLow = 0xef4444,
		colorMedium = 0xf59e0b,
		colorHigh = 0x22c55e,
		thresholdLow = 0.3,
		thresholdHigh = 0.7,
	} = config;

	const metadata = token.metadata as any;
	const armorData = metadata?.armor;

	if (!armorData || !armorData.quadrants) {
		return container;
	}

	const tokenSize = token.size;
	const ringRadius = tokenSize * 0.6;
	const quadrantAngles = {
		FRONT_TOP: { start: -30, end: 30 },
		FRONT_BOTTOM: { start: 30, end: 90 },
		RIGHT_TOP: { start: 90, end: 150 },
		RIGHT_BOTTOM: { start: 150, end: 210 },
		LEFT_BOTTOM: { start: 210, end: 270 },
		LEFT_TOP: { start: 270, end: 330 },
	};

	// 绘制每个象限
	Object.entries(armorData.quadrants).forEach(([quadrant, value]: [string, any]) => {
		const maxArmor = armorData.maxArmor / 6; // 假设平均分配
		const percent = value / maxArmor;

		let color: number;
		if (percent >= thresholdHigh) {
			color = colorHigh;
		} else if (percent >= thresholdLow) {
			color = colorMedium;
		} else {
			color = colorLow;
		}

		const angleConfig = quadrantAngles[quadrant as keyof typeof quadrantAngles];
		if (!angleConfig) return;

		const { start, end } = angleConfig;
		const startRad = (start * Math.PI) / 180;
		const endRad = (end * Math.PI) / 180;

		const segment = new Graphics();
		segment.moveTo(0, 0);
		segment.arc(0, 0, ringRadius, startRad, endRad);
		segment.closePath();
		segment.fill({ color, alpha: 0.6 });
		segment.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.3 });
		segment.stroke();
		container.addChild(segment);

		// 添加数值标签
		if (showValues) {
			const midAngle = (((start + end) / 2) * Math.PI) / 180;
			const labelRadius = ringRadius * 0.7;
			const labelX = Math.cos(midAngle) * labelRadius;
			const labelY = Math.sin(midAngle) * labelRadius;

			const valueText = new ScalableText(`${Math.round(value)}`, {
				baseFontSize: 7,
				keepSize: true,
				styleOptions: {
					fill: 0xffffff,
					stroke: { color: 0x000000, width: 2 },
				},
			});
			valueText.anchor.set(0.5, 0.5);
			valueText.position.set(labelX, labelY);
			valueText.updateForZoom(zoom);
			container.addChild(valueText);
		}
	});

	// 外圈
	const outerRing = new Graphics();
	outerRing.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.5 });
	outerRing.circle(0, 0, ringRadius);
	outerRing.stroke();
	container.addChild(outerRing);

	return container;
}

/**
 * 创建六边形护甲指示器
 * 
 * 功能：
 * - 绘制正六边形，每条边对应一个护甲方向
 * - 根据护甲值/最大值的比例显示颜色（绿→黄→红）
 * - 护甲归零时显示透明灰色
 * 
 * 六边形方向（顺时针，从顶部开始）：
 * 0: FRONT_TOP (前上)
 * 1: RIGHT_TOP (右上)
 * 2: RIGHT_BOTTOM (右下)
 * 3: FRONT_BOTTOM (前下)
 * 4: LEFT_BOTTOM (左下)
 * 5: LEFT_TOP (左上)
 */
export function createHexagonArmorIndicator(
	token: TokenInfo,
	config: HexagonArmorConfig = {},
	zoom: number
): Container {
	const container = new Container();
	const {
		colorGood = 0x22c55e,     // 绿色
		colorMedium = 0xf59e0b,   // 黄色
		colorLow = 0xef4444,      // 红色
		thresholdLow = 0.3,
		thresholdHigh = 0.7,
		lineWidth = 4,
		padding = 8,
	} = config;

	const metadata = token.metadata as any;
	const armorData = metadata?.armor;

	if (!armorData || !armorData.quadrants) {
		return container;
	}

	// 计算六边形半径
	const tokenSize = token.size;
	const hexRadius = tokenSize * 0.5 + padding;

	// 六边形顶点角度（从 -90 度开始，顺时针）
	const hexAngles = [
		-90,   // 0: 顶部 (FRONT_TOP)
		-30,   // 1: 右上 (RIGHT_TOP)
		30,    // 2: 右下 (RIGHT_BOTTOM)
		90,    // 3: 底部 (FRONT_BOTTOM)
		150,   // 4: 左下 (LEFT_BOTTOM)
		210,   // 5: 左上 (LEFT_TOP)
	];

	// 计算六边形顶点
	const vertices = hexAngles.map((angle) => {
		const rad = (angle * Math.PI) / 180;
		return {
			x: Math.cos(rad) * hexRadius,
			y: Math.sin(rad) * hexRadius,
		};
	});

	// 护甲象限顺序（与六边形边对应）
	const armorOrder = [
		"FRONT_TOP",
		"RIGHT_TOP",
		"RIGHT_BOTTOM",
		"FRONT_BOTTOM",
		"LEFT_BOTTOM",
		"LEFT_TOP",
	];

	// 获取最大护甲值（每面）
	const maxArmorPerSide = armorData.maxPerQuadrant || (armorData.maxArmor / 6);

	// 绘制每条边
	armorOrder.forEach((quadrant, index) => {
		const armorValue = armorData.quadrants[quadrant] ?? 0;
		const armorPercent = maxArmorPerSide > 0 ? armorValue / maxArmorPerSide : 0;

		// 计算颜色
		let color: number;
		let alpha: number;

		if (armorValue <= 0) {
			// 护甲归零：透明灰色
			color = 0x888888;
			alpha = 0.2;
		} else if (armorPercent >= thresholdHigh) {
			// 高护甲：绿色
			color = colorGood;
			alpha = 0.9;
		} else if (armorPercent >= thresholdLow) {
			// 中等护甲：黄色
			color = colorMedium;
			alpha = 0.8;
		} else {
			// 低护甲：红色
			color = colorLow;
			alpha = 0.7;
		}

		// 获取边的两个顶点
		const startVertex = vertices[index];
		const endVertex = vertices[(index + 1) % 6];

		// 绘制边
		const edgeGraphics = new Graphics();
		edgeGraphics.setStrokeStyle({
			width: lineWidth,
			color,
			alpha,
		});
		edgeGraphics.moveTo(startVertex.x, startVertex.y);
		edgeGraphics.lineTo(endVertex.x, endVertex.y);
		edgeGraphics.stroke();
		container.addChild(edgeGraphics);

		// 添加护甲数值标签（在边的中点）
		const midX = (startVertex.x + endVertex.x) / 2;
		const midY = (startVertex.y + endVertex.y) / 2;

		// 计算标签位置（向中心偏移）
		const labelOffset = 12;
		const angleToCenter = Math.atan2(-midY, -midX);
		const labelX = midX + Math.cos(angleToCenter) * labelOffset;
		const labelY = midY + Math.sin(angleToCenter) * labelOffset;

		const valueText = new ScalableText(`${Math.round(armorValue)}`, {
			baseFontSize: 8,
			keepSize: true,
			styleOptions: {
				fill: 0xffffff,
				stroke: { color: 0x000000, width: 2 },
				fontWeight: "bold",
			},
		});
		valueText.anchor.set(0.5, 0.5);
		valueText.position.set(labelX, labelY);
		valueText.updateForZoom(zoom);
		container.addChild(valueText);
	});

	// 绘制六边形外框（白色细线）
	const hexagonOutline = new Graphics();
	hexagonOutline.setStrokeStyle({
		width: 1,
		color: 0xffffff,
		alpha: 0.3,
	});
	hexagonOutline.moveTo(vertices[0].x, vertices[0].y);
	for (let i = 1; i < vertices.length; i++) {
		hexagonOutline.lineTo(vertices[i].x, vertices[i].y);
	}
	hexagonOutline.closePath();
	hexagonOutline.stroke();
	container.addChild(hexagonOutline);

	return container;
}

/**
 * 创建选中光晕效果（保留用于向后兼容）
 */
export function createSelectionGlow(token: TokenInfo, _zoom: number): Graphics {
	const tokenSize = token.type === TokenType.STATION ? token.size * 1.5 : token.size;
	const glow = new Graphics();

	// 外光晕
	const outerGlow = new Graphics();
	outerGlow.setStrokeStyle({ width: 4, color: 0xffff00, alpha: 0.5 });
	outerGlow.circle(0, 0, tokenSize + 8);
	outerGlow.stroke();

	// 内光晕
	const innerGlow = new Graphics();
	innerGlow.setStrokeStyle({ width: 2, color: 0xffffff, alpha: 0.8 });
	innerGlow.circle(0, 0, tokenSize + 4);
	innerGlow.stroke();

	glow.addChild(outerGlow);
	glow.addChild(innerGlow);

	return glow;
}

/**
 * 四角锁定样式选中效果配置
 */
export interface SelectionLockConfig {
	/** 锁定框颜色 */
	color?: number;
	/** 锁定框线宽 */
	lineWidth?: number;
	/** 锁定框透明度 */
	alpha?: number;
	/** 角框大小（像素） */
	cornerSize?: number;
	/** 角框突出部分长度 */
	cornerExtension?: number;
	/** 是否显示连接线 */
	showConnectLines?: boolean;
	/** 连接虚线透明度 */
	connectLineAlpha?: number;
	/** 自适应边距 */
	padding?: number;
}

/**
 * 创建四角锁定样式的选中效果
 * 特点：
 * - 四角角框锁定
 * - 自适应内容大小
 * - 可选连接虚线
 */
export function createSelectionLock(
	token: TokenInfo,
	config: SelectionLockConfig = {},
	_zoom: number // 保留参数用于接口一致性
): Graphics {
	const {
		color = 0x00ff88,
		lineWidth = 2,
		alpha = 0.9,
		cornerSize = 20,
		cornerExtension = 8,
		showConnectLines = true,
		connectLineAlpha = 0.4,
		padding = 8,
	} = config;

	const graphics = new Graphics();

	// 根据 token 类型计算大小
	const tokenSize = token.type === TokenType.STATION ? token.size * 1.5 : token.size;
	const halfSize = tokenSize + padding;

	// 计算边界框
	const left = -halfSize;
	const right = halfSize;
	const top = -halfSize;
	const bottom = halfSize;

	// 绘制四个角框（加粗实线）
	graphics.setStrokeStyle({ width: lineWidth, color, alpha });

	// 左上角
	graphics.moveTo(left, top + cornerExtension);
	graphics.lineTo(left, top);
	graphics.lineTo(left + cornerExtension, top);

	// 右上角
	graphics.moveTo(right - cornerExtension, top);
	graphics.lineTo(right, top);
	graphics.lineTo(right, top + cornerExtension);

	// 左下角
	graphics.moveTo(left, bottom - cornerExtension);
	graphics.lineTo(left, bottom);
	graphics.lineTo(left + cornerExtension, bottom);

	// 右下角
	graphics.moveTo(right - cornerExtension, bottom);
	graphics.lineTo(right, bottom);
	graphics.lineTo(right, bottom - cornerExtension);

	graphics.stroke();

	// 绘制连接虚线（可选）
	if (showConnectLines) {
		graphics.setStrokeStyle({
			width: 1,
			color,
			alpha: connectLineAlpha,
			alignment: 0.5,
		});

		// 上边虚线
		graphics.moveTo(left + cornerSize, top);
		graphics.lineTo(right - cornerSize, top);

		// 下边虚线
		graphics.moveTo(left + cornerSize, bottom);
		graphics.lineTo(right - cornerSize, bottom);

		// 左边虚线
		graphics.moveTo(left, top + cornerSize);
		graphics.lineTo(left, bottom - cornerSize);

		// 右边虚线
		graphics.moveTo(right, top + cornerSize);
		graphics.lineTo(right, bottom - cornerSize);

		graphics.stroke();
	}

	// 添加中心点标记（可选，增强视觉中心）
	const centerDot = new Graphics();
	centerDot.circle(0, 0, 3);
	centerDot.fill({ color, alpha: 0.6 });
	graphics.addChild(centerDot);

	return graphics;
}

/**
 * 控制权限锁定标识配置
 * 用于显示当前拥有 Token 控制权限的玩家
 */
export interface ControlLockConfig {
	/** 锁定框颜色 */
	color?: number;
	/** 锁定框线宽 */
	lineWidth?: number;
	/** 锁定框透明度 */
	alpha?: number;
	/** 角框大小（像素） */
	cornerSize?: number;
	/** 角框突出部分长度 */
	cornerExtension?: number;
	/** 是否显示连接线 */
	showConnectLines?: boolean;
	/** 连接虚线透明度 */
	connectLineAlpha?: number;
	/** 自适应边距 */
	padding?: number;
	/** 是否显示控制者名称 */
	showPlayerName?: boolean;
	/** 是否显示 DM 标识 */
	showDMBadge?: boolean;
	/** 名称字体大小 */
	nameFontSize?: number;
	/** 名称背景透明度 */
	nameBackgroundAlpha?: number;
	/** 控制器信息 */
	controller?: {
		playerId: string;
		playerName: string;
		isDMMode: boolean;
	} | null;
}

/**
 * 创建控制权限锁定标识
 * 显示当前拥有 Token 实际操作权限的玩家
 * 特点：
 * - 四角角框锁定
 * - 自适应内容大小
 * - 显示控制者名称（若非本机玩家）
 * - DM 模式标识
 */
export function createControlLock(
	token: TokenInfo,
	config: ControlLockConfig = {},
	_zoom: number // 保留参数用于接口一致性
): Container {
	const {
		color = 0x00ff88,
		lineWidth = 2,
		alpha = 0.95,
		cornerSize = 24,
		cornerExtension = 10,
		showConnectLines = true,
		connectLineAlpha = 0.4,
		padding = 10,
		showPlayerName = true,
		showDMBadge = true,
		nameFontSize = 11,
		nameBackgroundAlpha = 0.7,
		controller,
	} = config;

	const container = new Container();

	// 根据 token 类型计算大小
	const tokenSize = token.type === TokenType.STATION ? token.size * 1.5 : token.size;
	const halfSize = tokenSize + padding;

	// 计算边界框
	const left = -halfSize;
	const right = halfSize;
	const top = -halfSize;
	const bottom = halfSize;

	// 创建四角锁定图形
	const lockGraphics = new Graphics();
	lockGraphics.setStrokeStyle({ width: lineWidth, color, alpha });

	// 左上角
	lockGraphics.moveTo(left, top + cornerExtension);
	lockGraphics.lineTo(left, top);
	lockGraphics.lineTo(left + cornerExtension, top);

	// 右上角
	lockGraphics.moveTo(right - cornerExtension, top);
	lockGraphics.lineTo(right, top);
	lockGraphics.lineTo(right, top + cornerExtension);

	// 左下角
	lockGraphics.moveTo(left, bottom - cornerExtension);
	lockGraphics.lineTo(left, bottom);
	lockGraphics.lineTo(left + cornerExtension, bottom);

	// 右下角
	lockGraphics.moveTo(right - cornerExtension, bottom);
	lockGraphics.lineTo(right, bottom);
	lockGraphics.lineTo(right, bottom - cornerExtension);

	lockGraphics.stroke();

	// 绘制连接虚线（可选）
	if (showConnectLines) {
		lockGraphics.setStrokeStyle({
			width: 1,
			color,
			alpha: connectLineAlpha,
			alignment: 0.5,
		});

		// 上边虚线
		lockGraphics.moveTo(left + cornerSize, top);
		lockGraphics.lineTo(right - cornerSize, top);

		// 下边虚线
		lockGraphics.moveTo(left + cornerSize, bottom);
		lockGraphics.lineTo(right - cornerSize, bottom);

		// 左边虚线
		lockGraphics.moveTo(left, top + cornerSize);
		lockGraphics.lineTo(left, bottom - cornerSize);

		// 右边虚线
		lockGraphics.moveTo(right, top + cornerSize);
		lockGraphics.lineTo(right, bottom - cornerSize);

		lockGraphics.stroke();
	}

	container.addChild(lockGraphics);

	// 添加控制者名称标签
	if (showPlayerName && controller) {
		const nameLabelContainer = new Container();

		// 名称文本
		const nameText = new ScalableText(controller.playerName, {
			baseFontSize: nameFontSize,
			keepSize: true,
			styleOptions: {
				fill: 0xffffff,
				stroke: { color: 0x000000, width: 2 },
				fontWeight: "bold",
			},
		});

		// DM 标识
		let dmBadge: ScalableText | null = null;
		if (showDMBadge && controller.isDMMode) {
			dmBadge = new ScalableText("DM", {
				baseFontSize: nameFontSize - 2,
				keepSize: true,
				styleOptions: {
					fill: 0xffd700,
					stroke: { color: 0x000000, width: 2 },
					fontWeight: "bold",
				},
			});
		}

		// 计算标签尺寸
		const nameBounds = nameText.getBounds();
		const dmWidth = dmBadge ? dmBadge.getBounds().width + 4 : 0;
		const totalWidth = nameBounds.width + dmWidth;
		const totalHeight = Math.max(nameBounds.height, dmBadge ? dmBadge.getBounds().height : 0) + 8;

		// 背景框
		const bg = new Graphics();
		bg.roundRect(-totalWidth / 2 - 6, -totalHeight / 2 - 4, totalWidth + 12, totalHeight + 8, 4);
		bg.fill({ color: 0x000000, alpha: nameBackgroundAlpha });
		bg.setStrokeStyle({ width: 1, color, alpha: 0.5 });
		bg.stroke();
		nameLabelContainer.addChild(bg);

		// 放置文本
		nameText.anchor.set(0.5, 0.5);
		nameText.position.set(-dmWidth / 2, 0);
		nameLabelContainer.addChild(nameText);

		if (dmBadge) {
			dmBadge.anchor.set(0.5, 0.5);
			dmBadge.position.set(totalWidth / 2 - dmWidth / 2 + 2, 0);
			nameLabelContainer.addChild(dmBadge);
		}

		// 放置在顶部
		nameLabelContainer.position.set(0, -halfSize - totalHeight / 2 - 8);
		container.addChild(nameLabelContainer);
	}

	return container;
}

/**
 * 附加组件注册表
 */
// 注意：该文件导出的是具体的渲染器函数（用于 `TokenRenderer` 和 `SelectionLayerRenderer`）。
// 早期存在的通用 `AddonRegistry` / `renderAddons` 未在仓库中被实际使用，已移除以减少维护成本。

// 导出通过各处 `export` 声明完成，故无需重复列出。

