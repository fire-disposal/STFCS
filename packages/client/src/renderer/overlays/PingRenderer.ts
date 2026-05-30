/**
 * Ping 渲染 Hook
 *
 * 职责：
 * 1. 渲染 VTT 坐标 Ping 点
 * 2. 带动画：波纹扩展 + 淡出
 * 3. 3 秒后自动移除
 *
 * 渲染层：world.overlay (zIndex 6)
 */

import { Graphics } from "pixi.js";
import { useRef, useEffect } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export function usePingRendering(layers: LayerRegistry | null) {
  const pingsRef = useRef(new Map<string, { x: number; y: number; g: Graphics; startTime: number; color: string }>());
  const frameRef = useRef(0);
  const layersRef = useRef(layers);
  layersRef.current = layers;

	useEffect(() => {
		let running = true;
		const tick = () => {
			if (!running) return;
			const now = Date.now();
			for (const [id, p] of pingsRef.current) {
				const t = (now - p.startTime) / 3000;
				if (t >= 1) {
					p.g.destroy();
					pingsRef.current.delete(id);
					continue;
				}
				const r = 20 + t * 60;
				const a = 1 - t;
				const c = parseInt(p.color.replace("#", ""), 16);
				p.g.clear();
				p.g.circle(p.x, p.y, r).stroke({ color: c, width: 2 + (1 - t) * 3, alpha: a });
				p.g.circle(p.x, p.y, 4).fill({ color: c, alpha: a });
			}
			frameRef.current = requestAnimationFrame(tick);
		};
		frameRef.current = requestAnimationFrame(tick);
		return () => {
			running = false;
			cancelAnimationFrame(frameRef.current);
		};
	}, []);

	const onPing = (p: { pingId: string; x: number; y: number; color: string; timestamp?: number }) => {
		const m = pingsRef.current;
		if (m.has(p.pingId)) return;
		const g = new Graphics();
		layersRef.current?.overlay.addChild(g);
		m.set(p.pingId, { x: p.x, y: p.y, g, startTime: p.timestamp ?? Date.now(), color: p.color });
	};

	const onPingRemove = (p: { pingId: string }) => {
		const item = pingsRef.current.get(p.pingId);
		if (item) {
			item.g.destroy();
			pingsRef.current.delete(p.pingId);
		}
	};

	return { onPing, onPingRemove };
}
