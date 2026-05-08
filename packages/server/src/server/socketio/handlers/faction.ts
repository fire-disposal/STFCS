/**
 * faction handlers — 派系查询 + CRUD
 */
import type { WsPayload } from "@vt/data";
import { ErrorCodes } from "@vt/data";
import { err } from "./err.js";
import type { RpcContext } from "../RpcServer.js";
import { assetService } from "./services.js";

export const factionHandlers = {
    list: async (_payload: unknown, ctx: RpcContext) => {
        const state = ctx.state.getState();
        const factionMap = state.factions ?? {};
        return { factions: Object.values(factionMap) };
    },

    get: async (payload: unknown, ctx: RpcContext) => {
        const p = payload as WsPayload<"faction:get">;
        const state = ctx.state.getState();
        const faction = state.factions?.[p.factionId] ?? null;
        return { faction };
    },
};

export const editFactionHandlers = {
    create: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"edit:faction:create">;
        const factionId = `custom:faction:${Date.now()}`;

        // 若提供了旗帜数据，先上传
        let flagAssetId = p.flagAssetId;
        if (p.flagData && !flagAssetId) {
            try {
                const asset = await assetService.uploadAsset(
                    ctx.playerId,
                    "faction_flag",
                    `${p.name}_flag.png`,
                    "image/png",
                    Buffer.from(p.flagData, "base64"),
                );
                flagAssetId = asset.$id;
            } catch (e) {
                // flag upload fails silently — create without flag
            }
        }

        ctx.state.mutateAndBroadcast((draft: any) => {
            if (!draft.factions) draft.factions = {};
            draft.factions[factionId] = {
                $id: factionId,
                name: p.name,
                color: p.color,
                flagAssetId,
                ownerId: ctx.playerId,
            };
            if (!draft.initiativeOrder) draft.initiativeOrder = [];
            draft.initiativeOrder.push(factionId);
        });
    },

    update: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"edit:faction:update">;
        const state = ctx.state.getState();
        const faction = state.factions?.[p.factionId];
        if (!faction) throw err("派系不存在", ErrorCodes.TOKEN_NOT_FOUND);

        ctx.state.mutateAndBroadcast((draft: any) => {
            if (draft.factions?.[p.factionId]) {
                if (p.name !== undefined) draft.factions[p.factionId].name = p.name;
                if (p.color !== undefined) draft.factions[p.factionId].color = p.color;
                if (p.flagAssetId !== undefined) draft.factions[p.factionId].flagAssetId = p.flagAssetId;
            }
        });
    },

    delete: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"edit:faction:delete">;
        if (p.factionId.startsWith("preset:")) throw err("预设派系不可删除", ErrorCodes.PRESET_NOT_FOUND);

        const state = ctx.state.getState();
        const faction = state.factions?.[p.factionId];
        if (!faction) throw err("派系不存在", ErrorCodes.TOKEN_NOT_FOUND);
        if (faction.ownerId && faction.ownerId !== ctx.playerId && ctx.playerId !== state.ownerId) {
            throw err("只能删除自己创建的派系", ErrorCodes.NOT_HOST);
        }

        ctx.state.mutateAndBroadcast((draft: any) => {
            if (draft.factions) delete draft.factions[p.factionId];
            if (draft.initiativeOrder) {
                draft.initiativeOrder = draft.initiativeOrder.filter((id: string) => id !== p.factionId);
            }
        });
    },

    reorder: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireHost();
        const p = payload as WsPayload<"edit:faction:reorder">;
        ctx.state.mutateAndBroadcast((draft: any) => {
            draft.initiativeOrder = p.initiativeOrder;
        });
    },
};
