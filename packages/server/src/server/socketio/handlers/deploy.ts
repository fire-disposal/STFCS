/**
 * deploy namespace handlers — 舰船部署（从预设创建实例）
 */
import { err } from "./err.js";
import { Faction, ErrorCodes, findCollidingShips, createBattleLogEvent } from "@vt/data";
import type { WsPayload, WsResponseData, CombatToken } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";
import { generateShortId } from "../../utils/shortId.js";

export const deployHandlers = {
    token: async (payload: unknown, ctx: RpcContext): Promise<WsResponseData<"deploy:token">> => {
        ctx.requireRoom();
        const p = payload as WsPayload<"deploy:token">;
        const room = ctx.room!;

        if (!p.preset) throw err("需要预设数据", ErrorCodes.TOKEN_DATA_REQUIRED);

        const tokenId = `token_${generateShortId()}_${Date.now()}`;

        const baseName = p.preset.metadata?.name ?? p.preset.$presetRef?.split(":").pop() ?? "舰船";
        const existingTokens = room.getCombatTokens();
        const sameTypeCount = existingTokens.filter(t => {
            const existingBaseName = t.metadata?.name ?? t.$presetRef?.split(":").pop() ?? "舰船";
            return existingBaseName === baseName;
        }).length;
        const displayName = `${baseName} ${sameTypeCount + 1}`;

        const spec = p.preset.spec;
        const deployPos = p.position ?? { x: 0, y: 0 };
        const deployHeading = p.heading ?? 0;
        const deployHalfW = (spec?.width ?? 30) / 2;
        const deployHalfL = (spec?.length ?? 50) / 2;

        const collidingIds = findCollidingShips(
            deployPos, deployHeading, deployHalfW, deployHalfL,
            "__deploying__", existingTokens
        );
        if (collidingIds.length > 0) {
            throw err("部署位置与现有舰船碰撞", ErrorCodes.DEPLOY_COLLISION);
        }

        const deployFaction = p.faction ?? Faction.PLAYER_ALLIANCE;

        const createToken: CombatToken = {
            $id: tokenId,
            $presetRef: p.preset.$presetRef,
            spec: p.preset.spec,
            runtime: {
                position: deployPos,
                heading: deployHeading,
                faction: deployFaction,
                ownerId: ctx.playerId,
                displayName,
            } as any,
            metadata: {
                ...p.preset.metadata,
                owner: ctx.playerId,
            },
        };

        ctx.state.setToken(tokenId, createToken);

        ctx.state.appendLog(createBattleLogEvent("deploy", {
            playerId: ctx.playerId,
            playerName: ctx.playerName,
            tokenId,
            tokenName: displayName,
            presetId: p.preset.$id,
            presetName: baseName,
            faction: deployFaction,
            position: deployPos,
            heading: deployHeading,
        }));

        return { tokenId, displayName };
    },
};