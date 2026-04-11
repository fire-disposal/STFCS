/**
 * 共享包主导出（主线）
 *
 * 仅保留 Colyseus 战斗主线常用导出。
 * 其他扩展能力请使用子路径导入（如 `@vt/shared/types`、`@vt/shared/config`）。
 */

// ==================== Colyseus 战斗状态（主线） ====================
export {
  Transform,
  WeaponSlot,
  PlayerState,
  ShipState,
  GameRoomState,
  ArraySchema,
  type GamePhase,
  type ConnectionQuality,
  type WeaponDamageType,
  ClientCommand,
  DAMAGE_MULTIPLIERS,
  GAME_CONFIG,
} from './schema/GameSchema.js';

export {
  type MovementPlan,
  isMoveValid,
  isTurnValid,
  distance,
  angleBetween,
  angleDifference,
  createShipPolygon,
  checkCollision,
  isPointInArc,
  calculateThreePhaseMove,
  validateThreePhaseMove,
} from './math/index.js';

// ==================== 主线常量 ====================
export {
  FACTIONS,
  DEFAULT_FACTION_IDS,
  getFactionColor,
  getFactionLocalizedName,
} from './constants/index.js';

// ==================== 协议版本 ====================
export { PROTOCOL_VERSION } from './core-types.js';