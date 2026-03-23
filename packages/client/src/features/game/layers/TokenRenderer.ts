import {
	Container,
	Graphics,
	Point,
	type FederatedPointerEvent,
} from "pixi.js";
import type { TokenInfo } from "@vt/shared/types";
import { ScalableText } from "@/features/game/utils/TextRenderer";
import {
	createHeadingIndicator,
	createAngleDisplay,
	createArmorQuadrantsIndicator,
	createSelectionLock,
	type AddonConfig,
} from "@/features/game/components/TokenAddons";

/**
 * Token 渲染器配置
 */
export interface TokenRendererConfig {
	selectedTokenId: string | null;
	onTokenClick?: (token: TokenInfo, event: FederatedPointerEvent) => void;
	onTokenDragStart?: (token: TokenInfo) => void;
	onTokenDrag?: (token: TokenInfo, newPosition: { x: number; y: number }) => void;
	onTokenDragEnd?: (token: TokenInfo, finalPosition: { x: number; y: number }, cancelled: boolean) => void;
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

type ShipGeometryStyle = "arrowhead" | "frigate" | "destroyer" | "cruiser" | "capital";

interface ShipGeometryPreset {
	style: ShipGeometryStyle;
	points: Point[];
	engineNozzles: Point[];
}

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
		drawShipBody(tokenBody, token, tokenSize, TOKEN_COLORS.ship);
	} else if (token.type === "station") {
		drawStationBody(tokenBody, tokenSize, TOKEN_COLORS.station);
	} else {
		drawAsteroidBody(tokenBody, token, tokenSize, TOKEN_COLORS.asteroid);
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

	// 如果是本地选中的 Token，添加四角锁定高亮（在根容器中）
	// 注意：控制权限锁定在 SelectionLayer 中绘制，这里只绘制本地选中高亮
	if (token.id === config.selectedTokenId) {
		const lockHighlight = createSelectionLock(token, {
			color: 0x00ff88, // 绿色表示本地选中
			lineWidth: 2,
			alpha: 0.95,
			cornerSize: 24,
			cornerExtension: 10,
			showConnectLines: true,
			connectLineAlpha: 0.4,
			padding: 10,
		}, config.zoom);
		rootContainer.addChild(lockHighlight);
	}

	// 添加交互（在根容器上）
	setupTokenInteraction(rootContainer, token, config);

	return rootContainer;
}

/**
 * 绘制舰船主体
 */
function drawShipBody(
	graphics: Graphics,
	token: TokenInfo,
	size: number,
	colors: typeof TOKEN_COLORS.ship
): void {
	const geometry = resolveShipGeometry(token, size);
	graphics.poly(geometry.points);
	graphics.fill({ color: colors.body, alpha: colors.bodyAlpha });

	const contour = new Graphics();
	contour.setStrokeStyle({ width: 2, color: colors.stroke, alpha: colors.strokeAlpha });
	contour.poly(geometry.points);
	contour.stroke();
	graphics.addChild(contour);

	const centerLine = new Graphics();
	centerLine.setStrokeStyle({ width: 1, color: 0xffffff, alpha: 0.35 });
	centerLine.moveTo(-size * 0.55, 0);
	centerLine.lineTo(size * 0.92, 0);
	centerLine.stroke();
	graphics.addChild(centerLine);

	const canopy = new Graphics();
	canopy.ellipse(size * 0.24, 0, size * 0.2, size * 0.12);
	canopy.fill({ color: 0xd7f3ff, alpha: 0.45 });
	graphics.addChild(canopy);

	const engineGlow = new Graphics();
	for (const nozzle of geometry.engineNozzles) {
		engineGlow.circle(nozzle.x, nozzle.y, size * 0.085);
	}
	engineGlow.fill({ color: 0x7dd3fc, alpha: 0.55 });
	graphics.addChild(engineGlow);

	graphics.setStrokeStyle({ width: 2, color: colors.stroke, alpha: colors.strokeAlpha });
	graphics.circle(0, 0, size + 2);
	graphics.stroke();
}

function resolveShipGeometry(token: TokenInfo, size: number): ShipGeometryPreset {
	const metadata = token.metadata as Record<string, unknown> | undefined;
	const explicitStyle = metadata?.shipGeometryStyle;
	if (isShipGeometryStyle(explicitStyle)) {
		return createShipGeometryPreset(explicitStyle, size);
	}

	const hullClass = metadata?.hullClass;
	if (typeof hullClass === "string") {
		if (hullClass === "frigate") return createShipGeometryPreset("frigate", size);
		if (hullClass === "destroyer") return createShipGeometryPreset("destroyer", size);
		if (hullClass === "cruiser") return createShipGeometryPreset("cruiser", size);
		if (hullClass === "capital") return createShipGeometryPreset("capital", size);
	}

	if (size <= 56) return createShipGeometryPreset("frigate", size);
	if (size <= 70) return createShipGeometryPreset("destroyer", size);
	if (size <= 86) return createShipGeometryPreset("cruiser", size);
	return createShipGeometryPreset("capital", size);
}

function createShipGeometryPreset(style: ShipGeometryStyle, size: number): ShipGeometryPreset {
	switch (style) {
		case "frigate":
			return {
				style,
				points: [
					new Point(size * 0.98, 0),
					new Point(size * 0.24, size * 0.4),
					new Point(-size * 0.68, size * 0.28),
					new Point(-size * 0.48, 0),
					new Point(-size * 0.68, -size * 0.28),
					new Point(size * 0.24, -size * 0.4),
				],
				engineNozzles: [new Point(-size * 0.62, -size * 0.15), new Point(-size * 0.62, size * 0.15)],
			};
		case "destroyer":
			return {
				style,
				points: [
					new Point(size, 0),
					new Point(size * 0.42, size * 0.35),
					new Point(-size * 0.25, size * 0.47),
					new Point(-size * 0.72, size * 0.23),
					new Point(-size * 0.55, 0),
					new Point(-size * 0.72, -size * 0.23),
					new Point(-size * 0.25, -size * 0.47),
					new Point(size * 0.42, -size * 0.35),
				],
				engineNozzles: [
					new Point(-size * 0.64, -size * 0.2),
					new Point(-size * 0.68, 0),
					new Point(-size * 0.64, size * 0.2),
				],
			};
		case "cruiser":
			return {
				style,
				points: [
					new Point(size, 0),
					new Point(size * 0.52, size * 0.33),
					new Point(size * 0.18, size * 0.56),
					new Point(-size * 0.36, size * 0.58),
					new Point(-size * 0.82, size * 0.27),
					new Point(-size * 0.68, 0),
					new Point(-size * 0.82, -size * 0.27),
					new Point(-size * 0.36, -size * 0.58),
					new Point(size * 0.18, -size * 0.56),
					new Point(size * 0.52, -size * 0.33),
				],
				engineNozzles: [
					new Point(-size * 0.72, -size * 0.24),
					new Point(-size * 0.76, 0),
					new Point(-size * 0.72, size * 0.24),
				],
			};
		case "capital":
			return {
				style,
				points: [
					new Point(size, 0),
					new Point(size * 0.62, size * 0.35),
					new Point(size * 0.32, size * 0.62),
					new Point(-size * 0.12, size * 0.66),
					new Point(-size * 0.62, size * 0.5),
					new Point(-size * 0.92, size * 0.22),
					new Point(-size * 0.78, 0),
					new Point(-size * 0.92, -size * 0.22),
					new Point(-size * 0.62, -size * 0.5),
					new Point(-size * 0.12, -size * 0.66),
					new Point(size * 0.32, -size * 0.62),
					new Point(size * 0.62, -size * 0.35),
				],
				engineNozzles: [
					new Point(-size * 0.86, -size * 0.24),
					new Point(-size * 0.9, 0),
					new Point(-size * 0.86, size * 0.24),
				],
			};
		default:
			return {
				style: "arrowhead",
				points: [
					new Point(size, 0),
					new Point(-size * 0.5, size * 0.4),
					new Point(-size * 0.3, 0),
					new Point(-size * 0.5, -size * 0.4),
				],
				engineNozzles: [new Point(-size * 0.42, 0)],
			};
	}
}

function isShipGeometryStyle(value: unknown): value is ShipGeometryStyle {
	return (
		typeof value === "string" &&
		(value === "arrowhead" ||
			value === "frigate" ||
			value === "destroyer" ||
			value === "cruiser" ||
			value === "capital")
	);
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
function drawAsteroidBody(
	graphics: Graphics,
	token: TokenInfo,
	size: number,
	colors: typeof TOKEN_COLORS.asteroid
): void {
	const points: Point[] = [];
	const segments = 8;
	const seed = stringHash(`${token.id}:${size}`);
	for (let i = 0; i < segments; i++) {
		const angle = (i / segments) * Math.PI * 2;
		const variance = 0.8 + seededRandom(seed + i) * 0.4;
		const r = size * variance;
		points.push(new Point(Math.cos(angle) * r, Math.sin(angle) * r));
	}

	graphics.poly(points);
	graphics.fill({ color: colors.body, alpha: colors.bodyAlpha });

	graphics.setStrokeStyle({ width: 2, color: colors.stroke, alpha: colors.strokeAlpha });
	graphics.poly(points);
	graphics.stroke();
}

function stringHash(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (hash << 5) - hash + value.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash);
}

function seededRandom(seed: number): number {
	const x = Math.sin(seed) * 10000;
	return x - Math.floor(x);
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
 * 设置 Token 交互（优化版）
 * - 精确的拖拽计算
 * - 视觉反馈（拖拽预览、高亮）
 * - 与全局交互系统协同
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
	let dragPreview: Graphics | null = null;

	// 创建拖拽预览（半透明虚影）
	const createDragPreview = () => {
		if (dragPreview) return;
		
		dragPreview = new Graphics();
		dragPreview.alpha = 0.5;
		dragPreview.zIndex = 100; // 确保在最上层
		
		// 根据 token 类型绘制预览形状
		const tokenSize = token.type === "station" ? token.size * 1.5 : token.size;
		
		if (token.type === "ship") {
			dragPreview.circle(0, 0, tokenSize);
			dragPreview.fill({ color: 0xffffff, alpha: 0.3 });
			dragPreview.setStrokeStyle({ width: 2, color: 0xffff00, alpha: 0.8 });
			dragPreview.stroke();
		} else if (token.type === "station") {
			dragPreview.circle(0, 0, tokenSize);
			dragPreview.fill({ color: 0xffffff, alpha: 0.3 });
			dragPreview.setStrokeStyle({ width: 2, color: 0xffaa00, alpha: 0.8 });
			dragPreview.stroke();
		} else {
			dragPreview.circle(0, 0, tokenSize);
			dragPreview.fill({ color: 0xffffff, alpha: 0.3 });
			dragPreview.setStrokeStyle({ width: 2, color: 0x888888, alpha: 0.8 });
			dragPreview.stroke();
		}
		
		container.parent?.addChild(dragPreview);
	};

	// 更新拖拽预览位置
	const updateDragPreview = (screenX: number, screenY: number) => {
		if (!dragPreview) return;
		dragPreview.position.set(screenX, screenY);
	};

	// 移除拖拽预览
	const removeDragPreview = () => {
		if (dragPreview && container.parent) {
			container.parent.removeChild(dragPreview);
			dragPreview = null;
		}
	};

	container.on("pointerdown", (event: FederatedPointerEvent) => {
		// 如果按下空格或 Ctrl，不处理 Token 交互（让画布处理）
		if ((event.nativeEvent as any).shiftKey === false) {
			// 检查是否有空格/Ctrl 按下的标志（由外部设置）
			const isPanMode = (globalThis as any).__interactionPanMode === true;
			if (isPanMode) {
				event.stopPropagation();
				return;
			}
		}

		event.stopPropagation();

		if (config.onTokenClick) {
			config.onTokenClick(token, event);
		}

		isDragging = true;
		// 使用屏幕坐标（像素）而不是世界坐标
		dragStartPos = { x: event.global.x, y: event.global.y };
		tokenStartPos = { x: token.position.x, y: token.position.y };

		// 触发拖拽开始回调
		if (config.onTokenDragStart) {
			config.onTokenDragStart(token);
			createDragPreview();
		}
	});

	container.on("pointermove", (event: FederatedPointerEvent) => {
		if (isDragging && config.onTokenDrag) {
			// 关键修复：使用当前 zoom 计算位移，确保拖动速度与视觉一致
			const dx = (event.global.x - dragStartPos.x) / config.zoom;
			const dy = (event.global.y - dragStartPos.y) / config.zoom;
			const newPosition = {
				x: tokenStartPos.x + dx,
				y: tokenStartPos.y + dy,
			};
			config.onTokenDrag(token, newPosition);
			
			// 更新预览位置
			if (dragPreview) {
				updateDragPreview(event.global.x, event.global.y);
			}
		}
	});

	container.on("pointerup", () => {
		if (isDragging && config.onTokenDragEnd) {
			const finalPosition = { x: token.position.x, y: token.position.y };
			// 检查是否是取消（释放位置与开始位置差异很小）
			const dx = finalPosition.x - tokenStartPos.x;
			const dy = finalPosition.y - tokenStartPos.y;
			const distance = Math.sqrt(dx * dx + dy * dy);
			const cancelled = distance < 5; // 小于 5 像素视为取消
			
			removeDragPreview();
			config.onTokenDragEnd(token, finalPosition, cancelled);
		}
		isDragging = false;
	});

	container.on("pointerupoutside", () => {
		if (isDragging && config.onTokenDragEnd) {
			removeDragPreview();
			config.onTokenDragEnd(token, tokenStartPos, true);
		}
		isDragging = false;
	});

	// 悬停效果
	container.on("pointerenter", () => {
		// 可以添加悬停高亮
	});

	container.on("pointerleave", () => {
		// 移除悬停高亮
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
