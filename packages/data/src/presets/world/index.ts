/**
 * 世界地图预设
 *
 * 与舰船/武器预设体系一致：JSON 源文件 + Zod 验证 + 类型导出
 * 新增预设只需在目录下添加 .json 文件并在下方导入。
 */
import demo from "./demo-sector.json" assert { type: "json" };

import type { WorldMap } from "../../core/WorldSchemas.js";

export const presetWorlds: Record<string, WorldMap> = {
	demo: demo as WorldMap,
};

export type PresetWorldId = keyof typeof presetWorlds;
