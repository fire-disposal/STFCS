/**
 * 视口渲染 Hook
 *
 * 职责：
 * 1. 渲染其他玩家的相机视口边界框
 * 2. 角标显示视口旋转方向
 *
 * 渲染层：world.overlay (zIndex 6)
 */

import { Graphics } from "pixi.js";
import { useRef, useEffect } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export function useViewportRendering(layers: LayerRegistry | null) {
  const ref = useRef(new Map<string, Graphics>());
  const layersRef = useRef(layers);
  layersRef.current = layers;

	useEffect(() => () => {
		for (const [, g] of ref.current) g.destroy();
		ref.current.clear();
	}, []);

	const onViewport = (p: {
		playerId: string; cx: number; cy: number; zoom: number; rotation: number;
		sw: number; sh: number; color: string;
	}) => {
		const m = ref.current;
		let g = m.get(p.playerId);
		if (!g) {
			g = new Graphics();
			layersRef.current?.overlay.addChild(g);
			m.set(p.playerId, g);
		}
		g.clear();

		const hw = (p.sw / p.zoom) / 2;
		const hh = (p.sh / p.zoom) / 2;
		const rad = ((p.rotation - 90) * Math.PI) / 180;
		const cos = Math.cos(rad);
		const sin = Math.sin(rad);
		const rot = (x: number, y: number): [number, number] => [
			x * cos - y * sin,
			x * sin + y * cos,
		];

		const corners = [
			rot(-hw, -hh),
			rot(hw, -hh),
			rot(hw, hh),
			rot(-hw, hh),
		];
		const clr = parseInt(p.color.replace("#", ""), 16);
		const L = 12;

		for (let i = 0; i < 4; i++) {
			const [cx0, cy0] = corners[i];
			const [cx1, cy1] = corners[(i + 1) % 4];
			const mag = Math.abs(cx1 - cx0) + Math.abs(cy1 - cy0) || 1;
			const dx = (cx1 - cx0) / mag;
			const dy = (cy1 - cy0) / mag;

			const [px0, py0] = corners[(i + 3) % 4];
			const pmag = Math.abs(px0 - cx0) + Math.abs(py0 - cy0) || 1;
			const pdx = (px0 - cx0) / pmag;
			const pdy = (py0 - cy0) / pmag;

			g.moveTo(p.cx + cx0, p.cy + cy0);
			g.lineTo(p.cx + cx0 + dx * L, p.cy + cy0 + dy * L);
			g.stroke({ color: clr, width: 2, alpha: 0.6 });
			g.moveTo(p.cx + cx0, p.cy + cy0);
			g.lineTo(p.cx + cx0 + pdx * L, p.cy + cy0 + pdy * L);
			g.stroke({ color: clr, width: 2, alpha: 0.6 });
		}
	};

	return { onViewport };
}
