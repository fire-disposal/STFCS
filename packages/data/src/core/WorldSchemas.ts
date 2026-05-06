/**
 * WorldSchemas — 世界观地图 Schema
 *
 * 三层嵌套架构的顶层（超空间/星系图）和中间层（恒星系/探索层）。
 * 与现有 GameSchemas.ts 的 GameMapSchema（战术层）共存。
 *
 * 设计原则：
 * 1. 节点网络，非开放 2D 平面（适配回合制桌游场景）
 * 2. 可选字段，现有存档无需迁移（world = undefined）
 * 3. GM 可控的信息揭示（FOW + hiddenDescription）
 */

import { z } from "zod";
import { PointSchema } from "./GameSchemas.js";

// ============================================================
// 节点类型
// ============================================================

export const WorldNodeTypeSchema = z.enum([
	"star_system",    // 恒星系 — 标准节点，可包含多个子区域
	"nebula",         // 星云区 — 遮蔽，探索
	"anomaly",        // 异常区 — 随机事件
	"waypoint",       // 航标 — 无人区域，补给
	"safe_haven",     // 安全港 — 完全安全，可交易/修复
	"hostile_zone",   // 敌对区 — 持续威胁
	"unknown",        // 未知区域 — GM 揭示前不可见
]);
export type WorldNodeType = z.infer<typeof WorldNodeTypeSchema>;

export const WorldNodeStateSchema = z.enum([
	"safe",        // 安全
	"threat",      // 有威胁
	"cleared",     // 已清理
	"active",      // 活跃/战斗中
]);
export type WorldNodeState = z.infer<typeof WorldNodeStateSchema>;

// ============================================================
// 连线类型
// ============================================================

export const WorldEdgeTypeSchema = z.enum([
	"trade_route",   // 贸易航线 — 安全
	"perilous",      // 危险航线 — 可能遭遇
	"unexplored",    // 未勘测 — 首次通过触发事件
	"blockade",      // 封锁线 — 需要特殊条件通过
	"hidden",        // 隐藏航线 — 发现后才可见
]);
export type WorldEdgeType = z.infer<typeof WorldEdgeTypeSchema>;

// ============================================================
// 地形预设（节点 → 战术地图）
// ============================================================

/**
 * 节点携带的地形预设配置。
 * 当在此节点触发战斗时，用于自动生成战术地图的地形。
 */
export const TerrainProfileSchema = z.object({
	// 地形密度（0-1，0=空地，1=密集地形）
	density: z.number().min(0).max(1).default(0.3),
	// 优先地形类型（随机生成时权重更高）
	preferredTypes: z.array(z.string()).optional(),
	// 固定地形（一定会出现在地图上）
	fixedFeatures: z.array(z.object({
		type: z.string(),
		count: z.number().min(1).max(10).default(1),
	})).optional(),
});
export type TerrainProfile = z.infer<typeof TerrainProfileSchema>;

// ============================================================
// 时间线事件
// ============================================================

export const TimelineEventSchema = z.object({
	day: z.number(),
	description: z.string(),
	nodeId: z.string().optional(),
	type: z.enum(["travel", "combat", "discovery", "trade", "story"]).optional(),
});
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;

// ============================================================
// 节点 Schema
// ============================================================

export const WorldNodeSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: WorldNodeTypeSchema,
	/** 在星图上的位置（用于可视化布局，非自由移动坐标） */
	position: PointSchema,
	/** GM 可见的描述文本 */
	description: z.string().optional(),
	/** 仅在玩家探索后揭示的描述 */
	hiddenDescription: z.string().optional(),
	/** 是否已探索/揭示 */
	explored: z.boolean().default(false),
	/** 当前安全状态 */
	state: WorldNodeStateSchema.default("safe"),
	/** GM 标签 */
	tags: z.array(z.string()).optional(),
	/** 在此节点触发战斗时使用的地形预设 */
	terrainProfile: TerrainProfileSchema.optional(),
	/** 关联的战斗预设 ID（可选，进入时触发） */
	encounterPresetId: z.string().optional(),
	/** 自定义数据（GM 扩展用） */
	metadata: z.record(z.string(), z.unknown()).optional(),
});
export type WorldNode = z.infer<typeof WorldNodeSchema>;

// ============================================================
// 连线 Schema
// ============================================================

export const WorldEdgeSchema = z.object({
	id: z.string(),
	from: z.string(),          // 源节点 ID
	to: z.string(),             // 目标节点 ID
	type: WorldEdgeTypeSchema,
	/** 航行消耗（天数/资源单位） */
	travelCost: z.number().min(1).default(1),
	/** 遭遇概率（0-1，每次通过时判定） */
	encounterChance: z.number().min(0).max(1).default(0),
	/** 隐藏连线（需发现才可见） */
	hidden: z.boolean().default(false),
	/** 是否已发现（hidden 连线用） */
	discovered: z.boolean().default(false),
	/** GM 标注 */
	label: z.string().optional(),
});
export type WorldEdge = z.infer<typeof WorldEdgeSchema>;

// ============================================================
// 世界观地图 Schema
// ============================================================

export const WorldMapSchema = z.object({
	/** 星图名称 */
	name: z.string().default("未知星域"),
	/** 节点网络 */
	nodes: z.array(WorldNodeSchema),
	edges: z.array(WorldEdgeSchema),
	/** 舰队当前位置 */
	fleetNodeId: z.string().optional(),
	/** 最近访问历史 */
	nodeHistory: z.array(z.string()).optional(),
	/** 游戏内时间线 */
	timeline: z.object({
		currentDay: z.number().default(1),
		events: z.array(TimelineEventSchema).optional(),
	}).optional(),
	/** GM 笔记 */
	gmNotes: z.string().optional(),
	/** 星图外观 */
	appearance: z.object({
		fogOfWar: z.boolean().default(true),
	}).optional(),
});
export type WorldMap = z.infer<typeof WorldMapSchema>;

// ============================================================
// 验证与工具函数
// ============================================================

/** 验证世界地图数据的完整性 */
export function validateWorldMap(map: unknown): WorldMap {
	return WorldMapSchema.parse(map);
}

/** 获取某节点的所有可达邻居 */
export function getReachableNodes(map: WorldMap, nodeId: string): { node: WorldNode; edge: WorldEdge }[] {
	const results: { node: WorldNode; edge: WorldEdge }[] = [];
	const nodeMap = new Map(map.nodes.map((n) => [n.id, n]));

	for (const edge of map.edges) {
		if (edge.hidden && !edge.discovered) continue;
		let neighborId: string | null = null;

		if (edge.from === nodeId) neighborId = edge.to;
		else if (edge.to === nodeId) neighborId = edge.from;

		if (neighborId) {
			const node = nodeMap.get(neighborId);
			if (node) results.push({ node, edge });
		}
	}

	return results;
}

/** 检查舰队是否可以从某节点航行到另一节点 */
export function canTravel(map: WorldMap, fromId: string, toId: string): { can: boolean; edge?: WorldEdge; reason?: string } {
	const edge = map.edges.find(
		(e) => (e.from === fromId && e.to === toId) || (e.from === toId && e.to === fromId)
	);

	if (!edge) return { can: false, reason: "没有可到达的航线" };
	if (edge.hidden && !edge.discovered) return { can: false, reason: "航线未发现" };

	return { can: true, edge };
}

/** 推进游戏时间并记录事件 */
export function advanceDay(map: WorldMap, days: number, event?: TimelineEvent): WorldMap {
	if (!map.timeline) map.timeline = { currentDay: 1 };
	map.timeline.currentDay += days;
	if (event) {
		if (!map.timeline.events) map.timeline.events = [];
		map.timeline.events.push(event);
	}
	return map;
}
