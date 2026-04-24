/**
 * game namespace handlers — 玩家行动执行 + 游戏状态查询
 */
import { err } from "./err.js";
import { GamePhase, ErrorCodes } from "@vt/data";
import type { WsPayload } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";
import { calculateShipWeaponTargets } from "../../../core/engine/rules/targeting.js";
import { applyAction, CLIENT_ACTION_MAP } from "../../../core/engine/applyAction.js";

export const gameHandlers = {
    action: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireRoom();
        ctx.requirePlayer();
        const p = payload as WsPayload<"game:action">;
        const room = ctx.room!;

        // 阶段检查
        if (room.getStateManager().getState().phase !== GamePhase.PLAYER_ACTION) {
            throw err("当前阶段不允许操作", ErrorCodes.INVALID_PHASE);
        }

        // 权限检查：非房主需要 token 控制权
        if (room.creatorId !== ctx.playerId) {
            ctx.requireTokenControl(p.tokenId);
        }

        const actionType = CLIENT_ACTION_MAP[p.action];
        if (!actionType) {
            throw err(`未知操作: ${p.action}`, ErrorCodes.UNKNOWN_ACTION);
        }

        // 统一委托给 Engine 层
        const state = room.getStateManager().getState();
        const result = applyAction(state, actionType, ctx.playerId, p);

        // 执行 Engine 层返回的更新指令
        for (const update of result.runtimeUpdates) {
            ctx.state.updateTokenRuntime(update.tokenId, update.updates as Record<string, unknown>);
        }

        // 广播 Engine 事件
        for (const event of result.events) {
            ctx.broadcast("battle:log", {
                log: {
                    type: event.type,
                    ...event.data,
                    timestamp: Date.now(),
                }
            });
        }
    },

    query: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireRoom();
        const p = payload as WsPayload<"game:query">;
        const room = ctx.room!;
        const token = room.getCombatToken(p.tokenId);
        if (!token) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
        switch (p.type) {
            case "targets":
                const allTokens = room.getCombatTokens();
                const targetingResult = calculateShipWeaponTargets(token, allTokens);
                return { result: targetingResult };
            case "movement":
                return { result: token.runtime?.movement ?? { phaseAUsed: 0, phaseCUsed: 0, turnAngleUsed: 0 } };
            case "ownership":
                return { result: { ownerId: token.runtime?.ownerId ?? null, faction: token.runtime?.faction ?? null } };
            case "combat_state":
                return { result: { hull: token.runtime?.hull ?? null, flux: (token.runtime?.fluxSoft ?? 0) + (token.runtime?.fluxHard ?? 0), overloaded: token.runtime?.overloaded ?? null } };
            case "weapon_state": {
                const mountId = p.mountId;
                if (!mountId) throw err("需要 mountId", ErrorCodes.MOUNT_ID_REQUIRED);
                const weaponRuntime = token.runtime?.weapons?.find((w: { mountId: string }) => w.mountId === mountId);
                if (!weaponRuntime) throw err("武器不存在", ErrorCodes.WEAPON_NOT_FOUND);
                return { result: weaponRuntime };
            }
            default:
                throw err(`未知查询类型: ${p.type}`, ErrorCodes.UNKNOWN_QUERY_TYPE);
        }
    },
};
