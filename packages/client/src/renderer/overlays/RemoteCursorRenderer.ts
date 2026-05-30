/**
 * 远程光标渲染 Hook
 *
 * 职责：
 * 1. 渲染其他玩家的世界坐标系光标
 * 2. 显示玩家标识标签
 *
 * 渲染层：world.overlay (zIndex 6)
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import { useRef, useEffect } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export function useRemoteCursorRendering(layers: LayerRegistry | null) {
  const cursorsRef = useRef(new Map<string, { x: number; y: number; g: Graphics; label: Text }>());
  const layersRef = useRef(layers);
  layersRef.current = layers;

	useEffect(() => () => {
		for (const [, c] of cursorsRef.current) {
			c.g.destroy();
			c.label.destroy();
		}
		cursorsRef.current.clear();
	}, []);

	const onCursor = (p: { playerId: string; x: number; y: number; color: string }) => {
		const m = cursorsRef.current;
		let c = m.get(p.playerId);
		const clr = parseInt(p.color.replace("#", ""), 16);
		if (!c) {
			const g = new Graphics();
			const label = new Text({
				text: p.playerId.slice(0, 6),
				style: new TextStyle({ fontSize: 10, fill: p.color }),
			});
			label.anchor.set(0.5, 0);
			layersRef.current?.overlay.addChild(g);
			layersRef.current?.overlay.addChild(label);
			c = { x: 0, y: 0, g, label };
			m.set(p.playerId, c);
		}
		if (c.x === p.x && c.y === p.y) return;
		c.x = p.x;
		c.y = p.y;
		c.g.clear();
		c.g.moveTo(p.x, p.y - 12);
		c.g.lineTo(p.x, p.y + 12);
		c.g.stroke({ color: clr, width: 2 });
		c.g.moveTo(p.x - 12, p.y);
		c.g.lineTo(p.x + 12, p.y);
		c.g.stroke({ color: clr, width: 2 });
		c.g.circle(p.x, p.y, 3).fill({ color: clr });
		c.label.position.set(p.x, p.y + 14);
	};

	return { onCursor };
}
