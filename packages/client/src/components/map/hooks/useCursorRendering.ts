/**
 * 游标渲染 Hook
 *
 * 在 stage 层绘制游标标记（不随相机平移，但随缩放）
 * 游标位置是世界坐标，需要手动转换为屏幕坐标
 */

import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface CursorState {
	x: number;
	y: number;
	heading: number;
}

export interface UseCursorRenderingOptions {
	cameraX: number;
	cameraY: number;
	zoom: number;
	viewRotation: number;
}

export function useCursorRendering(
	layers: LayerRegistry | null,
	cursor: CursorState | null,
	options: UseCursorRenderingOptions
) {
	const cursorContainerRef = useRef<Container | null>(null);
	const optionsRef = useRef(options);

	// 保持 options 引用稳定
	optionsRef.current = options;

	useEffect(() => {
		if (!layers || !layers.cursor) return;

		// 创建或获取游标容器
		if (!cursorContainerRef.current) {
			cursorContainerRef.current = new Container();
			layers.cursor.addChild(cursorContainerRef.current);
		}

		const cursorContainer = cursorContainerRef.current;
		const opts = optionsRef.current;

		// 如果没有游标数据，清空并返回
		if (!cursor) {
			cursorContainer.removeChildren();
			cursorContainer.visible = false;
			return;
		}

		cursorContainer.visible = true;
		cursorContainer.removeChildren();

		// 创建图形容器
		const graphics = new Graphics();

		// 计算屏幕坐标（世界坐标 → 屏幕坐标）
		const screenX = (cursor.x - opts.cameraX) * opts.zoom;
		const screenY = (cursor.y - opts.cameraY) * opts.zoom;

		graphics.position.set(screenX, screenY);

		// 设置旋转（游标 heading 补偿 viewRotation）
		const compensatedRotation = ((cursor.heading - opts.viewRotation) * Math.PI) / 180;
		graphics.rotation = compensatedRotation;

		// 绘制游标十字线
		const crossSize = 25 / opts.zoom;
		const crossThickness = 2 / opts.zoom;

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
		const ringRadius = 35 / opts.zoom;
		graphics.circle(0, 0, ringRadius).stroke({
			color: 0x4a9eff,
			width: 2 / opts.zoom,
			alpha: 0.6,
		});

		// 绘制方向指示器
		const arrowSize = 12 / opts.zoom;
		graphics
			.moveTo(0, -ringRadius - 5 / opts.zoom)
			.lineTo(-arrowSize / 2, -ringRadius + 5 / opts.zoom)
			.lineTo(arrowSize / 2, -ringRadius + 5 / opts.zoom)
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
