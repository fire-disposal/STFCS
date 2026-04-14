import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface CursorState {
	x: number;
	y: number;
	r: number;
}

const COLOR = 0x4a9eff;
const COLOR_DIM = 0x2b4261;

export function useCursorRendering(layers: LayerRegistry | null, cursor: CursorState | null) {
	const graphicsRef = useRef<Graphics | null>(null);

	useEffect(() => {
		if (!layers || !layers.cursor) return;

		let graphics = graphicsRef.current;
		if (!graphics) {
			graphics = new Graphics();
			graphicsRef.current = graphics;
			layers.cursor.addChild(graphics);
		}

		graphics.clear();

		if (!cursor) {
			graphics.visible = false;
			return;
		}

		graphics.visible = true;
		graphics.position.set(cursor.x, cursor.y);
		graphics.rotation = (cursor.r * Math.PI) / 180;

		drawCursor(graphics);
	}, [layers, cursor]);

	useEffect(() => {
		return () => {
			if (graphicsRef.current && layers?.cursor.children.includes(graphicsRef.current)) {
				layers.cursor.removeChild(graphicsRef.current);
			}
		};
	}, [layers]);
}

function drawCursor(g: Graphics) {
	const size = 30;
	const armLen = 20;
	const armWidth = 2;
	const arrowSize = 8;

	g.moveTo(0, -size).lineTo(0, -armLen).stroke({ color: COLOR, width: armWidth });
	g.moveTo(0, size).lineTo(0, armLen).stroke({ color: COLOR, width: armWidth });
	g.moveTo(-size, 0).lineTo(-armLen, 0).stroke({ color: COLOR, width: armWidth });
	g.moveTo(size, 0).lineTo(armLen, 0).stroke({ color: COLOR, width: armWidth });

	g.moveTo(0, -size - arrowSize / 2).lineTo(-arrowSize / 2, -size + arrowSize / 2).stroke({ color: COLOR, width: armWidth });
	g.moveTo(0, -size - arrowSize / 2).lineTo(arrowSize / 2, -size + arrowSize / 2).stroke({ color: COLOR, width: armWidth });
	g.poly([0, -size - arrowSize / 2, -arrowSize / 2, -size + arrowSize / 2, arrowSize / 2, -size + arrowSize / 2]).fill({ color: COLOR });

	g.moveTo(-armLen, -armLen).lineTo(-armLen + 6, -armLen).stroke({ color: COLOR_DIM, width: 1 });
	g.moveTo(-armLen, -armLen).lineTo(-armLen, -armLen + 6).stroke({ color: COLOR_DIM, width: 1 });
	g.moveTo(armLen, -armLen).lineTo(armLen - 6, -armLen).stroke({ color: COLOR_DIM, width: 1 });
	g.moveTo(armLen, -armLen).lineTo(armLen, -armLen + 6).stroke({ color: COLOR_DIM, width: 1 });
	g.moveTo(-armLen, armLen).lineTo(-armLen + 6, armLen).stroke({ color: COLOR_DIM, width: 1 });
	g.moveTo(-armLen, armLen).lineTo(-armLen, armLen - 6).stroke({ color: COLOR_DIM, width: 1 });
	g.moveTo(armLen, armLen).lineTo(armLen - 6, armLen).stroke({ color: COLOR_DIM, width: 1 });
	g.moveTo(armLen, armLen).lineTo(armLen, armLen - 6).stroke({ color: COLOR_DIM, width: 1 });

	g.circle(0, 0, 4).fill({ color: COLOR });
}