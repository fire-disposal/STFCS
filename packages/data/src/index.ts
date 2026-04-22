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
  WeaponTag,
  HullSize,
  ShipClass,
} from "./core/GameSchemas.js"

export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase]
export type FactionValue = (typeof Faction)[keyof typeof Faction]
export type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole]
export type DamageTypeValue = (typeof DamageType)[keyof typeof DamageType]
export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState]
export type WeaponTagValue = (typeof WeaponTag)[keyof typeof WeaponTag]
export type HullSizeValue = (typeof HullSize)[keyof typeof HullSize]
export type ShipClassValue = (typeof ShipClass)[keyof typeof ShipClass]

export {
  createRpcApi,
  createTypedRpcApi,
  createWsResponse,
  createWsBroadcast,
  createSyncDelta,
  validateWsPayload,
  validateWsResponse,
  WsEventDefinitions,
  deltaTokenUpdate,
  deltaTokenAdd,
  deltaTokenRemove,
  deltaTokenDestroyed,
  deltaPlayerUpdate,
  deltaPlayerJoin,
  deltaPlayerLeave,
  deltaHostChange,
  deltaPhaseChange,
  deltaTurnChange,
  deltaFactionTurn,
  deltaModifierAdd,
  deltaModifierRemove,
} from "./core/index.js"

export type {
  RpcApi,
  RequestSender,
  WsEventName,
  WsPayload,
  WsResponseData,
  WsRequest,
  WsResponse,
  DeltaChange,
  DeltaType,
  SyncDeltaPayload,
  SyncEventPayload,
  RoomInfo,
  WeaponBuild,
  ShipBuild,
  InventoryToken,
  CombatToken,
  TokenSpec,
  TokenRuntime,
  EditTokenPayload,
  StatePatch,
  StatePatchPayload,
  BattleLogEdit,
  BattleLogEvent,
  BattleLogPayload,
} from "./core/index.js"