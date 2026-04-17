/**
 * 命令模块导出
 */

export * from "./types.js";
export { CommandDispatcher } from "./CommandDispatcher.js";

// 导出 game handlers 供直接使用
export {
	handleMove,
	handleAdvanceMovePhase,
	handleFireWeapon,
	handleToggleShield,
	handleVentFlux,
	handleAssignShip,
	validateAuthority,
	validateDmAuthority,
} from "./game/index.js";

// 导出 system handlers
export { handleUpdateProfile } from "./system/index.js";