/**
 * game namespace handlers — 玩家行动执行 + 游戏状态查询
 */
import { err } from "./err.js";
import { GamePhase, ErrorCodes, createBattleLogEvent, BattleLogType } from "@vt/data";
import type { WsPayload, BattleLogEvent } from "@vt/data";
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
        const currentPhase = room.getStateManager().getState().phase;
		if (currentPhase !== GamePhase.FACTION_ACTION) {
            throw err("当前阶段不允许操作", ErrorCodes.INVALID_PHASE);
        }

        // 权限检查：非房主需要 token 控制权
        if (room.creatorId !== ctx.playerId) {
            ctx.requireTokenControl(p.tokenId);

            // 活跃派系检查：仅当前行动派系的玩家可操作
            const activeFaction = room.getStateManager().getState().activeFaction;
            const token = room.getCombatToken(p.tokenId);
            if (token?.runtime?.faction && token.runtime.faction !== activeFaction) {
                throw err("不是你的派系回合", ErrorCodes.NOT_YOUR_TURN);
            }
        }

        const actionType = CLIENT_ACTION_MAP[p.action];
        if (!actionType) {
            throw err(`未知操作: ${p.action}`, ErrorCodes.UNKNOWN_ACTION);
        }

        // 统一委托给 Engine 层
        const state = room.getStateManager().getState();
        const result = applyAction(state, actionType, ctx.playerId, p);

        if (result.error) {
            throw err(result.error.message, result.error.code);
        }

        // 执行 Engine 层返回的更新指令
        for (const update of result.runtimeUpdates) {
            ctx.state.updateTokenRuntime(update.tokenId, update.updates as Record<string, unknown>);
        }

        // 广播 + 写入 战斗日志
        const token = room.getCombatToken(p.tokenId);
        const tokenName = token?.runtime?.displayName ?? token?.metadata?.name ?? p.tokenId;

        for (const event of result.events) {
            const logEntry: BattleLogEvent = createBattleLogEvent(event.type, {
                ...event.data,
                tokenId: p.tokenId,
                tokenName,
                action: p.action,
            });

            // 写入 room state（持久化）
            ctx.state.appendLog(logEntry);
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

    roll_dice: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireRoom();
        const p = payload as WsPayload<"game:roll_dice">;

        const diceSides: Record<string, number> = { d4: 4, d6: 6, d8: 8, d10: 10, d12: 12, d20: 20, d100: 100 };
        const sides = diceSides[p.diceType];
        if (!sides) throw err(`无效骰子类型: ${p.diceType}`, ErrorCodes.UNKNOWN_ACTION);

        const results: number[] = [];
        for (let i = 0; i < p.count; i++) {
            results.push(Math.floor(Math.random() * sides) + 1);
        }
        const sum = results.reduce((a, b) => a + b, 0);

        ctx.state.appendLog(createBattleLogEvent(BattleLogType.ROLL, {
            playerId: ctx.playerId,
            playerName: ctx.playerName,
            diceType: p.diceType,
            sides,
            count: p.count,
            results,
            sum,
        }));

        return { diceType: p.diceType, count: p.count, results, sum };
    },
};
