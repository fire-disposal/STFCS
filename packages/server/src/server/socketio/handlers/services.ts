/**
 * 共享服务实例
 */
import { PlayerInfoService } from "../../../services/PlayerInfoService.js";
import { PlayerProfileService } from "../../../services/PlayerProfileService.js";
import { ShipBuildService } from "../../../services/ship/ShipBuildService.js";
import { WeaponService } from "../../../services/weapon/WeaponService.js";
import { PresetService } from "../../../services/preset/PresetService.js";
import { AssetService } from "../../../services/AssetService.js";

export const playerInfoService = new PlayerInfoService();
export const playerProfileService = new PlayerProfileService(playerInfoService);
export const shipBuildService = new ShipBuildService(playerInfoService);
export const weaponService = new WeaponService(playerInfoService);
export const presetService = new PresetService();
export const assetService = new AssetService();
