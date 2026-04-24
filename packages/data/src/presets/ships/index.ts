/**
 * 预设舰船数据导出
 */

import frigateStrike from "./frigate-strike.json";
import frigateSupport from "./frigate-support.json";
import destroyerEscort from "./destroyer-escort.json";
import cruiserArtillery from "./cruiser-artillery.json";
import battleshipDominant from "./battleship-dominant.json";

import type { InventoryToken } from "../../core/GameSchemas.js";

export const presetShips: InventoryToken[] = [
	frigateStrike as InventoryToken,
	frigateSupport as InventoryToken,
	destroyerEscort as InventoryToken,
	cruiserArtillery as InventoryToken,
	battleshipDominant as InventoryToken,
];

export type PresetShip = InventoryToken;