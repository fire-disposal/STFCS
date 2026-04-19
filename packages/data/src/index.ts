// ==================== 权威JSON Schema类型 ====================
// 基于JSON Schema的一等公民类型定义
export type {
  TextureSourceType,
  Texture,
  FactionType,
  FluxStateType,
  GamePhaseType,
  Metadata,
  ShipJSON,
  ShipSpec,
  ShipRuntime,
  ShieldSpec,
  MountSpec,
  MovementState,
  Point,
  PluginSlot,
  ShipIdFormat,
  WeaponJSON,
  WeaponSpec,
  WeaponRuntime,
  WeaponCategoryType,
  DamageTypeType,
  WeaponStateType,
  WeaponTagType,
  StatusEffect,
  WeaponIdFormat,
  SaveJSON,
  ExportJSON,
  PlayerProfile,
  GameSave,
  SaveMetadata,
  SaveCreationRequest,
  SaveUpdateRequest,
  SaveListItem,
  SaveExport,
  TextureRef,
  Asset,
  AssetType,
  AssetUploadRequest,
  AssetListItem,
  AssetFilter,
  AssetStats,

} from "./core/index.js";

// ==================== 运行时常量 ====================
// 与JSON Schema对应的运行时枚举值
export {
	DamageType,
	WeaponCategory,
	WeaponSlotSize,
	WeaponTag,
	HullSize,
	ShipClass,
	WeaponState,
	ArmorQuadrant,
	GamePhase,
	Faction,
	PlayerRole,
	ConnectionQuality,
	ChatMessageType,
} from "./core/RuntimeEnums.js";

// 先导入值以用于类型推导
import {
	GamePhase,
	Faction,
	PlayerRole,
	WeaponCategory,
	DamageType,
	WeaponState,
	WeaponTag,
} from "./core/RuntimeEnums.js";

// ==================== 类型辅助 ====================
// 从运行时常量推导的类型别名（兼容性）
export type GamePhaseValue = typeof GamePhase[keyof typeof GamePhase];
export type FactionValue = typeof Faction[keyof typeof Faction];
export type PlayerRoleValue = typeof PlayerRole[keyof typeof PlayerRole];
export type WeaponCategoryValue = typeof WeaponCategory[keyof typeof WeaponCategory];
export type DamageTypeValue = typeof DamageType[keyof typeof DamageType];
export type WeaponStateValue = typeof WeaponState[keyof typeof WeaponState];
export type WeaponTagValue = typeof WeaponTag[keyof typeof WeaponTag];

// 导出数据注册器
export { DataRegistry, dataRegistry } from "./core/DataRegistry.js";

// 导出配置加载器（含游戏规则 + 服务器配置）
export * from "./configs/index.js";
