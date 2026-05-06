/**
 * 世界观预设验证函数
 *
 * 在服务端启动时验证世界地图预设数据的合法性。
 * 检查节点网络连通性、必填字段、枚举值等。
 */

import { WorldMapSchema } from "./WorldSchemas.js";
import { presetWorlds } from "../presets/world/index.js";
import type { PresetValidationIssue, PresetValidationItem, PresetValidationResult } from "./validatePresets.js";

// ============================================================
// 验证函数
// ============================================================

function validateNode(node: Record<string, unknown>, index: number): PresetValidationIssue[] {
	const issues: PresetValidationIssue[] = [];
	const path = `nodes[${index}]`;

	if (!node["id"]) issues.push({ path: `${path}.id`, message: "缺少必填字段 id" });
	if (!node["name"]) issues.push({ path: `${path}.name`, message: "缺少必填字段 name" });
	if (!node["type"]) issues.push({ path: `${path}.type`, message: "缺少必填字段 type" });

	if (node["position"] === undefined) {
		issues.push({ path: `${path}.position`, message: "缺少必填字段 position" });
	} else {
		const pos = node["position"] as Record<string, unknown>;
		if (typeof pos["x"] !== "number") issues.push({ path: `${path}.position.x`, message: "必须为数字" });
		if (typeof pos["y"] !== "number") issues.push({ path: `${path}.position.y`, message: "必须为数字" });
	}

	return issues;
}

function validateEdge(edge: Record<string, unknown>, index: number, nodeIds: Set<string>): PresetValidationIssue[] {
	const issues: PresetValidationIssue[] = [];
	const path = `edges[${index}]`;

	if (!edge["id"]) issues.push({ path: `${path}.id`, message: "缺少必填字段 id" });

	const from = edge["from"] as string;
	const to = edge["to"] as string;

	if (!from) {
		issues.push({ path: `${path}.from`, message: "缺少必填字段 from" });
	} else if (!nodeIds.has(from)) {
		issues.push({ path: `${path}.from`, message: `引用不存在的节点: ${from}` });
	}

	if (!to) {
		issues.push({ path: `${path}.to`, message: "缺少必填字段 to" });
	} else if (!nodeIds.has(to)) {
		issues.push({ path: `${path}.to`, message: `引用不存在的节点: ${to}` });
	}

	const ch = edge["encounterChance"] as number;
	if (ch !== undefined && (ch < 0 || ch > 1)) {
		issues.push({ path: `${path}.encounterChance`, message: `值 ${ch} 超出范围 [0, 1]` });
	}

	const cost = edge["travelCost"] as number;
	if (cost !== undefined && cost < 1) {
		issues.push({ path: `${path}.travelCost`, message: `值 ${cost} 必须 >= 1` });
	}

	return issues;
}

export function validateWorldPresets(): PresetValidationResult {
	const worlds: PresetValidationItem[] = [];
	let totalIssues = 0;

	for (const [worldId, worldData] of Object.entries(presetWorlds)) {
		const issues: PresetValidationIssue[] = [];
		const raw = worldData as Record<string, unknown>;

		// 1. WorldMapSchema 严格验证
		const schemaResult = WorldMapSchema.safeParse(raw);
		if (!schemaResult.success) {
			for (const issue of schemaResult.error.issues) {
				issues.push({
					path: issue.path.join("."),
					message: issue.message,
				});
				totalIssues++;
			}
		} else {
			// 2. 节点验证
			const nodes = (raw["nodes"] as Record<string, unknown>[]) ?? [];
			const nodeIds = new Set<string>();
			for (let i = 0; i < nodes.length; i++) {
				const nodeIssues = validateNode(nodes[i]!, i);
				for (const ni of nodeIssues) {
					issues.push(ni);
					totalIssues++;
				}
				const nid = nodes[i]!["id"] as string;
				if (nid) nodeIds.add(nid);
			}

			// 3. 连线验证
			const edges = (raw["edges"] as Record<string, unknown>[]) ?? [];
			for (let i = 0; i < edges.length; i++) {
				const edgeIssues = validateEdge(edges[i]!, i, nodeIds);
				for (const ei of edgeIssues) {
					issues.push(ei);
					totalIssues++;
				}
			}

			// 4. 舰队位置检查
			const fleetNodeId = raw["fleetNodeId"] as string;
			if (fleetNodeId && !nodeIds.has(fleetNodeId)) {
				issues.push({ path: "fleetNodeId", message: `引用了不存在的节点: ${fleetNodeId}` });
				totalIssues++;
			}

			// 5. 孤立节点检查（没有任何连线连接的节点）
			const connectedNodes = new Set<string>();
			for (const edge of edges) {
				if (edge["from"]) connectedNodes.add(edge["from"] as string);
				if (edge["to"]) connectedNodes.add(edge["to"] as string);
			}
			for (const nid of nodeIds) {
				if (!connectedNodes.has(nid)) {
					issues.push({ path: `nodes[${nid}]`, message: `节点 "${nodes.find(n => n["id"] === nid)?.["name"] ?? nid}" 没有连线连接，玩家无法到达` });
					totalIssues++;
				}
			}

			// 6. 可达性检查（起始节点到所有节点的最短路径）
			if (fleetNodeId && nodeIds.size > 1) {
				const unreachable = findUnreachableNodes(fleetNodeId, edges, nodeIds);
				for (const nid of unreachable) {
					if (nid !== fleetNodeId) {
						issues.push({ path: `connectivity`, message: `节点 "${nodes.find(n => n["id"] === nid)?.["name"] ?? nid}" 从起始节点不可达` });
						totalIssues++;
					}
				}
			}
		}

		worlds.push({
			id: worldId,
			name: (raw["name"] as string) ?? worldId,
			issues,
			passed: issues.length === 0,
		});
	}

	return {
		ships: [],
		weapons: [],
		totalShips: 0,
		totalWeapons: 0,
		totalIssues,
		passed: totalIssues === 0,
		worlds,
	} as PresetValidationResult & { worlds: PresetValidationItem[] };
}

/**
 * BFS 查找从起始节点不可达的节点
 */
function findUnreachableNodes(
	startId: string,
	edges: Record<string, unknown>[],
	allNodeIds: Set<string>
): string[] {
	const adjacency = new Map<string, string[]>();
	for (const nid of allNodeIds) adjacency.set(nid, []);

	for (const edge of edges) {
		const from = edge["from"] as string;
		const to = edge["to"] as string;
		if (from && to) {
			adjacency.get(from)?.push(to);
			adjacency.get(to)?.push(from);
		}
	}

	const visited = new Set<string>();
	const queue = [startId];
	visited.add(startId);

	while (queue.length > 0) {
		const current = queue.shift()!;
		for (const neighbor of adjacency.get(current) ?? []) {
			if (!visited.has(neighbor)) {
				visited.add(neighbor);
				queue.push(neighbor);
			}
		}
	}

	return Array.from(allNodeIds).filter((id) => !visited.has(id));
}
