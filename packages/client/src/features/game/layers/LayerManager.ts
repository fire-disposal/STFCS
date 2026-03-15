import { Container } from "pixi.js";

/**
 * 图层管理器 - 管理 PixiJS 渲染图层的创建和销毁
 * 分离各个绘制图层的绘制逻辑
 */
export interface LayerRegistry {
	background: Container;
	grid: Container;
	tokens: Container;
	weapons: Container;
	shields: Container;
	statusBars: Container;
	overlay: Container;
	effects: Container;
	otherPlayersCameras: Container;
	selections: Container; // 选中状态图层
}

/**
 * 创建所有渲染图层
 * @returns 图层注册表
 */
export function createLayers(): LayerRegistry {
	return {
		background: new Container(),
		grid: new Container(),
		tokens: new Container(),
		weapons: new Container(),
		shields: new Container(),
		statusBars: new Container(),
		overlay: new Container(),
		effects: new Container(),
		otherPlayersCameras: new Container(),
		selections: new Container(), // 选中状态图层
	};
}

/**
 * 图层配置
 */
export const LAYER_CONFIG = {
	background: { zIndex: 0, name: "Background" },
	grid: { zIndex: 1, name: "Grid" },
	tokens: { zIndex: 2, name: "Tokens" },
	shields: { zIndex: 3, name: "Shields" },
	weapons: { zIndex: 4, name: "Weapons" },
	statusBars: { zIndex: 5, name: "Status Bars" },
	overlay: { zIndex: 6, name: "Overlay" },
	effects: { zIndex: 7, name: "Effects" },
	otherPlayersCameras: { zIndex: 8, name: "Other Players Cameras" },
	selections: { zIndex: 9, name: "Selections" }, // 选中状态在最上层
} as const;

/**
 * 设置图层顺序（zIndex）
 * @param layers 图层注册表
 */
export function setupLayerOrder(layers: LayerRegistry): void {
	Object.entries(LAYER_CONFIG).forEach(([key, config]) => {
		const layerKey = key as keyof LayerRegistry;
		layers[layerKey].zIndex = config.zIndex;
	});
}
