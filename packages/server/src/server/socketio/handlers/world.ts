/**
 * world namespace handlers — 世界观地图操作
 *
 * 功能：
 * - travel:       舰队在节点间航行
 * - explore:      揭示/探索节点
 * - query:        查询星图状态
 * - manage:       GM 管理节点/连线（增删改）
 *
 * 依赖：
 * - 房间状态中 world: WorldMap 字段（可选）
 * - 未启用世界观模式时返回对应错误
 */

import { err } from "./err.js";
import { ErrorCodes, createBattleLogEvent, GameMode } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";
import {
	executeTravel,
	exploreNode,
	getWorldStats,
} from "../../../core/engine/rules/worldTravel.js";
import { generateTerrainFromProfile } from "../../../core/engine/modules/terrain.js";

// ==================== WS 事件定义 ====================

/**
 * world:travel — 舰队航行到目标节点
 * payload: { toNodeId: string }
 * 自动处理：验证 → 遭遇判定 → 推进时间 → 更新队伍位置
 * 如果触发遭遇，同时生成战术地图地形并返回 terrain
 */
export const worldHandlers = {
	travel: async (payload: unknown, ctx: RpcContext) => {
		ctx.requireRoom();
		ctx.requireHost(); // GM 触发航行（或玩家经 GM 确认）

		const p = payload as { toNodeId: string };
		const room = ctx.room!;
		const state = room.getStateManager().getState();

		if (!state.world) {
			throw err("未启用世界观模式", ErrorCodes.ERROR);
		}

		if (!state.world.fleetNodeId) {
			throw err("舰队未部署", ErrorCodes.ERROR);
		}

		const result = executeTravel(state.world, state.world.fleetNodeId, p.toNodeId);

		if (!result.success) {
			throw err(result.error ?? "航行失败", ErrorCodes.ERROR);
		}

		// 更新房间状态中的世界地图
		ctx.state.mutateAndBroadcast((draft) => {
			draft.world = result.worldMap;
		});

		// 如果触发遭遇，自动切换到战斗模式并生成地形
		if (result.encounterTriggered) {
			ctx.state.setMode(GameMode.COMBAT);
			if (result.currentNode?.terrainProfile) {
				const terrain = generateTerrainFromProfile(result.currentNode.terrainProfile, 2000, 2000);
				ctx.state.mutateAndBroadcast((draft) => {
					if (!draft.map) {
						draft.map = {
							$id: `combat_${Date.now()}`,
							name: result.currentNode?.name ?? "战斗区域",
							size: { width: 2000, height: 2000 },
							metadata: { name: result.currentNode?.name ?? "战斗区域" },
						};
					}
					draft.map.terrain = terrain;
				});
			}
		}

		// 写入战斗日志
		ctx.state.appendLog(
			createBattleLogEvent("travel", {
				fromNode: state.world?.fleetNodeId,
				toNode: p.toNodeId,
				toNodeName: result.currentNode?.name ?? p.toNodeId,
				daysElapsed: result.daysElapsed,
				encounterTriggered: result.encounterTriggered,
			})
		);

		// 如果触发遭遇，生成战术地形
		let terrain: any[] | undefined;
		if (result.encounterTriggered && result.currentNode?.terrainProfile) {
			const mapWidth = 2000;
			const mapHeight = 2000;
			terrain = generateTerrainFromProfile(result.currentNode.terrainProfile, mapWidth, mapHeight);
		}

		return {
			success: true,
			worldMap: result.worldMap,
			currentNode: result.currentNode,
			encounterTriggered: result.encounterTriggered,
			terrain,
			logEvent: result.logEvent,
		};
	},

	// ==================== 探索 ====================

	/**
	 * world:explore — 揭示/探索节点
	 */
	explore: async (payload: unknown, ctx: RpcContext) => {
		ctx.requireRoom();
		ctx.requireHost();

		const p = payload as { nodeId: string };
		const state = ctx.state.getState();

		if (!state.world) {
			throw err("未启用世界观模式", ErrorCodes.ERROR);
		}

		const result = exploreNode(state.world, p.nodeId);
		if (!result.node) {
			throw err("节点不存在", ErrorCodes.ERROR);
		}

		ctx.state.mutateAndBroadcast((draft) => {
			draft.world = result.worldMap;
		});

		ctx.state.appendLog(
			createBattleLogEvent("explore", {
				nodeId: p.nodeId,
				nodeName: result.node.name,
				hiddenDescription: result.node.hiddenDescription,
			})
		);

		return {
			success: true,
			node: result.node,
		};
	},

	// ==================== 进入战斗 ====================

	/**
	 * world:enter_combat — 从 WORLD 模式进入 COMBAT 模式
	 * 由 GM 手动触发（或 travel 自动触发时由客户端调用）
	 * 效果：切换 mode、生成战术地形、初始化 turn
	 */
	enter_combat: async (_payload: unknown, ctx: RpcContext) => {
		ctx.requireRoom();
		ctx.requireHost();

		const state = ctx.state.getState();
		if (!state.world) {
			throw err("未启用世界观模式", ErrorCodes.ERROR);
		}
		if (state.mode !== GameMode.WORLD) {
			throw err("当前模式不允许进入战斗", ErrorCodes.ERROR);
		}

		// 获取当前节点的地形预设
		const currentNode = state.world.nodes.find((n) => n.id === state.world?.fleetNodeId);
		let generatedTerrain: any[] | undefined;
		if (currentNode?.terrainProfile) {
			generatedTerrain = generateTerrainFromProfile(currentNode.terrainProfile, 2000, 2000);
		}

		// 切换为 COMBAT 模式（setMode 会自动初始化 turn）
		ctx.state.setMode(GameMode.COMBAT);

		// 如果生成了地形，写入地图
		if (generatedTerrain && generatedTerrain.length > 0) {
			ctx.state.mutateAndBroadcast((draft) => {
				if (!draft.map) {
					draft.map = {
						$id: `combat_${Date.now()}`,
						name: currentNode?.name ?? "战斗区域",
						size: { width: 2000, height: 2000 },
						metadata: { name: currentNode?.name ?? "战斗区域" },
					};
				}
				draft.map.terrain = generatedTerrain;
			});
		}

		ctx.state.appendLog(
			createBattleLogEvent("enter_combat", {
				nodeId: state.world.fleetNodeId,
				nodeName: currentNode?.name,
				terrainCount: generatedTerrain?.length ?? 0,
			})
		);

		return {
			success: true,
			terrain: generatedTerrain,
		};
	},

	// ==================== 查询 ====================

	/**
	 * world:query — 查询星图状态
	 */
	query: async (_payload: unknown, ctx: RpcContext) => {
		ctx.requireRoom();

		const state = ctx.state.getState();
		if (!state.world) {
			throw err("未启用世界观模式", ErrorCodes.ERROR);
		}

		const stats = getWorldStats(state.world);

		// 对非 GM 玩家隐藏未探索节点的 description
		const isHost = ctx.playerId === ctx.room?.creatorId;
		const visibleNodes = state.world.nodes.map((node) => {
			if (node.explored || isHost) return node;
			return {
				...node,
				description: undefined,
				hiddenDescription: undefined,
			};
		});

		return {
			worldMap: {
				...state.world,
				nodes: visibleNodes,
			},
			stats,
		};
	},

	// ==================== GM 管理 ====================

	/**
	 * world:manage — GM 管理星图
	 * action: add_node | remove_node | update_node | add_edge | remove_edge | update_edge
	 */
	manage: async (payload: unknown, ctx: RpcContext) => {
		ctx.requireRoom();
		ctx.requireHost();

		const p = payload as {
			action: string;
			node?: any;
			edge?: any;
			nodeId?: string;
			edgeId?: string;
		};

		const state = ctx.state.getState();
		if (!state.world) {
			throw err("未启用世界观模式", ErrorCodes.ERROR);
		}

		ctx.state.mutateAndBroadcast((draft) => {
			if (!draft.world) return;

			switch (p.action) {
				case "add_node":
					if (p.node) {
						draft.world.nodes.push(p.node);
					}
					break;
				case "remove_node":
					if (p.nodeId) {
						draft.world.nodes = draft.world.nodes.filter((n) => n.id !== p.nodeId);
						draft.world.edges = draft.world.edges.filter(
							(e) => e.from !== p.nodeId && e.to !== p.nodeId
						);
					}
					break;
				case "update_node":
					if (p.node?.id) {
						const idx = draft.world.nodes.findIndex((n) => n.id === p.node.id);
						if (idx >= 0) draft.world.nodes[idx] = p.node;
					}
					break;
				case "add_edge":
					if (p.edge) {
						draft.world.edges.push(p.edge);
					}
					break;
				case "remove_edge":
					if (p.edgeId) {
						draft.world.edges = draft.world.edges.filter((e) => e.id !== p.edgeId);
					}
					break;
				case "update_edge":
					if (p.edge?.id) {
						const idx = draft.world.edges.findIndex((e) => e.id === p.edge.id);
						if (idx >= 0) draft.world.edges[idx] = p.edge;
					}
					break;
			}
		});

		ctx.state.appendLog(
			createBattleLogEvent("world_edit", {
				playerId: ctx.playerId,
				playerName: ctx.playerName,
				action: p.action,
			})
		);

		return { success: true };
	},
};
