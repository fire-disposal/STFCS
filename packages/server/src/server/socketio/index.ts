/**
 * Socket.IO Handler 导出
 */

export { setupSocketIO } from "./handlers.js";
export { createRpcRegistry, RpcRegistry, ObservableState, type RpcContext, type RpcServices, type SocketData } from "./RpcServer.js";
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
