/**
 * @vt/data - 统一数据层导出
 */

export * from "./core/index.js"

export {
  GAME_RULES,
  DEFAULT_GAME_RULES,
  DEFAULT_ASSET_CONFIG,
  SIZE_COMPATIBILITY,
  isWeaponSizeCompatible,
} from "./configs/index.js"
export type {
  DamageModifierConfig,
  MovementBudgetConfig,
  ArmorDamageConfig,
  GameRulesConfig,
  AssetLimitsConfig,
  AssetConfig,
} from "./configs/index.js"

export {
  presetShips,
  presetWeapons,
} from "./presets/index.js"
export type { PresetShip, PresetWeapon } from "./presets/index.js"

import {
  GamePhase,
  Faction,
  PlayerRole,
  DamageType,
  WeaponState,
  HullSize,
  ShipClass,
} from "./core/GameSchemas.js"

export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase]
export type FactionValue = (typeof Faction)[keyof typeof Faction]
export type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole]
export type DamageTypeValue = (typeof DamageType)[keyof typeof DamageType]
export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState]
export type HullSizeValue = (typeof HullSize)[keyof typeof HullSize]
export type ShipClassValue = (typeof ShipClass)[keyof typeof ShipClass]

export {
  createRpcApi,
  createTypedRpcApi,
  createWsResponse,
  createWsBroadcast,
  validateWsPayload,
  validateWsResponse,
  WsEventDefinitions,
  createPatch,
  createPatchPayload,
  createBattleLogEvent,
  createBattleLogEdit,
  GAME_ACTION_NAMES,
  segment,
  LOG_COLORS,
  RichTextSegmentSchema,
} from "./core/index.js"

export type {
  RpcApi,
  RequestSender,
  WsEventName,
  WsPayload,
  WsResponseData,
  WsRequest,
  WsResponse,
  RoomInfo,
  SaveBuild,
  InventoryToken,
  CombatToken,
  TokenJSON,
  TokenSpec,
  TokenRuntime,
  CustomizeTokenPayload,
  CustomizeWeaponPayload,
  SaveActionPayload,
  AssetActionPayload,
  GameActionPayload,
  GameActionName,
  GameQueryPayload,
  EditTokenPayload,
  EditRoomPayload,
  RoomActionPayload,
  PatchOp,
  StatePatch,
  StatePatchPayload,
  BattleLogEvent,
  BattleLogPayload,
  RichTextSegment,
  EditLogContext,
} from "./core/index.js"

export {
  CombatTokenSchema,
  InventoryTokenSchema,
  TokenJSONSchema,
  WeaponJSONSchema,
  PlayerInfoSchema,
  GameSaveSchema,
  GameMapSchema,
  RoomArchiveSchema,
  RoomArchiveMetadataSchema,
} from "./core/GameSchemas.js"
export type { PlayerInfo, RoomArchive, RoomArchiveMetadata } from "./core/GameSchemas.js"
export { validatePlayerInfo } from "./core/GameSchemas.js"