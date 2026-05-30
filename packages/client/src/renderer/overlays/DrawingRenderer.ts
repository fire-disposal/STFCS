/**
 * 绘图渲染 Hook
 *
 * 职责：
 * 1. 渲染实时绘图流（draw_stream）
 * 2. 渲染已提交的绘图（draw_commit）
 * 3. 支持清空操作（pen/stroke/fill/line/arrow 工具）
 *
 * 渲染层：world.overlay (zIndex 6)
 */

import { Graphics } from "pixi.js";
import { useRef, useEffect } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

interface StreamStroke { strokeId: string; g: Graphics; color: number; lineWidth: number; }
interface CommittedStroke { strokeId: string; playerId: string; g: Graphics; }

export function useDrawingRendering(layers: LayerRegistry | null) {
	const streamsRef = useRef(new Map<string, StreamStroke>());
	const committedRef = useRef(new Map<string, CommittedStroke>());
	const layersRef = useRef(layers);
	layersRef.current = layers;

	useEffect(() => () => {
		for (const [, s] of streamsRef.current) s.g.destroy();
		for (const [, s] of committedRef.current) s.g.destroy();
		streamsRef.current.clear();
		committedRef.current.clear();
	}, []);

	const onDrawStream = (p: { strokeId: string; x: number; y: number; color: string; lineWidth: number }) => {
		const m = streamsRef.current;
		let s = m.get(p.strokeId);
		const c = parseInt(p.color.replace("#", ""), 16);
		if (!s) {
			const g = new Graphics();
			g.position.set(p.x, p.y);
			layersRef.current?.overlay.addChild(g);
			s = { strokeId: p.strokeId, g, color: c, lineWidth: p.lineWidth };
			m.set(p.strokeId, s);
			return;
		}
		s.g.lineTo(p.x - s.g.position.x, p.y - s.g.position.y);
		s.g.stroke({ color: s.color, width: s.lineWidth, alpha: 0.9 });
	};

	const onDrawCommit = (p: {
		strokeId: string; playerId: string; tool: string; color: string;
		lineWidth: number; points: { x: number; y: number }[];
	}) => {
		const sm = streamsRef.current;
		const old = sm.get(p.strokeId);
		if (old) {
			old.g.destroy();
			sm.delete(p.strokeId);
		}

		const g = new Graphics();
		const c = parseInt(p.color.replace("#", ""), 16);

		if (p.tool === "pen" && p.points.length > 1) {
			const bx = p.points[0].x;
			const by = p.points[0].y;
			g.position.set(bx, by);
			g.moveTo(0, 0);
			for (let i = 1; i < p.points.length; i++)
				g.lineTo(p.points[i].x - bx, p.points[i].y - by);
			g.stroke({ color: c, width: p.lineWidth, alpha: 0.9 });
		} else if ((p.tool === "line" || p.tool === "arrow") && p.points.length >= 2) {
			const p0 = p.points[0];
			const p1 = p.points[p.points.length - 1];
			g.moveTo(p0.x, p0.y);
			g.lineTo(p1.x, p1.y);
			g.stroke({ color: c, width: p.lineWidth, alpha: 0.9 });
			if (p.tool === "arrow") {
				const dx = p1.x - p0.x;
				const dy = p1.y - p0.y;
				const len = Math.sqrt(dx * dx + dy * dy) || 1;
				const ux = dx / len;
				const uy = dy / len;
				const sz = Math.max(p.lineWidth * 4, 12);
				const ax = p1.x - ux * sz;
				const ay = p1.y - uy * sz;
				const px = -uy * sz * 0.4;
				const py = ux * sz * 0.4;
				g.moveTo(p1.x, p1.y);
				g.lineTo(ax + px, ay + py);
				g.lineTo(ax - px, ay - py);
				g.lineTo(p1.x, p1.y);
				g.fill({ color: c, alpha: 0.9 });
			}
		}

		layersRef.current?.overlay.addChild(g);
		committedRef.current.set(p.strokeId, { strokeId: p.strokeId, playerId: p.playerId, g });
	};

	const onClear = (p: { scope: string; targetId?: string }) => {
		const cm = committedRef.current;
		if (p.scope === "all") {
			for (const [, s] of cm) s.g.destroy();
			cm.clear();
			for (const [, s] of streamsRef.current) s.g.destroy();
			streamsRef.current.clear();
		} else if (p.scope === "player" && p.targetId) {
			for (const [k, s] of cm) {
				if (s.playerId === p.targetId) {
					s.g.destroy();
					cm.delete(k);
				}
			}
		}
	};

	return { onDrawStream, onDrawCommit, onClear };
}
