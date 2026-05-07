/**
 * WorldInfoPanel — 世界观信息面板
 *
 * 在 WORLD 模式下显示：当前节点信息、可达节点列表、时间线
 * 放置在 RightSidebar 中，替代战术面板
 */

import React, { useCallback, useMemo } from "react";
import { Flex, Text, Badge, Card, Button, Separator } from "@radix-ui/themes";
import { useGameState, useGamePlayerId } from "@/state/stores/gameStore";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import type { WorldMap, WorldNode, WorldEdge } from "@vt/data";
import { getReachableNodes } from "@vt/data";

const STATE_LABELS: Record<string, string> = {
	safe: "安全",
	threat: "威胁",
	cleared: "已清理",
	active: "活跃",
};

const STATE_COLORS: Record<string, "green" | "red" | "gray" | "blue"> = {
	safe: "green",
	threat: "red",
	cleared: "gray",
	active: "blue",
};

export const WorldInfoPanel: React.FC = () => {
	const gameState = useGameState();
	const playerId = useGamePlayerId();
	const { send } = useGameAction();

	const world = gameState?.world as WorldMap | undefined;
	const isHost = gameState?.players?.[playerId ?? ""]?.role === "HOST";
	const currentNode = world?.nodes?.find((n) => n.id === world?.fleetNodeId);
	const reachable = useMemo(() => {
		if (!world?.fleetNodeId) return [];
		return getReachableNodes(world, world.fleetNodeId);
	}, [world]);

	const handleExplore = useCallback(
		async (nodeId: string) => {
			if (!isHost) return;
			try {
				await send("world:explore", { nodeId } as any);
				notify.success("节点已揭示");
			} catch {
				notify.error("揭示失败");
			}
		},
		[isHost, send]
	);

	const handleTravel = useCallback(
		async (nodeId: string) => {
			if (!isHost) return;
			try {
				await send("world:travel", { toNodeId: nodeId });
			} catch {
				notify.error("航行失败");
			}
		},
		[isHost, send]
	);

	if (!world)
		return (
			<Text size="1" color="gray">
				未加载世界地图
			</Text>
		);

	return (
		<Flex direction="column" gap="2" style={{ height: "100%" }}>
			<Text size="1" weight="bold" style={{ color: "#4fc3ff" }}>
				星图信息
			</Text>
			<Separator size="4" />

			{/* 当前节点 */}
			<Card style={{ padding: "6px 8px" }}>
				<Text size="1" color="gray">
					当前位置
				</Text>
				<Text size="2" weight="bold">
					{currentNode?.name ?? "未知"}
				</Text>
				{currentNode?.description && (
					<Text size="1" style={{ color: "#8ba4c7", marginTop: 2 }}>
						{currentNode.explored || isHost ? currentNode.description : "???"}
					</Text>
				)}
				{currentNode && (
					<Flex gap="1" mt="1">
						<Badge size="1" color={STATE_COLORS[currentNode.state] ?? "gray"}>
							{STATE_LABELS[currentNode.state] ?? currentNode.state}
						</Badge>
						<Badge size="1" color="gray">
							{currentNode.type}
						</Badge>
					</Flex>
				)}
			</Card>

			{/* 可达节点 */}
			<Text size="1" weight="bold" style={{ color: "#8ba4c7", marginTop: 4 }}>
				可达航线
			</Text>
			{reachable.length === 0 ? (
				<Text size="1" color="gray">
					无可达节点
				</Text>
			) : (
				<Flex direction="column" gap="1">
					{reachable.map(({ node, edge }) => {
						const explored = node.explored || isHost;
						const edgeColor =
							edge.type === "perilous" ? "red" : edge.type === "unexplored" ? "gray" : "blue";
						return (
							<Card key={node.id} style={{ padding: "4px 6px" }}>
								<Flex align="center" justify="between" gap="2">
									<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
										<Text
											size="1"
											weight="bold"
											style={{ color: explored ? "#cfe8ff" : "#445566" }}
										>
											{explored ? node.name : "???"}
										</Text>
										<Text size="1" style={{ color: "#667788" }}>
											{edge.type === "trade_route"
												? "贸易航线"
												: edge.type === "perilous"
													? "危险航线"
													: edge.type === "unexplored"
														? "未勘测"
														: edge.type}
											{" · "}
											{edge.travelCost}日
											{edge.encounterChance > 0 &&
												` · ${Math.round(edge.encounterChance * 100)}%遭遇`}
										</Text>
									</Flex>
									{isHost && explored && node.id !== world?.fleetNodeId && (
										<Button size="1" variant="soft" onClick={() => handleTravel(node.id)}>
											前往
										</Button>
									)}
									{isHost && !explored && (
										<Button
											size="1"
											variant="soft"
											color="gray"
											onClick={() => handleExplore(node.id)}
										>
											揭示
										</Button>
									)}
								</Flex>
							</Card>
						);
					})}
				</Flex>
			)}

			{/* 时间线 */}
			{world.timeline && (
				<>
					<Separator size="4" />
					<Text size="1" style={{ color: "#667788" }}>
						第 {world.timeline.currentDay} 日
					</Text>
					{world.timeline.events && world.timeline.events.length > 0 && (
						<Flex direction="column" gap="1" style={{ maxHeight: 120, overflowY: "auto" }}>
							{[...world.timeline.events]
								.reverse()
								.slice(0, 10)
								.map((ev, i) => (
									<Text key={i} size="1" style={{ color: "#556677" }}>
										[D{ev.day}] {ev.description}
									</Text>
								))}
						</Flex>
					)}
				</>
			)}
		</Flex>
	);
};

export default WorldInfoPanel;
