/**
 * 配置模块入口
 * 
 * 导出所有配置相关的 Schema、类型和工具
 */

// Schema 和类型
export * from './schemas.js';
export * from './types.js';

// 默认配置
export * from './defaults.js';

// 验证函数
export * from './validation.js';

// 便捷重导出
export type {
	DamageType,
	WeaponCategory,
	MountType,
	ShieldType,
	HullSize,
	WeaponDefinition,
	HullDefinition,
	ShipDefinition,
	ShieldConfig,
	FluxConfig,
	ArmorConfig,
	AssetManifest,
} from './schemas.js';

export type {
	DamageModifiers,
	WeaponSlotSize,
	CreateShipInstanceParams,
	ShipInstanceState,
	IConfigLoader,
	ConfigValidationResult,
	ConfigValidationError,
	AssetRef,
} from './types.js';

export {
	DAMAGE_MODIFIERS,
	WEAPON_SIZE_COMPATIBILITY,
	DEFAULT_SHIP_STATS,
	DEFAULT_WEAPON_STATS,
	DEFAULT_FLUX_STATS,
} from './types.js';