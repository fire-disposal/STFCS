/**
 * 世界观航行规则
 *
 * 处理舰队在星图节点间的移动、遭遇判定、时间推进。
 *
 * 与现有战斗系统的交互：
 * - 航行结束后如果触发了遭遇，生成战术地图并切换到 PLAYER_ACTION
 * - 战斗结束后自动返回世界观层
 * - 舰船损伤/辐能在航行和战斗间持续
 */

import type { WorldMap, WorldNode, WorldEdge, TimelineEvent } from "@vt/data";
import { getReachableNodes } from "@vt/data";

// ==================== 航行结果类型 ====================

export interface TravelResult {
	success: boolean;
	error?: string | undefined;
	/** 航行后的世界地图状态 */
	worldMap: WorldMap;
	/** 消耗的天数 */
	daysElapsed: number;
	/** 是否触发遭遇 */
	encounterTriggered: boolean;
	/** 遭遇预设 ID（如果有） */
	encounterPresetId?: string | undefined;
	/** 航行日志事件 */
	logEvent: TimelineEvent;
	/** 当前节点信息 */
	currentNode: WorldNode | undefined;
}

export interface TravelValidation {
	valid: boolean;
	error?: string;
	/** 目标节点 */
	targetNode?: WorldNode;
	/** 连线 */
	edge?: WorldEdge;
}

// ==================== 验证 ====================

/**
 * 验证航行请求
 */
export function validateTravel(
	worldMap: WorldMap,
	fromId: string,
	toId: string
): TravelValidation {
	const reachable = getReachableNodes(worldMap, fromId);
	const target = reachable.find((r) => r.node.id === toId);

	if (!target) {
		return { valid: false, error: "目标节点不可达" };
	}

	// 封锁线检查
	if (target.edge.type === "blockade") {
		return { valid: false, error: "航线被封锁，无法通行" };
	}

	return {
		valid: true,
		targetNode: target.node,
		edge: target.edge,
	};
}

// ==================== 遭遇判定 ====================

export interface EncounterRollResult {
	triggered: boolean;
	presetId?: string | undefined;
}

/**
 * 抛骰判定是否触发遭遇
 */
export function rollEncounter(edge: WorldEdge): EncounterRollResult {
	if (edge.encounterChance <= 0) {
		return { triggered: false };
	}

	const roll = Math.random();
	const triggered = roll < edge.encounterChance;

	return {
		triggered,
		presetId: triggered ? undefined : undefined,
	};
}

// ==================== 航行执行 ====================

/**
 * 执行节点间航行
 *
 * @param worldMap 当前世界地图状态
 * @param fromId 出发节点 ID
 * @param toId 目标节点 ID
 * @returns 航行结果
 */
export function executeTravel(
	worldMap: WorldMap,
	fromId: string,
	toId: string
): TravelResult {
	const validation = validateTravel(worldMap, fromId, toId);
	if (!validation.valid || !validation.edge) {
		return {
			success: false,
			error: validation.error ?? "航行验证失败",
			worldMap,
			daysElapsed: 0,
			encounterTriggered: false,
			logEvent: { day: worldMap.timeline?.currentDay ?? 1, description: "航行失败" },
			currentNode: worldMap.nodes.find((n) => n.id === fromId),
		};
	}

	const edge = validation.edge;
	const targetNode = validation.targetNode!;
	const daysElapsed = edge.travelCost;

	// 遭遇判定
	const encounter = rollEncounter(edge);

	// 标记未勘测航线为已探明
	if (edge.type === "unexplored") {
		edge.type = "trade_route" as any;
	}

	// 标记隐藏连线为已发现
	if (edge.hidden) {
		edge.discovered = true;
	}

	// 更新舰队位置
	worldMap.fleetNodeId = toId;

	// 更新节点历史
	if (!worldMap.nodeHistory) worldMap.nodeHistory = [];
	worldMap.nodeHistory.push(toId);

	// 推进时间
	if (!worldMap.timeline) worldMap.timeline = { currentDay: 1 };
	worldMap.timeline.currentDay += daysElapsed;

	// 标记目标节点为已探索
	targetNode.explored = true;

	// 创建日志事件
	const logEvent: TimelineEvent = {
		day: worldMap.timeline.currentDay,
		description: encounter.triggered
			? `航行至 ${targetNode.name}（途中遭遇）`
			: `航行至 ${targetNode.name}`,
		nodeId: toId,
		type: encounter.triggered ? "combat" : "travel",
	};

	if (!worldMap.timeline.events) worldMap.timeline.events = [];
	worldMap.timeline.events.push(logEvent);

	return {
		success: true,
		worldMap,
		daysElapsed,
		encounterTriggered: encounter.triggered,
		encounterPresetId: targetNode.encounterPresetId,
		logEvent,
		currentNode: targetNode,
	};
}

// ==================== 节点探索 ====================

/**
 * 揭示/探索节点（GM 操作或自动触发）
 */
export function exploreNode(
	worldMap: WorldMap,
	nodeId: string
): { worldMap: WorldMap; node: WorldNode | undefined } {
	const node = worldMap.nodes.find((n) => n.id === nodeId);
	if (!node) return { worldMap, node: undefined };

	node.explored = true;

	return { worldMap, node };
}

/**
 * 获取星图统计信息
 */
export function getWorldStats(worldMap: WorldMap): {
	totalNodes: number;
	exploredNodes: number;
	currentDay: number;
	currentNode: WorldNode | undefined;
	reachableNodes: { node: WorldNode; edge: WorldEdge }[];
} {
	const currentNode = worldMap.nodes.find((n) => n.id === worldMap.fleetNodeId);
	const reachable = worldMap.fleetNodeId
		? getReachableNodes(worldMap, worldMap.fleetNodeId)
		: [];

	return {
		totalNodes: worldMap.nodes.length,
		exploredNodes: worldMap.nodes.filter((n) => n.explored).length,
		currentDay: worldMap.timeline?.currentDay ?? 1,
		currentNode,
		reachableNodes: reachable,
	};
}
