/**
 * 世界坐标系网格渲染 Hook
 *
 * 职责：
 * 1. 渲染世界坐标系网格线
 * 2. 高亮轴线（x=0, y=0）
 * 3. 根据显示设置控制可见性
 *
 * 渲染层：world.grid (zIndex 4)
 *
 * 网格参数：
 * - gridSize: 100 单位间隔
 * - range: [-3000, 3000] 覆盖范围
 * - 轴线颜色: #4a9eff (蓝色)
 * - 普通线颜色: #2a3d55 (暗蓝)
 */

import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export function useGridRendering(layers: LayerRegistry | null, showGrid: boolean) {
	const gridRef = useRef<Graphics | null>(null);

	useEffect(() => {
		if (!layers) return;

		let grid = gridRef.current;
		if (!grid) {
			grid = new Graphics();
			gridRef.current = grid;
			layers.grid.addChild(grid);
		}

		grid.clear();
		if (!showGrid) return;

		const gridSize = 100;
		const half = 3000;

		for (let x = -half; x <= half; x += gridSize) {
			const isAxis = x === 0;
			grid
				.moveTo(x, -half)
				.lineTo(x, half)
				.stroke({ color: isAxis ? 0x4a9eff : 0x2a3d55, alpha: isAxis ? 0.4 : 0.2, width: 1 });
		}

		for (let y = -half; y <= half; y += gridSize) {
			const isAxis = y === 0;
			grid
				.moveTo(-half, y)
				.lineTo(half, y)
				.stroke({ color: isAxis ? 0x4a9eff : 0x2a3d55, alpha: isAxis ? 0.4 : 0.2, width: 1 });
		}
	}, [layers, showGrid]);

	useEffect(() => {
		return () => {
			if (gridRef.current && layers?.grid.children.includes(gridRef.current)) {
				layers.grid.removeChild(gridRef.current);
			}
		};
	}, [layers]);
}