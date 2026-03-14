import { Container, Graphics, Text, TextStyle } from "pixi.js";

/**
 * 网格渲染器配置
 */
export interface GridConfig {
	width: number;
	height: number;
	gridSize?: number;
	gridColor?: number;
	gridAlpha?: number;
	showLabels?: boolean;
	labelDistance?: number;
	showGrid?: boolean;
}

/**
 * 默认网格配置
 */
const DEFAULT_GRID_CONFIG: Omit<GridConfig, "width" | "height"> = {
	gridSize: 100,
	gridColor: 0x2a2a5e,
	gridAlpha: 0.4,
	showLabels: false,
	labelDistance: 500,
	showGrid: true,
};

/**
 * 渲染网格（优化视觉效果）
 * @param layer 网格图层
 * @param config 网格配置
 * @param cameraZoom 相机缩放（用于调整网格粗细）
 */
export function renderGrid(
	layer: Container, 
	config: GridConfig,
	cameraZoom: number = 1
): void {
	layer.removeChildren();

	const cfg = { ...DEFAULT_GRID_CONFIG, ...config };

	if (!cfg.showGrid) {
		return;
	}

	// 根据相机缩放调整网格线粗细
	const lineWidth = Math.max(1, 1.5 / cameraZoom);

	// 创建主网格图形
	const grid = new Graphics();
	grid.setStrokeStyle({ 
		width: lineWidth, 
		color: cfg.gridColor!, 
		alpha: cfg.gridAlpha! 
	});

	// 绘制垂直线
	for (let x = 0; x <= cfg.width; x += cfg.gridSize!) {
		grid.moveTo(x, 0);
		grid.lineTo(x, cfg.height);
	}

	// 绘制水平线
	for (let y = 0; y <= cfg.height; y += cfg.gridSize!) {
		grid.moveTo(0, y);
		grid.lineTo(cfg.width, y);
	}

	grid.stroke();
	layer.addChild(grid);

	// 添加次要网格线（更细）
	const subGridSize = cfg.gridSize! / 2;
	const subGrid = new Graphics();
	subGrid.setStrokeStyle({ 
		width: lineWidth * 0.5, 
		color: cfg.gridColor!, 
		alpha: cfg.gridAlpha! * 0.3 
	});

	// 绘制次要垂直线
	for (let x = subGridSize; x < cfg.width; x += subGridSize) {
		if (x % cfg.gridSize! !== 0) {
			subGrid.moveTo(x, 0);
			subGrid.lineTo(x, cfg.height);
		}
	}

	// 绘制次要水平线
	for (let y = subGridSize; y < cfg.height; y += subGridSize) {
		if (y % cfg.gridSize! !== 0) {
			subGrid.moveTo(0, y);
			subGrid.lineTo(cfg.width, y);
		}
	}

	subGrid.stroke();
	layer.addChild(subGrid);

	// 添加坐标标签（仅在缩放较大时显示）
	if (cfg.showLabels && cameraZoom >= 0.75) {
		renderGridLabels(layer, cfg, cameraZoom);
	}
}

/**
 * 渲染网格标签
 */
function renderGridLabels(layer: Container, config: GridConfig, cameraZoom: number): void {
	const labelStyle = new TextStyle({
		fontSize: Math.max(9, 10 / cameraZoom),
		fill: 0x5a6a9a,
		stroke: { color: 0x000000, width: 2 },
		fontWeight: "500",
	});

	const { width, height, labelDistance } = config;

	for (let x = labelDistance!; x < width; x += labelDistance!) {
		for (let y = labelDistance!; y < height; y += labelDistance!) {
			const label = new Text({ text: `${Math.round(x)},${Math.round(y)}`, style: labelStyle });
			label.position.set(x + 4, y + 4);
			label.alpha = 0.6;
			layer.addChild(label);
		}
	}
}

/**
 * 切换网格显示
 */
export function toggleGridVisibility(layer: Container, config: GridConfig): void {
	config.showGrid = !config.showGrid;
	renderGrid(layer, config);
}

/**
 * 更新网格（当地图尺寸或相机缩放变化时）
 */
export function updateGrid(
	layer: Container,
	config: GridConfig,
	cameraZoom?: number
): void {
	renderGrid(layer, config, cameraZoom);
}
