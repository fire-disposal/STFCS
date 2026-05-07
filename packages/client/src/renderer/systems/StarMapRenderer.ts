/**
 * StarMapRenderer — 星图渲染 Hook
 *
 * 在 PixiJS 中渲染超空间节点网络。
 * 复用相机的缩放/平移，与战术地图共用一套交互。
 *
 * 渲染层：
 * - starMapEdges (zIndex 6): 航道连线 + 标签
 * - starMapNodes (zIndex 7): 节点 + 名称
 *
 * 可视化层次：
 * 1. 航道：连线颜色=安全等级，虚线=未勘测，文字=耗时+概率
 * 2. 节点：形状=类型，颜色=状态，大小=是否当前
 * 3. 可达性：当前节点高亮，可达节点浅色光晕
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";
import type { WorldMap, WorldNode, WorldEdge } from "@vt/data";
import { getGameActionSender } from "@/state/stores/gameStore";

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
	bg: 0x0a0e14,
};

const R = { node: 14, current: 20, reachable: 16 };

// ── 节点类型 → 绘制形状 ──
function drawNodeShape(g: Graphics, x: number, y: number, r: number, type: string) {
	switch (type) {
		case "safe_haven":
			// 方形（安全港）
			g.rect(x - r * 0.7, y - r * 0.7, r * 1.4, r * 1.4);
			break;
		case "nebula":
			// 菱形（星云）
			g.poly([x, y - r, x + r, y, x, y + r, x - r, y]);
			break;
		case "anomaly":
			// 三角形（异常区）
			g.poly([x, y - r, x + r, y + r * 0.7, x - r, y + r * 0.7]);
			break;
		case "waypoint":
			// 六边形（航标）
			const pts: number[] = [];
			for (let i = 0; i < 6; i++) {
				const a = (Math.PI / 3) * i - Math.PI / 6;
				pts.push(x + r * Math.cos(a), y + r * Math.sin(a));
			}
			g.poly(pts);
			break;
		case "hostile_zone":
			// 星形（敌对区）
			for (let i = 0; i < 5; i++) {
				const a = ((Math.PI * 2) / 5) * i - Math.PI / 2;
				const inner = a + Math.PI / 5;
				const outerR = r;
				const innerR = r * 0.4;
				if (i === 0) g.moveTo(x + outerR * Math.cos(a), y + outerR * Math.sin(a));
				else g.lineTo(x + outerR * Math.cos(a), y + outerR * Math.sin(a));
				g.lineTo(x + innerR * Math.cos(inner), y + innerR * Math.sin(inner));
			}
			g.closePath();
			break;
		default:
			// 圆形（标准恒星系）
			g.circle(x, y, r);
	}
}

// ── 节点状态 → 颜色 ──
function nodeColor(node: WorldNode, isCurrent: boolean): number {
	if (isCurrent) return C.nodeCurrent;
	if (node.state === "threat") return C.nodeHostile;
	if (node.state === "safe" || node.state === "cleared") return C.nodeSafe;
	return C.nodeExplored;
}

// ── 航道类型 → 颜色 + 样式 ──
function edgeStyle(edge: WorldEdge): {
	color: number;
	width: number;
	alpha: number;
	dashed: boolean;
} {
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
	const containerRef = useRef<{ edges: Graphics; nodes: Graphics } | null>(null);

	const world = worldMap;
	const nodes = world?.nodes ?? [];
	const edges = world?.edges ?? [];
	const fleetNodeId = world?.fleetNodeId;

	// 可达节点 ID 集合
	const reachableIds = new Set(
		edges
			.filter((e) => !e.hidden || e.discovered)
			.flatMap((e) => {
				if (e.from === fleetNodeId) return [e.to];
				if (e.to === fleetNodeId) return [e.from];
				return [];
			})
	);

	useEffect(() => {
		if (!layers) return;

		layers.starMapEdges.removeChildren();
		layers.starMapNodes.removeChildren();

		if (!world || nodes.length === 0) return;

		// ═══════ 航道层 ═══════
		const edgeGfx = new Graphics();
		for (const edge of edges) {
			const from = nodes.find((n) => n.id === edge.from);
			const to = nodes.find((n) => n.id === edge.to);
			if (!from || !to) continue;

			const style = edgeStyle(edge);
			edgeGfx.moveTo(from.position.x, from.position.y);
			edgeGfx.lineTo(to.position.x, to.position.y);
			// 虚线：用多个小线段模拟
			if (style.dashed) {
				const dx = to.position.x - from.position.x;
				const dy = to.position.y - from.position.y;
				const len = Math.sqrt(dx * dx + dy * dy);
				const seg = 8;
				const segLen = len / seg;
				for (let i = 0; i < seg; i += 2) {
					const t0 = i / seg;
					const t1 = Math.min((i + 1) / seg, 1);
					edgeGfx.moveTo(from.position.x + dx * t0, from.position.y + dy * t0);
					edgeGfx.lineTo(from.position.x + dx * t1, from.position.y + dy * t1);
				}
			}
			edgeGfx.stroke({ color: style.color, width: style.width, alpha: style.alpha });

			// 航道标签：耗时 + 概率
			const midX = (from.position.x + to.position.x) / 2;
			const midY = (from.position.y + to.position.y) / 2;
			const edgeLabel = new Text({
				text: `${edge.travelCost}日${edge.encounterChance > 0 ? ` ${Math.round(edge.encounterChance * 100)}%` : ""}`,
				style: new TextStyle({ fontSize: 9, fill: C.textEdge }),
			});
			edgeLabel.anchor.set(0.5, 0.5);
			// 偏移一点避免压线
			const nx = -(to.position.y - from.position.y);
			const ny = to.position.x - from.position.x;
			const nl = Math.sqrt(nx * nx + ny * ny) || 1;
			edgeLabel.position.set(midX + (nx / nl) * 10, midY + (ny / nl) * 10);
			layers.starMapEdges.addChild(edgeLabel);
		}
		layers.starMapEdges.addChild(edgeGfx);

		// ═══════ 节点层 ═══════
		const nodeGfx = new Graphics();
		for (const node of nodes) {
			const isCurrent = node.id === fleetNodeId;
			const isReachable = reachableIds.has(node.id);
			const visible = node.explored || isHost;
			const r = isCurrent ? R.current : isReachable && !isCurrent ? R.reachable : R.node;
			const color = nodeColor(node, isCurrent);

			if (!visible) {
				// 未探索：灰点
				nodeGfx.circle(node.position.x, node.position.y, 4);
				nodeGfx.fill({ color: C.nodeDefault, alpha: 0.25 });
				continue;
			}

			// 可达光晕
			if (isReachable && !isCurrent) {
				nodeGfx.circle(node.position.x, node.position.y, r + 5);
				nodeGfx.fill({ color: C.reachableGlow, alpha: 0.08 });
			}

			// 当前位置脉冲
			if (isCurrent) {
				nodeGfx.circle(node.position.x, node.position.y, r + 8);
				nodeGfx.fill({ color: C.glow, alpha: 0.12 });
			}

			// 节点形状
			drawNodeShape(nodeGfx, node.position.x, node.position.y, r, node.type);
			nodeGfx.fill({ color, alpha: 0.9 });

			if (isCurrent) {
				drawNodeShape(nodeGfx, node.position.x, node.position.y, r, node.type);
				nodeGfx.stroke({ color: 0xffffff, width: 2, alpha: 0.7 });
			}

			// 节点名称
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
			label.cursor = isHost && isReachable && !isCurrent ? "pointer" : "default";

			// 点击航行 (仅 GM，仅可达非当前节点)
			if (isHost && isReachable && !isCurrent) {
				const nid = node.id;
				const nname = node.name;
				label.on("pointertap", () => {
					const sender = getGameActionSender();
					if (sender.isAvailable()) {
						sender
							.send("world:travel", { toNodeId: nid })
							.then((res: any) => {
								const msg = res?.encounterTriggered
									? `前往 ${nname} 途中遭遇敌情！`
									: `已到达 ${nname}`;
								window.dispatchEvent(
									new CustomEvent("stfcs-notification", {
										detail: {
											type: res?.encounterTriggered ? "warning" : "success",
											message: msg,
											duration: 3000,
										},
									})
								);
							})
							.catch(() => {
								window.dispatchEvent(
									new CustomEvent("stfcs-notification", {
										detail: { type: "error", message: `无法前往 ${nname}` },
									})
								);
							});
					}
				});
			}

			layers.starMapNodes.addChild(label);
		}
		layers.starMapNodes.addChild(nodeGfx);
	}, [layers, world, nodes.length, edges.length, fleetNodeId, isHost]);
}
