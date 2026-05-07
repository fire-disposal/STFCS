/**
 * StarMapRenderer — 星图渲染 Hook
 *
 * 在 PixiJS 中渲染超空间节点网络。
 *
 * 交互流程：
 * 1. GM 点击可达节点 → 目标节点高亮 + 禁用重复点击
 * 2. 等待 world:travel 响应
 * 3. 响应到达 → 自动重新渲染（数据层已更新 fleetNodeId）
 * 4. camera 自动定位到新位置（由 PixiCanvas 的 effect 处理）
 *
 * 不依赖每帧动画，所有状态由 React 数据流驱动。
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";
import type { WorldMap, WorldNode, WorldEdge } from "@vt/data";
// ── 颜色映射 ──
const C = {
	nodeDefault: 0x2a3d55,
	nodeExplored: 0x4a9eff,
	nodeCurrent: 0x4fc3ff,
	nodeHostile: 0xff4a4a,
	nodeSafe: 0x2ecc71,
	edgeTrade: 0x3a5a8a,
	edgePerilous: 0xe67e22,
	edgeHidden: 0x334455,
	edgeUnexplored: 0x445566,
	text: 0x8ba4c7,
	textBright: 0xcfe8ff,
	textDim: 0x556677,
	textEdge: 0x556677,
	glow: 0x4fc3ff,
	reachableGlow: 0x4a9eff,
};

const R = { node: 14, current: 20, reachable: 16 };

// ── 节点类型形状 ──
function drawShape(g: Graphics, x: number, y: number, r: number, type: string) {
	switch (type) {
		case "safe_haven":
			g.rect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
			break;
		case "nebula":
			g.poly([x, y - r, x + r, y, x, y + r, x - r, y]);
			break;
		case "anomaly":
			g.poly([x, y - r, x + r, y + r * 0.7, x - r, y + r * 0.7]);
			break;
		case "waypoint": {
			const pts: number[] = [];
			for (let i = 0; i < 6; i++)
				pts.push(
					x + r * Math.cos((Math.PI / 3) * i - Math.PI / 6),
					y + r * Math.sin((Math.PI / 3) * i - Math.PI / 6)
				);
			g.poly(pts);
			break;
		}
		case "hostile_zone":
			for (let i = 0; i < 5; i++) {
				const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
				if (i === 0) g.moveTo(x + r * Math.cos(a), y + r * Math.sin(a));
				else g.lineTo(x + r * Math.cos(a), y + r * Math.sin(a));
				g.lineTo(x + r * 0.4 * Math.cos(a + Math.PI / 5), y + r * 0.4 * Math.sin(a + Math.PI / 5));
			}
			g.closePath();
			break;
		default:
			g.circle(x, y, r);
	}
}

function nodeColor(node: WorldNode, isCurrent: boolean): number {
	if (isCurrent) return C.nodeCurrent;
	if (node.state === "threat") return C.nodeHostile;
	if (node.state === "safe" || node.state === "cleared") return C.nodeSafe;
	return C.nodeExplored;
}

function edgeStyle(edge: WorldEdge) {
	const hidden = edge.hidden && !edge.discovered;
	if (hidden) return { color: C.edgeHidden, width: 1, alpha: 0.15, dashed: true };
	if (edge.type === "perilous")
		return { color: C.edgePerilous, width: 2, alpha: 0.6, dashed: false };
	if (edge.type === "unexplored")
		return { color: C.edgeUnexplored, width: 1.5, alpha: 0.35, dashed: true };
	return { color: C.edgeTrade, width: 2, alpha: 0.5, dashed: false };
}

export function useStarMapRendering(
	layers: LayerRegistry | null,
	worldMap: WorldMap | undefined,
	isHost: boolean
): void {

	const world = worldMap;
	const nodes = world?.nodes ?? [];
	const edges = world?.edges ?? [];
	const fleetNodeId = world?.fleetNodeId;

	const reachableIds = new Set(
		edges
			.filter((e) => !e.hidden || e.discovered)
			.flatMap((e) => (e.from === fleetNodeId ? [e.to] : e.to === fleetNodeId ? [e.from] : []))
	);

	useEffect(() => {
		if (!layers) return;
		layers.starMapEdges.removeChildren();
		layers.starMapNodes.removeChildren();
		if (!world || nodes.length === 0) return;

		// ── 航道层 ──
		const laneGlow = new Graphics();
		const edgeGfx = new Graphics();
		for (const edge of edges) {
			const from = nodes.find((n) => n.id === edge.from);
			const to = nodes.find((n) => n.id === edge.to);
			if (!from || !to) continue;
			const s = edgeStyle(edge);
			const connected = from.id === fleetNodeId || to.id === fleetNodeId;

			laneGlow.moveTo(from.position.x, from.position.y);
			laneGlow.lineTo(to.position.x, to.position.y);
			laneGlow.stroke({
				color: s.color,
				width: s.width * (connected ? 5 : 3),
				alpha: s.alpha * 0.1,
			});

			edgeGfx.moveTo(from.position.x, from.position.y);
			edgeGfx.lineTo(to.position.x, to.position.y);
			if (s.dashed) {
				const dx = to.position.x - from.position.x,
					dy = to.position.y - from.position.y;
				for (let i = 0; i < 8; i += 2) {
					const t0 = i / 8,
						t1 = Math.min((i + 1) / 8, 1);
					edgeGfx.moveTo(from.position.x + dx * t0, from.position.y + dy * t0);
					edgeGfx.lineTo(from.position.x + dx * t1, from.position.y + dy * t1);
				}
			}
			edgeGfx.stroke({ color: s.color, width: s.width, alpha: s.alpha });

			if (edge.travelCost > 0) {
				const mx = (from.position.x + to.position.x) / 2,
					my = (from.position.y + to.position.y) / 2;
				const lbl = new Text({
					text: `${edge.travelCost}d`,
					style: new TextStyle({ fontSize: 9, fill: C.textEdge }),
				});
				lbl.anchor.set(0.5, 0.5);
				const nx = -(to.position.y - from.position.y),
					ny = to.position.x - from.position.x;
				const nl = Math.sqrt(nx * nx + ny * ny) || 1;
				lbl.position.set(mx + (nx / nl) * 10, my + (ny / nl) * 10);
				layers.starMapEdges.addChild(lbl);
			}
		}
		layers.starMapEdges.addChild(laneGlow);
		layers.starMapEdges.addChild(edgeGfx);

		// ── 节点层 ──
		const nodeGfx = new Graphics();
		for (const node of nodes) {
			const isCurrent = node.id === fleetNodeId;
			const isReachable = reachableIds.has(node.id);
			const visible = node.explored || isHost;
			const r = isCurrent ? R.current : isReachable && !isCurrent ? R.reachable : R.node;
			const color = nodeColor(node, isCurrent);

			if (!visible) {
				nodeGfx.circle(node.position.x, node.position.y, 4);
				nodeGfx.fill({ color: C.nodeDefault, alpha: 0.25 });
				continue;
			}

			if (isReachable && !isCurrent) {
				nodeGfx.circle(node.position.x, node.position.y, r + 5);
				nodeGfx.fill({ color: C.reachableGlow, alpha: 0.08 });
			}
			if (isCurrent) {
				nodeGfx.circle(node.position.x, node.position.y, r + 8);
				nodeGfx.fill({ color: C.glow, alpha: 0.12 });
			}

			drawShape(nodeGfx, node.position.x, node.position.y, r, node.type);
			nodeGfx.fill({ color, alpha: 0.9 });

			if (isCurrent) {
				drawShape(nodeGfx, node.position.x, node.position.y, r, node.type);
				nodeGfx.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
			}

			// 节点名称（所有人可见、可点击标记，不触发行动）
			const label = new Text({
				text: node.name,
				style: new TextStyle({
					fontSize: isCurrent ? 12 : 10,
					fill: isCurrent ? C.textBright : isReachable ? C.text : C.textDim,
					fontWeight: isCurrent ? "bold" : "normal",
				}),
			});
			label.anchor.set(0.5, 0);
			label.position.set(node.position.x, node.position.y + r + 3);
			label.eventMode = "static";
			label.cursor = isReachable && !isCurrent ? "pointer" : "default";

			// 所有人可点击节点进行「指向」— 不触发航行，仅用于讨论
			if (isReachable && !isCurrent) {
				const nid = node.id;
				label.on("pointertap", () => {
					// 触发节点选择事件（WorldInfoPanel 监听此事件）
					window.dispatchEvent(new CustomEvent("starmap:node-select", {
						detail: { nodeId: nid },
					}));
				});
			}

			layers.starMapNodes.addChild(label);
		}
		layers.starMapNodes.addChild(nodeGfx);
	}, [layers, world, nodes.length, edges.length, fleetNodeId, isHost]);
}
