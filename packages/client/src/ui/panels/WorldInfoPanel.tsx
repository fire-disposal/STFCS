/**
 * WorldInfoPanel — 星图信息面板
 *
 * 精简版：仅显示位置、节点描述、可达节点列表。
 * 遭遇概率、航行耗时等游戏机制细节由 GM 口述，系统不代劳。
 */

import React, { useCallback, useMemo } from "react";
import { Flex, Text, Card, Button, Separator } from "@radix-ui/themes";
import { useGameState, useGamePlayerId } from "@/state/stores/gameStore";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import type { WorldMap } from "@vt/data";
import { getReachableNodes } from "@vt/data";

const TYPE_LABELS: Record<string, string> = {
	star_system: "恒星系", nebula: "星云", anomaly: "异常区",
	waypoint: "航标", safe_haven: "安全港", hostile_zone: "敌对区", unknown: "未知",
};

const STATE_LABELS: Record<string, string> = {
	safe: "安全", threat: "威胁", cleared: "已清理", active: "活跃",
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

	const handleTravel = useCallback(async (nodeId: string) => {
		if (!isHost) return;
		try { await send("world:travel", { toNodeId: nodeId }); }
		catch { notify.error("航行失败"); }
	}, [isHost, send]);

	const handleExplore = useCallback(async (nodeId: string) => {
		if (!isHost) return;
		try { await send("world:explore", { nodeId } as any); notify.success("节点已揭示"); }
		catch { notify.error("揭示失败"); }
	}, [isHost, send]);

	if (!world) return <Text size="1" color="gray">未加载星图</Text>;

	return (
		<Flex direction="column" gap="2" style={{ height: "100%" }}>
			<Text size="1" weight="bold" style={{ color: "#4fc3ff" }}>星图信息</Text>
			<Separator size="4" />

			{/* 当前节点 */}
			<Card style={{ padding: "6px 8px" }}>
				<Text size="1" color="gray">当前位置</Text>
				<Text size="2" weight="bold" style={{ color: "#cfe8ff" }}>
					{currentNode?.name ?? "未知"}
				</Text>
				{currentNode?.description && (currentNode.explored || isHost) && (
					<Text size="1" style={{ color: "#8ba4c7", marginTop: 2 }}>
						{currentNode.description}
					</Text>
				)}
				{currentNode && (
					<Flex gap="2" mt="1">
						<Text size="1" style={{ color: "#667788" }}>
							{TYPE_LABELS[currentNode.type] ?? currentNode.type}
						</Text>
						<Text size="1" style={{ color: currentNode.state === "threat" ? "#ff6b6b" : "#2ecc71" }}>
							{STATE_LABELS[currentNode.state] ?? currentNode.state}
						</Text>
					</Flex>
				)}
			</Card>

			{/* 可达节点 */}
			<Text size="1" weight="bold" style={{ color: "#8ba4c7" }}>航线</Text>
			{reachable.length === 0 ? (
				<Text size="1" color="gray">无可达节点</Text>
			) : (
				<Flex direction="column" gap="1">
					{reachable.map(({ node, edge }) => {
						const explored = node.explored || isHost;
						return (
							<Card key={node.id} style={{ padding: "4px 8px" }}>
								<Flex align="center" justify="between" gap="2">
									<Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
										<Text size="1" weight="bold" style={{ color: explored ? "#cfe8ff" : "#445566" }}>
											{explored ? node.name : "???"}
										</Text>
									</Flex>
									{isHost && explored && node.id !== world?.fleetNodeId && (
										<Button size="1" variant="soft" onClick={() => handleTravel(node.id)}>前往</Button>
									)}
									{isHost && !explored && (
										<Button size="1" variant="soft" color="gray" onClick={() => handleExplore(node.id)}>揭示</Button>
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
					<Text size="1" style={{ color: "#667788" }}>第 {world.timeline.currentDay} 日</Text>
				</>
			)}
		</Flex>
	);
};

export default WorldInfoPanel;
