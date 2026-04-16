/**
 * Store 导出 - Zustand 版本
 */

export { useGameStore, MovePhaseUI, type MovementPhaseValue } from "./gameStore";
export { useUIStore } from "./uiStore";

// 武器开火状态
export {
	useFireModeStore,
	calculateTargetAttackability,
	checkWeaponCanFire,
	type TargetAttackabilityType,
} from "./fireModeStore";