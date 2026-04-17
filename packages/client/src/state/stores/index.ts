/**
 * Store 导出
 */

export { useGameStore, MovePhaseUI, type MovementPhaseValue } from "./gameStore";
export { useUIStore } from "./uiStore";

// 武器开火状态（服务端权威计算）
export {
	useFireModeStore,
	type TargetAttackabilityType,
	type AttackableTargetsResult,
	type AllAttackableTargetsResult,
} from "./fireModeStore";