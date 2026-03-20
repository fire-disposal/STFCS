/**
 * 房间框架
 *
 * 声明式房间状态管理 + 类型安全操作
 */

// 核心类型
export type {
  PlayerState,
  TokenState,
  TokenType,
  RoomPhase,
  RoomTurnPhase,
  RoomMeta,
  GameState,
  RoomState,
  OperationFn,
  OperationDef,
  OperationMap,
  OperationName,
  ClientOperation,
  StateUpdateMessage,
  EventMessage,
  OperationRequestMessage,
  OperationResponseMessage,
  SyncMessage,
  StateDiff,
  RoomConfig,
  InferArgs,
  InferReturn,
  AssetTemplate,
  AssetCategory,
  AssetLibrary,
} from './types.js';

export { createEmptyRoomState } from './types.js';

// 序列化
export {
  serializeState,
  deserializeState,
  serializeDiff,
  deserializeDiff,
  deepClone,
  computeDiff,
  applyDiff,
} from './serialization.js';

// 操作定义
export {
  op,
  onlyOwner,
  onlyDM,
  describe,
  defineOperations,
  checkPermission,
  OperationsBuilder,
} from './operations.js';

// 操作类型
export type {
  GameOperations,
  GameOperationName,
  GameOperationArgs,
  OperationResultMap,
  OperationReturn,
  PlayerOperations,
  FactionOperations,
  GameFlowOperations,
  AssetOperations,
  MovementOperations,
  CombatOperations,
} from './operations-types.js';

// 素材库
export {
  ASSET_LIBRARY,
  getTemplate,
  getPlayerTemplates,
  getDMTemplates,
  isTemplateAvailable,
} from './assets.js';