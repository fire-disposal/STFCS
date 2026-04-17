/**
 * Store 导出
 */

export { useGameStore, MovePhaseUI, type MovementPhaseValue } from "./gameStore";
export { useUIStore } from "./uiStore";

// 武器开火状态（仅 UI 意图，数据从 Schema 获取）
export { useFireModeStore } from "./fireModeStore";