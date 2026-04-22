/**
 * 预设舰船数据导出
 */

import frigateBasic from "./frigate-basic.json";
import destroyerStandard from "./destroyer-standard.json";
import cruiserAssault from "./cruiser-assault.json";

import type { InventoryToken } from "../../core/GameSchemas.js";

export const presetShips: InventoryToken[] = [
	frigateBasic as InventoryToken,
	destroyerStandard as InventoryToken,
	cruiserAssault as InventoryToken,
];

export type PresetShip = InventoryToken;