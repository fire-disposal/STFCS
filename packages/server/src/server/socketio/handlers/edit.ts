/**
 * edit namespace handlers — 编辑态下的舰船/房间操作
 */
import { err } from "./err.js";
import { Faction, TURN_ORDER, GamePhase, MovementPhase, ErrorCodes, findCollidingShips } from "@vt/data";
import type { WsPayload, WsResponseData, CombatToken } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";
import { generateShortId } from "../../utils/shortId.js";

export const editHandlers = {
    token: async (payload: unknown, ctx: RpcContext): Promise<WsResponseData<"edit:token">> => {
        ctx.requireRoom();
        const p = payload as WsPayload<"edit:token">;
        const room = ctx.room!;

        switch (p.action) {
            case "create": {
                if (!p.token) throw err("需要 token 数据", ErrorCodes.TOKEN_DATA_REQUIRED);
                const tokenId = `token_${generateShortId()}_${Date.now()}`;

                const baseName = p.token.metadata?.name ?? p.token.$presetRef?.split(":").pop() ?? "舰船";
                const existingTokens = room.getCombatTokens();
                const sameTypeCount = existingTokens.filter(t => {
                    const existingBaseName = t.metadata?.name ?? t.$presetRef?.split(":").pop() ?? "舰船";
                    return existingBaseName === baseName;
                }).length;
                const displayName = `${baseName} ${sameTypeCount + 1}`;

                const spec = p.token.spec;
                const shieldSpec = spec?.shield;
                const hasShield = Boolean(shieldSpec);

                // 碰撞检测：部署位置不能与现有舰船重叠
                const deployPos = p.position ?? p.token.runtime?.position ?? { x: 0, y: 0 };
                const deployHeading = p.token.runtime?.heading ?? 0;
                const deployHalfW = (spec?.width ?? 30) / 2;
                const deployHalfL = (spec?.length ?? 50) / 2;

                const collidingIds = findCollidingShips(
                    deployPos, deployHeading, deployHalfW, deployHalfL,
                    "__deploying__", existingTokens
                );
                if (collidingIds.length > 0) {
                    throw err("部署位置与现有舰船碰撞", ErrorCodes.DEPLOY_COLLISION);
                }

                const createToken: CombatToken = {
                    ...p.token,
                    $id: tokenId,
                    runtime: {
                        ...p.token.runtime,
                        position: p.position ?? p.token.runtime?.position ?? { x: 0, y: 0 },
                        heading: p.token.runtime?.heading ?? 0,
                        faction: p.faction ?? p.token.runtime?.faction ?? Faction.PLAYER_ALLIANCE,
                        ownerId: ctx.playerId,
                        displayName,
                        ...(hasShield && !p.token.runtime?.shield ? {
                            shield: {
                                active: false,
                                value: shieldSpec!.radius,
                                direction: 0,
                            }
                        } : {}),
                    } as any,
                    metadata: {
                        ...p.token.metadata,
                        owner: p.token.metadata?.owner ?? ctx.playerId,
                    },
                };
                ctx.state.setToken(tokenId, createToken, ctx.editLogContext(p.reason ?? "创建舰船"));
                return { tokenId, displayName };
            }
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
                const newHull = Math.min(token.spec.maxHitPoints, (token.runtime?.hull ?? 0) + p.amount);
                ctx.state.updateToken(p.tokenId, "runtime/hull", newHull, ctx.editLogContext(p.reason ?? `恢复 ${p.amount} 船体`));
                return;
            }
            case "damage": {
                if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
                if (!p.amount) throw err("需要 amount", ErrorCodes.AMOUNT_REQUIRED);
                const token = room.getCombatToken(p.tokenId);
                if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
                const newHull = Math.max(0, (token.runtime?.hull ?? 0) - p.amount);
                const destroyed = newHull <= 0;
                ctx.state.updateToken(p.tokenId, "runtime/hull", newHull, ctx.editLogContext(p.reason ?? `受到 ${p.amount} 伤害`));
                if (destroyed) {
                    ctx.state.updateToken(p.tokenId, "runtime/destroyed", true, ctx.editLogContext("舰船被摧毁"));
                }
                return;
            }
            case "restore": {
                if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
                const token = room.getCombatToken(p.tokenId);
                if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
                ctx.state.updateTokenRuntime(p.tokenId, {
                    hull: token.spec.maxHitPoints,
                    armor: Array(6).fill(token.spec.armorMaxPerQuadrant) as [number, number, number, number, number, number],
                    fluxSoft: 0,
                    fluxHard: 0,
                    overloaded: false,
                    destroyed: false,
                });
                return;
            }
            case "reset": {
                if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
                const token = room.getCombatToken(p.tokenId);
                if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
                ctx.state.updateToken(p.tokenId, "runtime", {
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
                }, ctx.editLogContext(p.reason ?? "重置状态"));
                return;
            }
            case "rename": {
                if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
                if (!p.displayName) throw err("需要 displayName", ErrorCodes.DISPLAY_NAME_REQUIRED);
                const token = room.getCombatToken(p.tokenId);
                if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
                ctx.state.updateToken(p.tokenId, "runtime/displayName", p.displayName, ctx.editLogContext(p.reason ?? `更名为 ${p.displayName}`));
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
                return;
            }
            case "remove_modifier": {
                if (!p.key) throw err("需要 key", ErrorCodes.KEY_REQUIRED);
                ctx.state.removeGlobalModifier(p.key);
                return;
            }
            case "force_end_turn": {
                const room = ctx.room!;
                const currentPhase = room.getStateManager().getState().phase;

                if (currentPhase !== GamePhase.PLAYER_ACTION) {
                    throw err("当前阶段不允许强制结束回合", ErrorCodes.INVALID_PHASE);
                }

                // 推进到 TURN_ORDER 中的下一个派系
                const currentFaction = room.getStateManager().getState().activeFaction;
                const currentIndex = currentFaction ? TURN_ORDER.indexOf(currentFaction as any) : -1;
                const nextIndex = currentIndex + 1;
                const incrementTurn = nextIndex >= TURN_ORDER.length;

                // 保持 PLAYER_ACTION 阶段，changePhase 会自动更新 activeFaction
                ctx.state.changePhase(GamePhase.PLAYER_ACTION);

                // 重置所有玩家的准备状态
                ctx.state.resetAllPlayersReady();

                if (incrementTurn) {
                    const newTurn = room.getStateManager().getState().turnCount + 1;
                    ctx.state.changeTurn(newTurn);
                    room.processTurnEndLogic();
                }

                return;
            }
            case "set_phase": {
                if (!p.phase) throw err("需要 phase", ErrorCodes.PHASE_REQUIRED);
                ctx.state.changePhase(p.phase as any);
                return;
            }
            case "set_turn": {
                if (!p.turn) throw err("需要 turn", ErrorCodes.TURN_REQUIRED);
                ctx.state.changeTurn(p.turn);
                return;
            }
            case "set_faction": {
                if (!p.playerId) throw err("需要 playerId", ErrorCodes.PLAYER_ID_REQUIRED);
                if (!p.faction) throw err("需要 faction", ErrorCodes.FACTION_REQUIRED);
                ctx.state.updatePlayer(p.playerId, { faction: p.faction });
                return;
            }
            default:
                throw err("未知操作", ErrorCodes.UNKNOWN_ACTION);
        }
    },
};
