/**
 * Socket.IO Handler 导出
 */

export { setupUnifiedSocketIO, broadcastSyncEvent } from "./unifiedHandler.js";
export {
	isHost,
	isPlayer,
	canControlToken,
	checkPermission,
	getUserRole,
	getPermissionContext,
	requireHost,
	requirePlayer,
	requireTokenControl,
	getTokenFaction,
	isTokenOwnedByPlayer,
	canPlayerControlFaction,
	getCombatTokenRuntime,
	type UserRole,
	type PermissionContext,
} from "./permission.js";
export { setupSocketIO } from "./handler.js";