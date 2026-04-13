import { Graphics } from "pixi.js";
import { useEffect } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export function drawGrid(layers: LayerRegistry | null, showGrid: boolean): void {
	if (!layers) return;

	layers.grid.removeChildren();
	if (!showGrid) return;

	const grid = new Graphics();
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

	layers.grid.addChild(grid);
}

export function useGridRendering(layers: LayerRegistry | null, showGrid: boolean) {
	useEffect(() => {
		drawGrid(layers, showGrid);
	}, [layers, showGrid]);
}
