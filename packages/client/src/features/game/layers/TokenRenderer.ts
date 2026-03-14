import {
	Container,
	Graphics,
	Text,
	TextStyle,
	Point,
	type FederatedPointerEvent,
} from "pixi.js";
import type { TokenInfo } from "@vt/shared/types";
import { ScalableText, createOptimalTextStyle } from "@/features/game/utils/TextRenderer";
import {
	renderAddons,
	createHeadingIndicator,
	createAngleDisplay,
	createArmorQuadrantsIndicator,
	createSelectionGlow,
	type AddonConfig,
	type HeadingIndicatorConfig,
	type AngleDisplayConfig,
	type ArmorQuadrantsConfig,
} from "@/features/game/components/TokenAddons";

/**
 * Token 渲染器配置
 */
export interface TokenRendererConfig {
	selectedTokenId: string | null;
	onTokenClick?: (token: TokenInfo, event: FederatedPointerEvent) => void;
	onTokenDrag?: (token: TokenInfo, dx: number, dy: number) => void;
	zoom: number;
	/** 用于存储可缩放文本的数组（外部管理更新） */
	scalableTexts?: ScalableText[];
	/** 附加组件配置 */
	addons?: AddonConfig[];
	/** 是否显示朝向指示器 */
	showHeadingIndicator?: boolean;
	/** 是否显示角度指示器 */
	showAngleDisplay?: boolean;
	/** 是否显示护甲象限 */
	showArmorQuadrants?: boolean;
}

/**
 * 舰船颜色配置
 */
const TOKEN_COLORS = {
	ship: {
		body: 0x4a9eff,
		bodyAlpha: 0.8,
		stroke: 0xffffff,
		strokeAlpha: 0.5,
		highlight: 0xffff00,
		headingIndicator: 0x00ffff,
		angleDisplay: 0x00ff88,
	},
	station: {
		body: 0xffaa4a,
		bodyAlpha: 0.8,
		stroke: 0xffffff,
		strokeAlpha: 0.5,
		highlight: 0xffff00,
		headingIndicator: 0xff8800,
		angleDisplay: 0xffcc00,
	},
	asteroid: {
		body: 0x8a8aa8,
		bodyAlpha: 0.8,
		stroke: 0xffffff,
		strokeAlpha: 0.5,
		highlight: 0xffff00,
		headingIndicator: 0x888888,
		angleDisplay: 0xaaaaaa,
	},
} as const;

/**
 * 状态条颜色
 */
const STATUS_BAR_COLORS = {
	hull: {
		full: 0x22c55e,
		low: 0xef4444,
		background: 0x1a1a2e,
	},
	flux: {
		soft: 0x3b82f6,
		hard: 0xffffff,
		background: 0x1a1a2e,
	},
} as const;

/**
 * 渲染单个 Token（优化版）
 * - 舰船名称固定显示，不随旋转
 * - 支持组件化附加组件
 */
export function renderToken(
	token: TokenInfo,
	config: TokenRendererConfig
): Container {
	// 创建主容器（位置在 token 中心，但不旋转）
	const rootContainer = new Container();
	rootContainer.position.set(token.position.x, token.position.y);

	// 创建旋转容器（仅包含需要旋转的元素）
	const rotationContainer = new Container();
	rotationContainer.rotation = (token.heading * Math.PI) / 180;
	rootContainer.addChild(rotationContainer);

	const colors = TOKEN_COLORS[token.type] || TOKEN_COLORS.ship;
	const tokenSize = token.type === "station" ? token.size * 1.5 : token.size;

	// 根据 token 类型绘制不同形状（在旋转容器中）
	const tokenBody = new Graphics();

	if (token.type === "ship") {
		drawShipBody(tokenBody, tokenSize, TOKEN_COLORS.ship);
	} else if (token.type === "station") {
		drawStationBody(tokenBody, tokenSize, TOKEN_COLORS.station);
	} else {
		drawAsteroidBody(tokenBody, tokenSize, TOKEN_COLORS.asteroid);
	}

	rotationContainer.addChild(tokenBody);

	// 添加朝向指示器（在旋转容器中）
	if (config.showHeadingIndicator !== false && token.type === "ship") {
		const headingIndicator = createHeadingIndicator(
			token,
			{
				color: colors.headingIndicator,
				style: "sci-fi",
				size: 1.0,
				showCenterDot: true,
			},
			config.zoom
		);
		rotationContainer.addChild(headingIndicator);
	}

	// 添加状态条（Hull 和 Flux）- 在旋转容器中
	if (token.type === "ship") {
		const statusBars = renderShipStatusBars(token, tokenSize, config);
		rotationContainer.addChild(statusBars);
	}

	// 添加护甲象限指示器（在旋转容器中）
	if (config.showArmorQuadrants !== false && token.type === "ship") {
		const metadata = token.metadata as any;
		if (metadata?.armor?.quadrants) {
			const armorIndicator = createArmorQuadrantsIndicator(
				token,
				{ showValues: true },
				config.zoom
			);
			rotationContainer.addChild(armorIndicator);
		}
	}

	// 添加角度指示器（在根容器中，不旋转）
	if (config.showAngleDisplay !== false && token.type === "ship") {
		const angleDisplay = createAngleDisplay(
			token,
			{
				color: colors.angleDisplay,
				position: "top",
				showDegrees: true,
				showCardinal: true,
			},
			config.zoom
		);
		rootContainer.addChild(angleDisplay);
	}

	// 添加 ID 标签（在根容器中，不旋转）
	const label = renderTokenLabel(token, tokenSize, config.zoom);
	rootContainer.addChild(label);

	// 如果是选中的 Token，添加高亮（在根容器中）
	if (token.id === config.selectedTokenId) {
		const highlight = createSelectionGlow(token, config.zoom);
		rootContainer.addChild(highlight);
	}

	// 添加交互（在根容器上）
	setupTokenInteraction(rootContainer, token, config);

	return rootContainer;
}

/**
 * 绘制舰船主体
 */
function drawShipBody(graphics: Graphics, size: number, colors: typeof TOKEN_COLORS.ship): void {
	const points = [
		new Point(size, 0),
		new Point(-size * 0.5, size * 0.4),
		new Point(-size * 0.3, 0),
		new Point(-size * 0.5, -size * 0.4),
	];

	graphics.poly(points);
	graphics.fill({ color: colors.body, alpha: colors.bodyAlpha });

	const centerLine = new Graphics();
	centerLine.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.3 });
	centerLine.moveTo(-size * 0.3, 0);
	centerLine.lineTo(size, 0);
	centerLine.stroke();
	graphics.addChild(centerLine);

	graphics.setStrokeStyle({ width: 2, color: colors.stroke, alpha: colors.strokeAlpha });
	graphics.circle(0, 0, size + 2);
	graphics.stroke();
}

/**
 * 绘制空间站主体
 */
function drawStationBody(graphics: Graphics, size: number, colors: typeof TOKEN_COLORS.station): void {
	graphics.circle(0, 0, size);
	graphics.fill({ color: colors.body, alpha: colors.bodyAlpha });

	const ring = new Graphics();
	ring.setStrokeStyle({ width: 3, color: colors.stroke, alpha: colors.strokeAlpha });
	ring.circle(0, 0, size * 0.7);
	ring.stroke();
	graphics.addChild(ring);

	graphics.setStrokeStyle({ width: 2, color: colors.stroke, alpha: colors.strokeAlpha });
	graphics.circle(0, 0, size + 2);
	graphics.stroke();
}

/**
 * 绘制小行星主体
 */
function drawAsteroidBody(graphics: Graphics, size: number, colors: typeof TOKEN_COLORS.asteroid): void {
	const points: Point[] = [];
	const segments = 8;
	for (let i = 0; i < segments; i++) {
		const angle = (i / segments) * Math.PI * 2;
		const variance = 0.8 + Math.random() * 0.4;
		const r = size * variance;
		points.push(new Point(Math.cos(angle) * r, Math.sin(angle) * r));
	}

	graphics.poly(points);
	graphics.fill({ color: colors.body, alpha: colors.bodyAlpha });

	graphics.setStrokeStyle({ width: 2, color: colors.stroke, alpha: colors.strokeAlpha });
	graphics.poly(points);
	graphics.stroke();
}

/**
 * 渲染舰船状态条
 */
function renderShipStatusBars(
	token: TokenInfo,
	tokenSize: number,
	config: TokenRendererConfig
): Container {
	const container = new Container();
	const metadata = token.metadata as any;
	const hullData = metadata?.hull;
	const fluxData = metadata?.flux;

	const barWidth = tokenSize * 2.5;
	const barHeight = 4;
	const gap = 6;

	if (hullData) {
		const hullBar = renderStatusBar(
			hullData.current,
			hullData.max,
			barWidth,
			barHeight,
			STATUS_BAR_COLORS.hull,
			config.zoom,
			config.scalableTexts
		);
		hullBar.position.set(-barWidth / 2, -(tokenSize + gap + barHeight / 2));
		container.addChild(hullBar);
	}

	if (fluxData) {
		const fluxBar = renderFluxBar(
			fluxData.softFlux,
			fluxData.hardFlux,
			fluxData.capacity,
			barWidth,
			barHeight,
			config.zoom,
			config.scalableTexts
		);
		fluxBar.position.set(-barWidth / 2, -(tokenSize + gap * 2 + barHeight));
		container.addChild(fluxBar);
	}

	return container;
}

/**
 * 渲染状态条
 */
function renderStatusBar(
	current: number,
	max: number,
	width: number,
	height: number,
	colors: typeof STATUS_BAR_COLORS.hull,
	zoom: number,
	scalableTexts?: ScalableText[]
): Container {
	const container = new Container();
	const background = new Graphics();
	background.roundRect(-width / 2, -height / 2, width, height, 2);
	background.fill({ color: colors.background, alpha: 0.8 });
	container.addChild(background);

	const percent = Math.max(0, Math.min(1, current / max));
	const barColor = percent > 0.3 ? colors.full : colors.low;

	const fill = new Graphics();
	fill.roundRect(-width / 2, -height / 2, width * percent, height, 2);
	fill.fill({ color: barColor, alpha: 0.9 });
	container.addChild(fill);

	const border = new Graphics();
	border.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
	border.roundRect(-width / 2, -height / 2, width, height, 2);
	border.stroke();
	container.addChild(border);

	// 使用 ScalableText 避免缩放模糊
	const text = new ScalableText(`${Math.ceil(current)}/${max}`, {
		baseFontSize: 8,
		keepSize: true, // 保持屏幕大小不变
		styleOptions: {
			fill: 0xffffff,
			stroke: { color: 0x000000, width: 2 },
		},
	});
	text.anchor.set(0.5, 0.5);
	text.position.set(0, -height);
	text.updateForZoom(zoom);

	if (scalableTexts) {
		scalableTexts.push(text);
	}

	container.addChild(text);

	return container;
}

/**
 * 渲染辐能条
 */
function renderFluxBar(
	softFlux: number,
	hardFlux: number,
	capacity: number,
	width: number,
	height: number,
	zoom: number,
	scalableTexts?: ScalableText[]
): Container {
	const container = new Container();
	const totalFlux = softFlux + hardFlux;

	const background = new Graphics();
	background.roundRect(-width / 2, -height / 2, width, height, 2);
	background.fill({ color: STATUS_BAR_COLORS.flux.background, alpha: 0.8 });
	container.addChild(background);

	if (hardFlux > 0) {
		const hardPercent = hardFlux / capacity;
		const hardFill = new Graphics();
		hardFill.roundRect(-width / 2, -height / 2, width * hardPercent, height, 2);
		hardFill.fill({ color: STATUS_BAR_COLORS.flux.hard, alpha: 0.9 });
		container.addChild(hardFill);
	}

	if (softFlux > 0) {
		const softStart = hardFlux / capacity;
		const softPercent = softFlux / capacity;
		const softFill = new Graphics();
		softFill.roundRect(
			-width / 2 + width * softStart,
			-height / 2,
			width * softPercent,
			height,
			2
		);
		softFill.fill({ color: STATUS_BAR_COLORS.flux.soft, alpha: 0.9 });
		container.addChild(softFill);
	}

	const border = new Graphics();
	border.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.5 });
	border.roundRect(-width / 2, -height / 2, width, height, 2);
	border.stroke();
	container.addChild(border);

	// 使用 ScalableText 避免缩放模糊
	const text = new ScalableText(`${Math.ceil(totalFlux)}/${capacity}`, {
		baseFontSize: 8,
		keepSize: true,
		styleOptions: {
			fill: 0xffffff,
			stroke: { color: 0x000000, width: 2 },
		},
	});
	text.anchor.set(0.5, 0.5);
	text.position.set(0, -height);
	text.updateForZoom(zoom);

	if (scalableTexts) {
		scalableTexts.push(text);
	}

	container.addChild(text);

	return container;
}

/**
 * 渲染 Token 标签（固定显示，不随旋转）
 */
function renderTokenLabel(
	token: TokenInfo,
	tokenSize: number,
	zoom: number
): Container {
	const container = new Container();

	// 使用 ScalableText 避免缩放模糊
	const label = new ScalableText(`${token.metadata?.name || `ID: ${token.id.slice(0, 6)}`}`, {
		baseFontSize: 10,
		keepSize: true, // 保持屏幕大小不变
		styleOptions: {
			fill: 0xaaccff,
			stroke: { color: 0x000000, width: 2 },
		},
	});
	label.anchor.set(0.5, 0);
	label.position.set(0, tokenSize + 12);
	label.updateForZoom(zoom);

	// 添加背景框
	const bg = new Graphics();
	const padding = 4;
	const bounds = label.getBounds();
	bg.roundRect(
		bounds.x - padding,
		bounds.y - padding,
		bounds.width + padding * 2,
		bounds.height + padding * 2,
		3
	);
	bg.fill({ color: 0x000000, alpha: 0.5 });
	container.addChild(bg);

	container.addChild(label);

	return container;
}

/**
 * 设置 Token 交互
 */
function setupTokenInteraction(
	container: Container,
	token: TokenInfo,
	config: TokenRendererConfig
): void {
	container.eventMode = "static";
	container.cursor = "pointer";

	let isDragging = false;
	let dragStartPos = { x: 0, y: 0 };
	let tokenStartPos = { x: token.position.x, y: token.position.y };

	container.on("pointerdown", (event: FederatedPointerEvent) => {
		event.stopPropagation();

		if (config.onTokenClick) {
			config.onTokenClick(token, event);
		}

		isDragging = true;
		dragStartPos = { x: event.global.x, y: event.global.y };
		tokenStartPos = { x: token.position.x, y: token.position.y };
	});

	container.on("pointermove", (event: FederatedPointerEvent) => {
		if (isDragging && config.onTokenDrag) {
			const dx = (event.global.x - dragStartPos.x) / config.zoom;
			const dy = (event.global.y - dragStartPos.y) / config.zoom;
			config.onTokenDrag(token, dx, dy);
		}
	});

	container.on("pointerup", () => {
		isDragging = false;
	});

	container.on("pointerupoutside", () => {
		isDragging = false;
	});
}

/**
 * 渲染所有 Token
 */
export function renderAllTokens(
	layer: Container,
	tokens: Record<string, TokenInfo>,
	config: TokenRendererConfig
): void {
	layer.removeChildren();

	// 收集所有可缩放文本
	const scalableTexts: ScalableText[] = [];
	const configWithTexts = { ...config, scalableTexts };

	Object.values(tokens).forEach((token) => {
		const tokenContainer = renderToken(token, configWithTexts);
		layer.addChild(tokenContainer);
	});

	// 存储文本引用以便后续更新
	if (config.scalableTexts) {
		config.scalableTexts.push(...scalableTexts);
	}
}

// 重新导出附加组件相关类型和函数
export {
	renderAddons,
	createHeadingIndicator,
	createAngleDisplay,
	createArmorQuadrantsIndicator,
	createSelectionGlow,
	type AddonConfig,
	type HeadingIndicatorConfig,
	type AngleDisplayConfig,
	type ArmorQuadrantsConfig,
} from "@/features/game/components/TokenAddons";
