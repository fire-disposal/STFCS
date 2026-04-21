/**
 * @vt/data - 统一数据层导出
 *
 * 所有核心类型和值从 GameSchemas（Zod）统一导出
 */

// ==================== 核心模型（Zod Schema + 类型 + 值）====================
export * from "./core/index.js";

// ==================== 游戏规则配置 ====================
export { GAME_RULES, DEFAULT_GAME_RULES, DEFAULT_ASSET_CONFIG, SIZE_COMPATIBILITY, isWeaponSizeCompatible } from "./configs/index.js";
export type { DamageModifierConfig, MovementBudgetConfig, ArmorDamageConfig, GameRulesConfig, AssetLimitsConfig, AssetConfig } from "./configs/index.js";

// ==================== 预设数据 ====================
export { presetShips, presetWeapons, type PresetShip, type PresetWeapon } from "./presets/index.js";

// ==================== 类型值别名（兼容性）====================
import {
	GamePhase,
	Faction,
	PlayerRole,
	DamageType,
	WeaponState,
	WeaponTag,
	HullSize,
	ShipClass,
} from "./core/GameSchemas.js";

export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase];
export type FactionValue = (typeof Faction)[keyof typeof Faction];
export type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole];
export type DamageTypeValue = (typeof DamageType)[keyof typeof DamageType];
export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState];
export type WeaponTagValue = (typeof WeaponTag)[keyof typeof WeaponTag];
export type HullSizeValue = (typeof HullSize)[keyof typeof HullSize];
export type ShipClassValue = (typeof ShipClass)[keyof typeof ShipClass];

// ==================== WebSocket Schema ====================
export {
	WsEventMap,
	validateWsPayload,
	createWsResponse,
	createWsBroadcast,
	createSyncDelta,
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
} from "./core/WsSchemas.js";
export type {
	WsRequest,
	WsResponse,
	WsBroadcast,
	WsEventName,
	DeltaType,
	DeltaChange,
	SyncDeltaPayload,
	AuthLoginPayload,
	RoomCreatePayload,
	RoomJoinPayload,
	RoomActionPayload,
	RoomInfo,
	RoomGetAssetsPayload,
	TokenCreatePayload,
	TokenUpdatePayload,
	TokenGetPayload,
	TokenDeletePayload,
	TokenCopyPresetPayload,
	TokenMountPayload,
	WeaponGetPayload,
	WeaponCreatePayload,
	WeaponUpdatePayload,
	WeaponDeletePayload,
	WeaponCopyPresetPayload,
	SaveCreatePayload,
	SaveLoadPayload,
	SaveDeletePayload,
	PresetListTokensPayload,
	PresetListWeaponsPayload,
	PresetGetPayload,
	GameActionPayload,
	GameQueryPayload,
	DmSpawnPayload,
	DmModifyPayload,
	DmSetModifierPayload,
	SyncEventPayload,
	AssetUploadPayload,
	AssetListPayload,
	AssetBatchGetPayload,
	AssetDeletePayload,
	ProfileUpdatePayload,
} from "./core/WsSchemas.js";
