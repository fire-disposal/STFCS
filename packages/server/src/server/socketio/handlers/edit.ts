/**
 * edit namespace handlers — 编辑态下的舰船/房间操作
 */
import { err } from "./err.js";
import { MovementPhase, ErrorCodes, createBattleLogEvent, GameMode } from "@vt/data";
import type { WsPayload, WsResponseData } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";
import {
	executeTurnAdvance,
	validateTurnAdvance,
} from "../../../core/engine/flow/TurnFlowController.js";

export const editHandlers = {
	token: async (payload: unknown, ctx: RpcContext): Promise<WsResponseData<"edit:token">> => {
		ctx.requireRoom();
		const p = payload as WsPayload<"edit:token">;
		const room = ctx.room!;

		switch (p.action) {
			case "modify": {
				if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
				if (!p.path) throw err("需要 path", ErrorCodes.PATH_REQUIRED);
				const token = room.getCombatToken(p.tokenId);
				if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
				ctx.state.updateToken(p.tokenId, p.path, p.value, ctx.editLogContext(p.reason));
				return;
			}
			case "remove": {
				if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
				const token = room.getCombatToken(p.tokenId);
				if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
				ctx.state.removeToken(p.tokenId, ctx.editLogContext(p.reason));
				return;
			}
			case "heal": {
				if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
				if (!p.amount) throw err("需要 amount", ErrorCodes.AMOUNT_REQUIRED);
				const token = room.getCombatToken(p.tokenId);
				if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
				const oldHull = token.runtime?.hull ?? 0;
				const newHull = Math.min(token.spec.maxHitPoints, oldHull + p.amount);
				ctx.state.updateToken(
					p.tokenId,
					"runtime/hull",
					newHull,
					ctx.editLogContext(p.reason ?? `恢复 ${p.amount} 船体`)
				);
				ctx.state.appendLog(
					createBattleLogEvent("edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						tokenId: p.tokenId,
						tokenName: token.metadata?.name ?? p.tokenId,
						path: "runtime/hull",
						oldValue: oldHull,
						newValue: newHull,
						reason: p.reason ?? `恢复 ${p.amount} 船体`,
					})
				);
				return;
			}
			case "damage": {
				if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
				if (!p.amount) throw err("需要 amount", ErrorCodes.AMOUNT_REQUIRED);
				const token = room.getCombatToken(p.tokenId);
				if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
				const oldHull = token.runtime?.hull ?? 0;
				const newHull = Math.max(0, oldHull - p.amount);
				const destroyed = newHull <= 0;
				ctx.state.updateToken(
					p.tokenId,
					"runtime/hull",
					newHull,
					ctx.editLogContext(p.reason ?? `受到 ${p.amount} 伤害`)
				);
				ctx.state.appendLog(
					createBattleLogEvent("edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						tokenId: p.tokenId,
						tokenName: token.metadata?.name ?? p.tokenId,
						path: "runtime/hull",
						oldValue: oldHull,
						newValue: newHull,
						reason: p.reason ?? `受到 ${p.amount} 伤害`,
					})
				);
				if (destroyed) {
					ctx.state.updateToken(
						p.tokenId,
						"runtime/destroyed",
						true,
						ctx.editLogContext("舰船被摧毁")
					);
					ctx.state.appendLog(
						createBattleLogEvent("destroyed", {
							tokenId: p.tokenId,
							tokenName: token.metadata?.name ?? p.tokenId,
						})
					);
				}
				return;
			}
			case "restore": {
				if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
				const token = room.getCombatToken(p.tokenId);
				if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
				ctx.state.updateTokenRuntime(p.tokenId, {
					hull: token.spec.maxHitPoints,
					armor: Array(6).fill(token.spec.armorMaxPerQuadrant) as [
						number,
						number,
						number,
						number,
						number,
						number,
					],
					fluxSoft: 0,
					fluxHard: 0,
					overloaded: false,
					destroyed: false,
				});
				ctx.state.appendLog(
					createBattleLogEvent("edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						tokenId: p.tokenId,
						tokenName: token.metadata?.name ?? p.tokenId,
						path: "runtime/*",
						reason: p.reason ?? "完全修复舰船",
					})
				);
				return;
			}
			case "reset": {
				if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
				const token = room.getCombatToken(p.tokenId);
				if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
				ctx.state.updateToken(
					p.tokenId,
					"runtime",
					{
						position: token.runtime?.position ?? { x: 0, y: 0 },
						heading: 0,
						hull: token.spec.maxHitPoints,
						armor: Array(6).fill(token.spec.armorMaxPerQuadrant),
						fluxSoft: 0,
						fluxHard: 0,
						overloaded: false,
						destroyed: false,
						movement: {
							currentPhase: MovementPhase.A,
							hasMoved: false,
							phaseAUsed: 0,
							turnAngleUsed: 0,
							phaseCUsed: 0,
						},
						hasFired: false,
					},
					ctx.editLogContext(p.reason ?? "重置状态")
				);
				return;
			}
			case "rename": {
				if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
				if (!p.displayName) throw err("需要 displayName", ErrorCodes.DISPLAY_NAME_REQUIRED);
				const token = room.getCombatToken(p.tokenId);
				if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
				ctx.state.updateToken(
					p.tokenId,
					"runtime/displayName",
					p.displayName,
					ctx.editLogContext(p.reason ?? `更名为 ${p.displayName}`)
				);
				return { tokenId: p.tokenId, displayName: p.displayName };
			}
			default:
				throw err("未知操作", ErrorCodes.UNKNOWN_ACTION);
		}
	},

	room: async (payload: unknown, ctx: RpcContext) => {
		ctx.requireHost();
		const p = payload as WsPayload<"edit:room">;

		switch (p.action) {
			case "set_modifier": {
				if (!p.key) throw err("需要 key", ErrorCodes.KEY_REQUIRED);
				if (!p.value) throw err("需要 value", ErrorCodes.VALUE_REQUIRED);
				ctx.state.setGlobalModifier(p.key, p.value);
				ctx.state.appendLog(
					createBattleLogEvent("room_edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						action: "set_modifier",
						detail: `${p.key}=${p.value}`,
					})
				);
				return;
			}
			case "remove_modifier": {
				if (!p.key) throw err("需要 key", ErrorCodes.KEY_REQUIRED);
				ctx.state.removeGlobalModifier(p.key);
				ctx.state.appendLog(
					createBattleLogEvent("room_edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						action: "remove_modifier",
						detail: p.key,
					})
				);
				return;
			}
			case "force_end_turn": {
				const room = ctx.room!;
				const state = room.getStateManager().getState();
				const isHost = ctx.playerId === state.ownerId;

				const validation = validateTurnAdvance(state, isHost);
				if (!validation.valid) {
					throw err(validation.error ?? "无法推进回合", ErrorCodes.INVALID_PHASE);
				}

				const result = executeTurnAdvance(state);

				// 应用状态更新
				if (result.modeChanged) {
					ctx.state.setMode(result.newMode);
				}

				if (result.turnIncremented) {
					ctx.state.changeTurn(result.newTurnNumber);
				}

				if (result.factionChanged && result.newFaction) {
					ctx.state.changeFaction(result.newFaction);
				}

				// 应用舰船状态更新
				for (const [tokenId, updates] of result.stateUpdates) {
					ctx.state.updateTokenRuntime(tokenId, updates);
				}

				// 写入日志
				for (const logEvent of result.logEvents) {
					ctx.state.appendLog(logEvent);
				}

				ctx.state.resetAllPlayersReady();
				return;
			}
			case "set_phase": {
				if (!p.phase) throw err("需要 phase", ErrorCodes.PHASE_REQUIRED);
				const validPhases = Object.values(GameMode);
				if (!validPhases.includes(p.phase as any)) {
					throw err(`无效阶段: ${p.phase}，有效值: ${validPhases.join(", ")}`, ErrorCodes.ERROR);
				}
				ctx.state.changePhase(p.phase as any);
				ctx.state.appendLog(
					createBattleLogEvent("room_edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						action: "set_phase",
						detail: String(p.phase),
					})
				);
				return;
			}
			case "set_turn": {
				if (!p.turn) throw err("需要 turn", ErrorCodes.TURN_REQUIRED);
				ctx.state.changeTurn(p.turn);
				ctx.state.appendLog(
					createBattleLogEvent("room_edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						action: "set_turn",
						detail: `第${p.turn}回合`,
					})
				);
				return;
			}
			case "set_faction": {
				if (!p.playerId) throw err("需要 playerId", ErrorCodes.PLAYER_ID_REQUIRED);
				if (!p.faction) throw err("需要 faction", ErrorCodes.FACTION_REQUIRED);
				const targetPlayer = ctx.state.getPlayer(p.playerId);
				ctx.state.updatePlayer(p.playerId, { faction: p.faction });
				ctx.state.appendLog(
					createBattleLogEvent("room_edit", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						action: "set_faction",
						detail: `${targetPlayer?.nickname ?? p.playerId} → ${p.faction}`,
					})
				);
				return;
			}
			default:
				throw err("未知操作", ErrorCodes.UNKNOWN_ACTION);
		}
	},
};
