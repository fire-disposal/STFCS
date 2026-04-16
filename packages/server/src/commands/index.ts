/**
 * 命令模块导出
 */

export * from "./types.js";
export { CommandDispatcher } from "./CommandDispatcher.js";

// 导出 handlers 供直接使用
export {
	handleMove,
	handleAdvanceMovePhase,
	handleFireWeapon,
	handleToggleShield,
	handleVentFlux,
	handleAssignShip,
	validateAuthority,
	validateDmAuthority,
} from "./handlers/index.js";