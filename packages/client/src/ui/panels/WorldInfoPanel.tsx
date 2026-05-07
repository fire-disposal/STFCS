/**
 * WorldInfoPanel — 星图信息面板
 *
 * 支持讨论→确认→执行的桌游流程：
 * 1. 所有人可点击节点「指向」（高亮标记，不触发行动）
 * 2. 玩家讨论决策
 * 3. DM 确认执行
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Flex, Text, Card, Button, Separator } from "@radix-ui/themes";
import { useGameState, useGamePlayerId } from "@/state/stores/gameStore";
import { useGameAction } from "@/hooks/useGameAction";
import { notify } from "@/ui/shared/Notification";
import type { WorldMap } from "@vt/data";
import { getReachableNodes } from "@vt/data";

const TYPE_LABELS: Record<string, string> = {
	star_system: "恒星系",
	nebula: "星云",
	anomaly: "异常区",
	waypoint: "航标",
	safe_haven: "安全港",
	hostile_zone: "敌对区",
	unknown: "未知",
};

const STATE_LABELS: Record<string, string> = {
	safe: "安全",
	threat: "威胁",
	cleared: "已清理",
	active: "活跃",
};

export const WorldInfoPanel: React.FC = () => {
	const gameState = useGameState();
	const playerId = useGamePlayerId();
	const { send } = useGameAction();

	const world = gameState?.world as WorldMap | undefined;
	const isHost = gameState?.players?.[playerId ?? ""]?.role === "HOST";

	// 当前「指向」的节点（讨论用，不触发行动）
	const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);

	// 监听星图节点选择事件
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			if (detail?.nodeId) setPendingNodeId(detail.nodeId);
		};
		window.addEventListener("starmap:node-select", handler);
		return () => window.removeEventListener("starmap:node-select", handler);
	}, []);

	const currentNode = world?.nodes?.find((n) => n.id === world?.fleetNodeId);
	const pendingNode = world?.nodes?.find((n) => n.id === pendingNodeId);
	const reachable = useMemo(() => {
		if (!world?.fleetNodeId) return [];
		return getReachableNodes(world, world.fleetNodeId);
	}, [world]);

	// 确认航行（仅 DM）
	const handleConfirmTravel = useCallback(async () => {
		if (!isHost || !pendingNodeId) return;
		const targetId = pendingNodeId;
		setPendingNodeId(null); // 即刻清除，防重复点击
		await send("world:travel", { toNodeId: targetId }).catch(() => notify.error("航行失败"));
	}, [isHost, pendingNodeId, send]);

	// 揭示节点（仅 DM）
	const handleExplore = useCallback(
		async (nodeId: string) => {
			if (!isHost) return;
			await send("world:explore", { nodeId } as any).catch(() => notify.error("揭示失败"));
		},
		[isHost, send]
	);

	if (!world)
		return (
			<Text size="1" color="gray">
				未加载星图
			</Text>
		);

	return (
		<Flex direction="column" gap="2" style={{ height: "100%" }}>
			<Text size="1" weight="bold" style={{ color: "#4fc3ff" }}>
				星图
			</Text>
			<Separator size="4" />

			{/* 当前节点 */}
			<Card style={{ padding: "6px 8px" }}>
				<Text size="1" color="gray">
					当前位置
				</Text>
				<Text size="2" weight="bold" style={{ color: "#cfe8ff" }}>
					{currentNode?.name ?? "未知"}
				</Text>
				{currentNode?.description && (
					<Text size="1" style={{ color: "#8ba4c7", marginTop: 2 }}>
						{currentNode.description}
					</Text>
				)}
				{currentNode && (
					<Flex gap="2" mt="1">
						<Text size="1" style={{ color: "#667788" }}>
							{TYPE_LABELS[currentNode.type] ?? currentNode.type}
						</Text>
						<Text
							size="1"
							style={{ color: currentNode.state === "threat" ? "#ff6b6b" : "#2ecc71" }}
						>
							{STATE_LABELS[currentNode.state] ?? currentNode.state}
						</Text>
					</Flex>
				)}
			</Card>

			{/* 指向节点（讨论决策区） */}
			{pendingNode && (
				<Card style={{ padding: "6px 8px", borderColor: "#ffd54f", borderWidth: 1 }}>
					<Flex align="center" justify="between" gap="2">
						<Flex direction="column">
							<Text size="1" color="gray">
								讨论目标
							</Text>
							<Text size="2" weight="bold" style={{ color: "#ffd54f" }}>
								{pendingNode.name}
							</Text>
							{pendingNode.description && (
								<Text size="1" style={{ color: "#8ba4c7", marginTop: 1 }}>
									{pendingNode.description}
								</Text>
							)}
						</Flex>
						{isHost && (
							<Button size="1" variant="solid" color="blue" onClick={handleConfirmTravel}>
								出发
							</Button>
						)}
					</Flex>
				</Card>
			)}

			{/* 航线列表 */}
			<Text size="1" weight="bold" style={{ color: "#8ba4c7" }}>
				航线
			</Text>
			{reachable.length === 0 ? (
				<Text size="1" color="gray">
					无可达节点
				</Text>
			) : (
				<Flex direction="column" gap="1">
					{reachable.map(({ node, edge }) => {
						const explored = node.explored || isHost;
						const isPending = node.id === pendingNodeId;
						return (
							<Card
								key={node.id}
								style={{
									padding: "4px 8px",
									borderColor: isPending ? "#ffd54f" : undefined,
									borderWidth: isPending ? 1 : 0,
								}}
							>
								<Flex align="center" justify="between" gap="2">
									<Text size="1" weight="bold" style={{ color: explored ? "#cfe8ff" : "#445566" }}>
										{explored ? node.name : "???"}
									</Text>
									<Flex gap="1">
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
				</>
			)}
		</Flex>
	);
};

export default WorldInfoPanel;
