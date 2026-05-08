/**
 * faction handlers — 派系查询
 */
import type { WsPayload, WsResponseData } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";

export const factionHandlers = {
    list: async (_payload: unknown, ctx: RpcContext): Promise<WsResponseData<"faction:list">> => {
        const state = ctx.state.getState();
        const factionMap = state.factions ?? {};
        return { factions: Object.values(factionMap) };
    },

    get: async (payload: unknown, ctx: RpcContext): Promise<WsResponseData<"faction:get">> => {
        const p = payload as WsPayload<"faction:get">;
        const state = ctx.state.getState();
        const faction = state.factions?.[p.factionId] ?? null;
        return { faction };
    },
};

/**
 * edit:faction handlers — 派系 CRUD（仅 DM）
 */
export const editFactionHandlers = {
    /**
     * 创建/更新/删除/排序 派系
     * 直接操作 state.factions / initiativeOrder
     */
    create: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireHost();
        const p = payload as WsPayload<"edit:faction">;
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
        const p = payload as WsPayload<"edit:faction">;
        const state = ctx.state.getState();
        const faction = state.factions?.[p.factionId ?? ""];
        if (!faction) throw new Error("派系不存在");

        ctx.state.mutateAndBroadcast((draft: any) => {
            if (draft.factions?.[p.factionId!]) {
                if (p.name !== undefined) draft.factions[p.factionId!].name = p.name;
                if (p.color !== undefined) draft.factions[p.factionId!].color = p.color;
                if (p.flagAssetId !== undefined) draft.factions[p.factionId!].flagAssetId = p.flagAssetId;
            }
        });
    },

    delete: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireHost();
        const p = payload as WsPayload<"edit:faction">;
        if (p.factionId?.startsWith("preset:")) throw new Error("预设派系不可删除");

        ctx.state.mutateAndBroadcast((draft: any) => {
            if (draft.factions) delete draft.factions[p.factionId!];
            if (draft.initiativeOrder) {
                draft.initiativeOrder = draft.initiativeOrder.filter((id: string) => id !== p.factionId);
            }
        });
    },

    reorder: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireHost();
        const p = payload as WsPayload<"edit:faction">;
        ctx.state.mutateAndBroadcast((draft: any) => {
            draft.initiativeOrder = p.initiativeOrder;
        });
    },
};
