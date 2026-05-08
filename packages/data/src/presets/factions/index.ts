/**
 * Faction 预设数据导出
 */
import playerAlliance from "./player-alliance.json" with { type: "json" };
import fateGrip from "./fate-grip.json" with { type: "json" };
import type { FactionDef } from "../../core/GameSchemas.js";

export const presetFactions: FactionDef[] = [playerAlliance, fateGrip] as FactionDef[];
