/**
 * customize namespace handlers — 玩家舰船/武器自定义（CRUD + 预设拷贝）
 */
import { err } from "./err.js";
import { ErrorCodes } from "@vt/data";
import type { WsPayload, WsResponseData, InventoryToken, WeaponJSON } from "@vt/data";
import type { RpcContext } from "../RpcServer.js";
import { playerProfileService, shipBuildService, weaponService } from "./services.js";

export const customizeHandlers = {
    token: async (payload: unknown, ctx: RpcContext): Promise<WsResponseData<"customize:token">> => {
        ctx.requireAuth();
        const p = payload as WsPayload<"customize:token">;

        switch (p.action) {
            case "list": {
                const ships = await playerProfileService.getPlayerShips(ctx.playerId);
                return { ships };
            }
            case "get": {
                if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
                const ship = await playerProfileService.getPlayerShip(ctx.playerId, p.tokenId);
                if (!ship) throw err("舰船不存在", ErrorCodes.TOKEN_NOT_FOUND);
                return { ship };
            }
            case "upsert": {
                if (!p.token) throw err("需要 token 数据", ErrorCodes.TOKEN_DATA_REQUIRED);
                let ship;
                if (p.tokenId) {
                    ship = await shipBuildService.updateShipBuild(ctx.playerId, p.tokenId, p.token as InventoryToken);
                } else {
                    ship = await shipBuildService.createShipBuild(ctx.playerId, p.token as InventoryToken);
                }
                if (!ship) throw err("操作失败", ErrorCodes.UPSERT_FAILED);
                return { ship };
            }
            case "delete": {
                if (!p.tokenId) throw err("需要 tokenId", ErrorCodes.TOKEN_ID_REQUIRED);
                const success = await playerProfileService.deletePlayerShip(ctx.playerId, p.tokenId);
                if (!success) throw err("删除失败", ErrorCodes.TOKEN_DELETE_FAILED);
                return;
            }
            case "copy_preset": {
                if (!p.presetId) throw err("需要 presetId", ErrorCodes.PRESET_ID_REQUIRED);
                const ship = await shipBuildService.createFromPreset(ctx.playerId, p.presetId);
                return { ship };
            }
            default:
                throw err("未知操作", ErrorCodes.UNKNOWN_ACTION);
        }
    },

    weapon: async (payload: unknown, ctx: RpcContext) => {
        ctx.requireAuth();
        const p = payload as WsPayload<"customize:weapon">;

        switch (p.action) {
            case "list": {
                const weapons = await playerProfileService.getPlayerWeapons(ctx.playerId);
                return { weapons };
            }
            case "get": {
                if (!p.weaponId) throw err("需要 weaponId", ErrorCodes.WEAPON_ID_REQUIRED);
                const weapon = await playerProfileService.getPlayerWeapon(ctx.playerId, p.weaponId);
                if (!weapon) throw err("武器不存在", ErrorCodes.WEAPON_NOT_FOUND);
                return { weapon };
            }
            case "upsert": {
                if (!p.weapon) throw err("需要 weapon 数据", ErrorCodes.WEAPON_DATA_REQUIRED);
                let weapon;
                if (p.weaponId) {
                    weapon = await weaponService.updateWeaponBuild(ctx.playerId, p.weaponId, p.weapon as WeaponJSON);
                } else {
                    weapon = await weaponService.createWeaponBuild(ctx.playerId, p.weapon as WeaponJSON);
                }
                if (!weapon) throw err("操作失败", ErrorCodes.UPSERT_FAILED);
                return { weapon };
            }
            case "delete": {
                if (!p.weaponId) throw err("需要 weaponId", ErrorCodes.WEAPON_ID_REQUIRED);
                const success = await weaponService.deleteWeaponBuild(ctx.playerId, p.weaponId);
                if (!success) throw err("删除失败", ErrorCodes.WEAPON_DELETE_FAILED);
                return;
            }
            case "copy_preset": {
                if (!p.presetId) throw err("需要 presetId", ErrorCodes.PRESET_ID_REQUIRED);
                const weapon = await weaponService.createFromPreset(ctx.playerId, p.presetId);
                return { weapon };
            }
            default:
                throw err("未知操作", ErrorCodes.UNKNOWN_ACTION);
        }
    },
};
