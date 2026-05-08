/**
 * faction handlers — 派系查询 + CRUD
 */
import type { WsPayload } from "@vt/data";
import { ErrorCodes } from "@vt/data";
import { err } from "./err.js";
import type { RpcContext } from "../RpcServer.js";

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
        ctx.requireHost();
        const p = payload as WsPayload<"edit:faction:create">;
        const factionId = `custom:faction:${Date.now()}`;

        ctx.state.mutateAndBroadcast((draft: any) => {
            if (!draft.factions) draft.factions = {};
            draft.factions[factionId] = {
                $id: factionId,
                name: p.name,
                color: p.color,
                flagAssetId: p.flagAssetId,
            };
            if (!draft.initiativeOrder) draft.initiativeOrder = [];
            draft.initiativeOrder.push(factionId);
        });
    },

    update: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireHost();
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
        ctx.requireHost();
        const p = payload as WsPayload<"edit:faction:delete">;
        if (p.factionId.startsWith("preset:")) throw err("预设派系不可删除", ErrorCodes.PRESET_NOT_FOUND);

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
