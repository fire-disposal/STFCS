/**
 * 预设舰船数据导出
 */

import frigateBasic from "./frigate-basic.json";
import destroyerStandard from "./destroyer-standard.json";
import cruiserAssault from "./cruiser-assault.json";

export const presetShips = [
	frigateBasic,
	destroyerStandard,
	cruiserAssault,
] as const;

export type PresetShip = typeof presetShips[number];