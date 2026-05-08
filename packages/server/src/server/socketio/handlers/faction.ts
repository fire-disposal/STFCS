/**
 * faction handlers — 派系查询 + 全局CRUD
 *
 * 预设派系（@vt/data）始终可见；自定义派系通过 FactionService 全局存储。
 * 进入房间后 faction:list 还合并 room.state.factions 中的派系快照。
 */
import type { WsPayload } from "@vt/data";
import { ErrorCodes } from "@vt/data";
import { err } from "./err.js";
import type { RpcContext } from "../RpcServer.js";
import { assetService, factionService } from "./services.js";
import { presetFactions } from "@vt/data";
import { createLogger } from "../../../infra/simple-logger.js";

const logger = createLogger("faction-handler");

function mergeFactionMaps(roomFactions: Record<string, any> | undefined, globalFactions: any[], presets: any[]) {
    const map: Record<string, any> = { ...roomFactions };
    for (const f of globalFactions) {
        if (!map[f.$id]) map[f.$id] = f;
    }
    for (const p of presets) {
        if (!map[p.$id]) map[p.$id] = p;
    }
    return map;
}

export const factionHandlers = {
    list: async (_payload: unknown, ctx: RpcContext) => {
        const state = ctx.state.getState();
        const globalFactions = await factionService.list();
        const factionMap = mergeFactionMaps(state.factions, globalFactions, presetFactions);
        return { factions: Object.values(factionMap) };
    },

    get: async (payload: unknown, ctx: RpcContext) => {
        const p = payload as WsPayload<"faction:get">;
        const state = ctx.state.getState();
        const faction = state.factions?.[p.factionId]
            ?? await factionService.get(p.factionId)
            ?? presetFactions.find((pf) => pf.$id === p.factionId)
            ?? null;
        return { faction };
    },
};

export const editFactionHandlers = {
    create: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"edit:faction:create">;
        const factionId = `custom:faction:${Date.now()}`;

        let flagAssetId = p.flagAssetId;
        if (p.flagData && !flagAssetId) {
            const flagSize = p.flagData.length;
            logger.info(`Creating faction "${p.name}" with flag data (${flagSize} chars base64)`);
            try {
                const asset = await assetService.uploadAsset(
                    ctx.playerId,
                    "faction_flag",
                    `${p.name}_flag.png`,
                    "image/png",
                    Buffer.from(p.flagData, "base64"),
                );
                flagAssetId = asset.$id;
                logger.info(`Flag uploaded for faction "${p.name}": ${flagAssetId}`);
            } catch (e) {
                logger.error(`Flag upload failed for faction "${p.name}": ${e instanceof Error ? e.message : String(e)}`);
            }
        } else {
            logger.info(`Creating faction "${p.name}" without flag (flagData=${!!p.flagData}, flagAssetId=${flagAssetId})`);
        }

        await factionService.create({
            $id: factionId,
            name: p.name,
            color: p.color,
            flagAssetId,
            ownerId: ctx.playerId,
        });

        logger.info(`Faction saved to global store: ${factionId} (flag=${flagAssetId})`);
    },

    update: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"edit:faction:update">;
        const faction = await factionService.get(p.factionId);
        if (!faction) throw err("派系不存在", ErrorCodes.TOKEN_NOT_FOUND);

        await factionService.create({
            ...faction,
            name: p.name ?? faction.name,
            color: p.color ?? faction.color,
            flagAssetId: p.flagAssetId ?? faction.flagAssetId,
        });
    },

    delete: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"edit:faction:delete">;
        if (p.factionId.startsWith("preset:")) throw err("预设派系不可删除", ErrorCodes.PRESET_NOT_FOUND);

        const faction = await factionService.get(p.factionId);
        if (!faction) throw err("派系不存在", ErrorCodes.TOKEN_NOT_FOUND);
        if (faction.ownerId && faction.ownerId !== ctx.playerId) {
            // 非所有者不能删除；host 例外在 delete handler 中不会调用到这里（因为全局存储无 room）
            throw err("只能删除自己创建的派系", ErrorCodes.NOT_HOST);
        }

        await factionService.delete(p.factionId);
    },

    reorder: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireHost();
        const p = payload as WsPayload<"edit:faction:reorder">;
        ctx.state.mutateAndBroadcast((draft: any) => {
            draft.initiativeOrder = p.initiativeOrder;
        });
    },
};
