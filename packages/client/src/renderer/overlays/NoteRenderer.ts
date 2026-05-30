/**
 * 便签渲染 Hook
 *
 * 职责：
 * 1. 渲染 VTT 世界坐标便签
 * 2. 支持创建/移动/修改文本/删除
 * 3. 支持清空操作
 *
 * 渲染层：world.overlay (zIndex 6)
 */

import { Text, TextStyle } from "pixi.js";
import { useRef, useEffect } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export function useNoteRendering(layers: LayerRegistry | null) {
  const notesRef = useRef(new Map<string, { playerId: string; text: Text }>());
  const layersRef = useRef(layers);
  layersRef.current = layers;

	useEffect(() => () => {
		for (const [, n] of notesRef.current) n.text.destroy();
		notesRef.current.clear();
	}, []);

	const onNote = (p: {
		op: string; id: string; x: number; y: number; text?: string;
		color: string; playerId: string;
	}) => {
		const m = notesRef.current;
		if (p.op === "delete") {
			const n = m.get(p.id);
			if (n) {
				n.text.destroy();
				m.delete(p.id);
			}
			return;
		}

		let n = m.get(p.id);
		if (!n) {
			const t = new Text({
				text: p.text ?? "",
				style: new TextStyle({
					fontSize: 14,
					fill: p.color,
					stroke: { color: "#000", width: 3 },
				}),
			});
			t.position.set(p.x, p.y);
			layersRef.current?.overlay.addChild(t);
			n = { playerId: p.playerId, text: t };
			m.set(p.id, n);
		}
		if (p.op === "move") n.text.position.set(p.x, p.y);
		if (p.text !== undefined) n.text.text = p.text;
	};

	const onClear = (p: { scope: string; targetId?: string }) => {
		const m = notesRef.current;
		if (p.scope === "all") {
			for (const [, n] of m) n.text.destroy();
			m.clear();
		} else if (p.scope === "player") {
			for (const [k, n] of m) {
				if (n.playerId === p.targetId) {
					n.text.destroy();
					m.delete(k);
				}
			}
		}
	};

	return { onNote, onClear };
}
