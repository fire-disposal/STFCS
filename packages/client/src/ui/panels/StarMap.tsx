/**
 * StarMap — 星图组件
 *
 * 在 WORLD 模式下渲染节点网络，替代 PixiJS 画布。
 * 使用纯 SVG + React，避免引入额外渲染引擎。
 */

import React, { useCallback, useMemo } from "react";
import { useGameState, useGamePlayerId } from "@/state/stores/gameStore";
import type { WorldMap, WorldNode, WorldEdge } from "@vt/data";
import { useGameAction } from "@/hooks/useGameAction";

// ==================== 颜色常量 ====================

const COLORS = {
	bg: "#0a0e14",
	nodeDefault: "#2a3d55",
	nodeExplored: "#4a9eff",
	nodeCurrent: "#4fc3ff",
	nodeHostile: "#ff4a4a",
	nodeSafe: "#2ecc71",
	edgeTrade: "#3a5a8a",
	edgePerilous: "#e67e22",
	edgeHidden: "#445566",
	edgeUnexplored: "#445566",
	text: "#8ba4c7",
	textBright: "#cfe8ff",
	gmNote: "#6b8aaa",
};

// ==================== 节点形状 ====================

const NODE_RADIUS = 20;
const CURRENT_RADIUS = 26;

/** 获取节点颜色 */
function getNodeColor(node: WorldNode, isCurrent: boolean): string {
	if (isCurrent) return COLORS.nodeCurrent;
	if (!node.explored) return COLORS.nodeDefault;
	if (node.state === "threat") return COLORS.nodeHostile;
	if (node.state === "safe" || node.state === "cleared") return COLORS.nodeSafe;
	return COLORS.nodeExplored;
}

/** 获取连线颜色 */
function getEdgeColor(edge: WorldEdge): string {
	if (edge.hidden && !edge.discovered) return COLORS.edgeHidden;
	if (edge.type === "perilous") return COLORS.edgePerilous;
	if (edge.type === "unexplored") return COLORS.edgeUnexplored;
	return COLORS.edgeTrade;
}

// ==================== 星图组件 ====================

export const StarMap: React.FC = () => {
	const gameState = useGameState();
	const playerId = useGamePlayerId();
	const { send } = useGameAction();

	const world = gameState?.world as WorldMap | undefined;
	const isHost = gameState?.players?.[playerId ?? ""]?.role === "HOST";

	const nodes = world?.nodes ?? [];
	const edges = world?.edges ?? [];
	const fleetNodeId = world?.fleetNodeId;
	const currentDay = world?.timeline?.currentDay ?? 1;

	// 计算视口偏移：居中到舰队位置
	const viewBox = useMemo(() => {
		if (nodes.length === 0) return "-200 -200 400 400";
		const current = nodes.find((n) => n.id === fleetNodeId);
		const cx = current?.position?.x ?? 0;
		const cy = current?.position?.y ?? 0;
		return `${cx - 300} ${cy - 300} 600 600`;
	}, [nodes, fleetNodeId]);

	// 节点点击处理
	const handleNodeClick = useCallback(
		(nodeId: string) => {
			if (!isHost || !fleetNodeId) return;
			// GM 点击可达节点触发航行
			void send("world:travel", { toNodeId: nodeId as any }).catch(() => {});
		},
		[isHost, fleetNodeId, send]
	);

	// 空状态
	if (nodes.length === 0) {
		return (
			<div className="starmap-container">
				<div className="starmap-empty">暂无星图数据</div>
			</div>
		);
	}

	return (
		<div className="starmap-container">
			{/* SVG 星图 */}
			<svg viewBox={viewBox} className="starmap-svg" preserveAspectRatio="xMidYMid meet">
				{/* 连线 */}
				{edges.map((edge) => {
					const from = nodes.find((n) => n.id === edge.from);
					const to = nodes.find((n) => n.id === edge.to);
					if (!from || !to) return null;
					const hidden = edge.hidden && !edge.discovered;
					return (
						<line
							key={edge.id}
							x1={from.position.x}
							y1={from.position.y}
							x2={to.position.x}
							y2={to.position.y}
							stroke={getEdgeColor(edge)}
							strokeWidth={hidden ? 1 : 2}
							strokeDasharray={hidden || edge.type === "unexplored" ? "4 4" : undefined}
							opacity={hidden ? 0.2 : 0.6}
							className="starmap-edge"
						/>
					);
				})}

				{/* 节点 */}
				{nodes.map((node) => {
					const isCurrent = node.id === fleetNodeId;
					const isReachable = edges.some(
						(e) =>
							!e.hidden &&
							((e.from === fleetNodeId && e.to === node.id) ||
								(e.to === fleetNodeId && e.from === node.id))
					);
					const color = getNodeColor(node, isCurrent);
					const radius = isCurrent ? CURRENT_RADIUS : NODE_RADIUS;

					return (
						<g
							key={node.id}
							onClick={() => handleNodeClick(node.id)}
							style={{ cursor: isReachable && isHost ? "pointer" : "default" }}
						>
							{/* 节点光晕（当前位置） */}
							{isCurrent && (
								<circle
									cx={node.position.x}
									cy={node.position.y}
									r={radius + 8}
									fill="none"
									stroke={COLORS.nodeCurrent}
									strokeWidth={1}
									opacity={0.4}
									className="starmap-pulse"
								/>
							)}
							{/* 节点圆 */}
							<circle
								cx={node.position.x}
								cy={node.position.y}
								r={radius}
								fill={node.explored || isHost ? color : COLORS.nodeDefault}
								stroke={isCurrent ? "#ffffff" : "transparent"}
								strokeWidth={isCurrent ? 2 : 0}
								opacity={node.explored || isHost ? 1 : 0.3}
							/>
							{/* 节点名称 */}
							{(node.explored || isHost) && (
								<text
									x={node.position.x}
									y={node.position.y + radius + 14}
									textAnchor="middle"
									fill={COLORS.text}
									fontSize="10"
									fontWeight={isCurrent ? "bold" : "normal"}
								>
									{node.name}
								</text>
							)}
						</g>
					);
				})}
			</svg>

			{/* 底部信息栏 */}
			<div className="starmap-info">
				<span className="starmap-day">第 {currentDay} 日</span>
				<span className="starmap-location">
					当前位置：{nodes.find((n) => n.id === fleetNodeId)?.name ?? "未知"}
				</span>
				<span className="starmap-hint">
					{isHost ? "点击节点进行航行（GM）" : "等待 GM 操作星图"}
				</span>
			</div>
		</div>
	);
};

export default StarMap;
