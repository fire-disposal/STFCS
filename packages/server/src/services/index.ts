/**
 * 服务层导出
 */

export { PlayerService, type OnlineProfile } from "./PlayerService.js";
export { GameService } from "./GameService.js";
export { SaveService, saveService } from "./SaveService.js";

// SaveInfo 使用 SaveMetadata 类型替代（从 schema/types.ts）
// OnlineProfile: 在线玩家基本信息
// PlayerProfile（schema/types.ts）: 完整玩家档案