/**
 * 游标渲染 Hook
 *
 * 作为独立图层挂载到 LayerRegistry，由 useLayerSystem 统一管理
 * 游标位置是世界坐标，由图层系统自动处理坐标变换
 */

import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface CursorState {
	x: number;
	y: number;
	heading: number;
}

export function useCursorRendering(layers: LayerRegistry | null, cursor: CursorState | null) {
	const cursorContainerRef = useRef<Container | null>(null);

	useEffect(() => {
		if (!layers || !layers.cursor) return;

		if (!cursorContainerRef.current) {
			cursorContainerRef.current = new Container();
			layers.cursor.addChild(cursorContainerRef.current);
		}

		const cursorContainer = cursorContainerRef.current;

		if (!cursor) {
			cursorContainer.removeChildren();
			cursorContainer.visible = false;
			return;
		}

		cursorContainer.visible = true;
		cursorContainer.removeChildren();

		const graphics = new Graphics();

		// 使用图层系统的坐标变换，直接使用世界坐标
		graphics.position.set(cursor.x, cursor.y);
		graphics.rotation = (cursor.heading * Math.PI) / 180;

		// 绘制游标十字线
		const crossSize = 25;
		const crossThickness = 2;

		graphics
			.moveTo(-crossSize, 0)
			.lineTo(crossSize, 0)
			.moveTo(0, -crossSize)
			.lineTo(0, crossSize)
			.stroke({
				color: 0x4a9eff,
				width: crossThickness,
				alpha: 0.9,
			});

		// 绘制游标圆环
		const ringRadius = 35;
		graphics.circle(0, 0, ringRadius).stroke({
			color: 0x4a9eff,
			width: 2,
			alpha: 0.6,
		});

		// 绘制方向指示器
		const arrowSize = 12;
		graphics
			.moveTo(0, -ringRadius - 5)
			.lineTo(-arrowSize / 2, -ringRadius + 5)
			.lineTo(arrowSize / 2, -ringRadius + 5)
			.closePath()
			.fill({
				color: 0x4a9eff,
				alpha: 0.9,
			});

		cursorContainer.addChild(graphics);

		return () => {
			if (cursorContainer && layers.cursor.children.includes(cursorContainer)) {
				cursorContainer.removeChildren();
			}
		};
	}, [layers, cursor]);
}

export default useCursorRendering;
