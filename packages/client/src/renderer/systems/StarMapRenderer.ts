/**
 * StarMapRenderer — 星图渲染 Hook
 *
 * 在 PixiJS 中渲染世界地图节点网络。
 * 仅 WORLD 模式下激活，复用相机的缩放/平移。
 *
 * 渲染层：
 * - world.starMapEdges (zIndex 6): 节点间连线
 * - world.starMapNodes (zIndex 7): 节点圆 + 名称标签
 */

import { Graphics, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";
import type { WorldMap, WorldNode, WorldEdge } from "@vt/data";
import { getGameActionSender } from "@/state/stores/gameStore";

// ── 颜色 ──
const C = {
	nodeDefault: 0x2a3d55,
	nodeExplored: 0x4a9eff,
	nodeCurrent: 0x4fc3ff,
	nodeHostile: 0xff4a4a,
	nodeSafe: 0x2ecc71,
	edgeTrade: 0x3a5a8a,
	edgePerilous: 0xe67e22,
	edgeHidden: 0x334455,
	edgeUnexplored: 0x334455,
	text: 0x8ba4c7,
	textBright: 0xcfe8ff,
	glow: 0x4fc3ff,
	bg: 0x0a0e14,
};

const NODE_RADIUS = 14;
const CURRENT_RADIUS = 20;

function getNodeColor(node: WorldNode, isCurrent: boolean): number {
	if (isCurrent) return C.nodeCurrent;
	if (!node.explored) return C.nodeDefault;
	if (node.state === "threat") return C.nodeHostile;
	if (node.state === "safe" || node.state === "cleared") return C.nodeSafe;
	return C.nodeExplored;
}

function getEdgeColor(edge: WorldEdge): number {
	if (edge.hidden && !edge.discovered) return C.edgeHidden;
	if (edge.type === "perilous") return C.edgePerilous;
	if (edge.type === "unexplored") return C.edgeUnexplored;
	return C.edgeTrade;
}

export function useStarMapRendering(
	layers: LayerRegistry | null,
	worldMap: WorldMap | undefined,
	isHost: boolean
): void {
	const edgesRef = useRef<Graphics | null>(null);
	const nodesRef = useRef<Graphics | null>(null);
	const labelsRef = useRef<Map<string, Text>>(new Map());

	const world = worldMap;
	const nodes = world?.nodes ?? [];
	const edges = world?.edges ?? [];
	const fleetNodeId = world?.fleetNodeId;

	useEffect(() => {
		if (!layers) return;

		// 清空旧内容
		layers.starMapEdges.removeChildren();
		layers.starMapNodes.removeChildren();
		labelsRef.current.clear();

		if (!world || nodes.length === 0) return;

		// ── 连线层（一次性 Graphics） ──
		const edgeGfx = new Graphics();
		for (const edge of edges) {
			const from = nodes.find((n) => n.id === edge.from);
			const to = nodes.find((n) => n.id === edge.to);
			if (!from || !to) continue;
			const hidden = edge.hidden && !edge.discovered;
			edgeGfx.moveTo(from.position.x, from.position.y);
			edgeGfx.lineTo(to.position.x, to.position.y);
			edgeGfx.stroke({
				color: getEdgeColor(edge),
				width: hidden ? 1 : 2,
				alpha: hidden ? 0.2 : 0.5,
			});
		}
		layers.starMapEdges.addChild(edgeGfx);
		edgesRef.current = edgeGfx;

		// ── 节点层（一次性 Graphics + Text） ──
		const nodeGfx = new Graphics();
		for (const node of nodes) {
			const isCurrent = node.id === fleetNodeId;
			const color = getNodeColor(node, isCurrent);
			const radius = isCurrent ? CURRENT_RADIUS : NODE_RADIUS;
			const visible = node.explored || isHost;

			if (!visible) continue;

			// 当前位置光晕
			if (isCurrent) {
				nodeGfx.circle(node.position.x, node.position.y, radius + 6);
				nodeGfx.fill({ color: C.glow, alpha: 0.15 });
			}

			// 节点圆
			nodeGfx.circle(node.position.x, node.position.y, radius);
			nodeGfx.fill({ color, alpha: visible ? 1 : 0.3 });

			if (isCurrent) {
				nodeGfx.circle(node.position.x, node.position.y, radius);
				nodeGfx.stroke({ color: 0xffffff, width: 2, alpha: 0.8 });
			}

			// 名称标签（Text）
			const label = new Text({
				text: node.name,
				style: new TextStyle({
					fontSize: 11,
					fill: isCurrent ? C.textBright : C.text,
					fontWeight: isCurrent ? "bold" : "normal",
				}),
			});
			label.anchor.set(0.5, 0);
			label.position.set(node.position.x, node.position.y + radius + 4);
			label.eventMode = "static";
			label.cursor = "pointer";

			if (isHost && !isCurrent) {
				const nid = node.id;
				const nname = node.name;
				label.on("pointertap", () => {
					const sender = getGameActionSender();
					if (sender.isAvailable()) {
						sender
							.send("world:travel", { toNodeId: nid })
							.then((res: any) => {
								if (res?.encounterTriggered) {
									window.dispatchEvent(
										new CustomEvent("stfcs-notification", {
											detail: {
												type: "warning",
												message: `前往 ${nname} 途中遭遇敌情！`,
												duration: 4000,
											},
										})
									);
								} else {
									window.dispatchEvent(
										new CustomEvent("stfcs-notification", {
											detail: { type: "success", message: `已到达 ${nname}`, duration: 2000 },
										})
									);
								}
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
			labelsRef.current.set(node.id, label);
		}
		layers.starMapNodes.addChild(nodeGfx);
		nodesRef.current = nodeGfx;
	}, [layers, world, nodes.length, edges.length, fleetNodeId, isHost]);
}
