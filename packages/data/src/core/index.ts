/**
 * Core JSON Types 模块导出
 *
 * 提供所有JSON模型的类型定义
 */

// 通用类型
export type {
	TextureSourceType,
	Texture,
	FactionType,
	FluxStateType,
	GamePhaseType,
	Metadata,
	createTexture,
} from "./CommonJsonTypes.js";

// 舰船类型
export type {
	ShipJSON,
	ShipSpec,
	ShipRuntime,
	ShieldSpec,
	MountSpec,
	MovementState,
	Point,
	PluginSlot,
	ShipIdFormat,
} from "./ShipJsonTypes.js";

// 武器类型
export type {
	WeaponJSON,
	WeaponSpec,
	WeaponRuntime,
	WeaponCategoryType,
	DamageTypeType,
	WeaponStateType,
	WeaponTagType,
	StatusEffect,
	WeaponIdFormat,
} from "./WeaponJsonTypes.js";

// 存档和导出类型
export type { SaveJSON, ExportJSON } from "./DataRegistry.js";
