/**
 * 游戏规则配置
 *
 * 前端兼容版本：使用硬编码规则，移除 fs 依赖
 * 服务器端可以有自己的配置加载逻辑
 *
 * 注意：Schema 定义统一在 schemas/index.ts 中维护
 */

// ==================== 常量 ====================

export const SIZE_COMPATIBILITY: Record<string, string[]> = {
	SMALL: ["SMALL"],
	MEDIUM: ["SMALL", "MEDIUM"],
	LARGE: ["SMALL", "MEDIUM", "LARGE"],
};

export function isWeaponSizeCompatible(mountSize: string, weaponSize: string): boolean {
	return SIZE_COMPATIBILITY[mountSize]?.includes(weaponSize) ?? false;
}

// ==================== 伤害修正配置 ====================

export interface DamageModifierConfig {
	shieldMultiplier: number;
	penetrationMultiplier: number;
	hullMultiplier?: number;
}

// ==================== 护甲剥落配置 ====================

export interface ArmorDamageConfig {
	armorDamageRatio: number;
}

// ==================== 移动预算修正配置 ====================

export interface MovementBudgetConfig {
	forwardMultiplier: number;
	backwardMultiplier: number;
	strafeMultiplier: number;
	turnMultiplier: number;
}

// ==================== 游戏规则 ====================

export interface GameRulesConfig {
	movement: {
		budget: MovementBudgetConfig;
	};
	combat: {
		damageModifiers: Record<string, DamageModifierConfig>;
		armor: ArmorDamageConfig;
	};
}

// ==================== 默认配置 ====================

export const DEFAULT_GAME_RULES: GameRulesConfig = {
	movement: {
		budget: {
			forwardMultiplier: 2.0,
			backwardMultiplier: 2.0,
			strafeMultiplier: 1.0,
			turnMultiplier: 1.0,
		},
	},
	combat: {
		damageModifiers: {
			KINETIC: { shieldMultiplier: 2.0, penetrationMultiplier: 0.5, hullMultiplier: 1.0 },
			HIGH_EXPLOSIVE: { shieldMultiplier: 0.5, penetrationMultiplier: 2.0, hullMultiplier: 1.0 },
			ENERGY: { shieldMultiplier: 1.0, penetrationMultiplier: 1.0, hullMultiplier: 1.0 },
			FRAGMENTATION: { shieldMultiplier: 0.25, penetrationMultiplier: 0.25, hullMultiplier: 1.0 },
		},
		armor: {
			armorDamageRatio: 1.0,
		},
	},
};

// ==================== 资产上传限制配置 ====================

export interface AssetLimitsConfig {
	maxFileSize: number;          // 最大文件大小（字节）
	maxWidth: number;             // 最大宽度（像素）
	maxHeight: number;            // 最大高度（像素）
	minWidth: number;             // 最小宽度（像素）
	minHeight: number;            // 最小高度（像素）
	allowedMimeTypes: string[];   // 允许的 MIME 类型
}

export interface AssetConfig {
	avatar: AssetLimitsConfig;
	ship_texture: AssetLimitsConfig;
	weapon_texture: AssetLimitsConfig;
}

export const DEFAULT_ASSET_CONFIG: AssetConfig = {
	avatar: {
		allowedMimeTypes: ["image/png", "image/jpeg", "image/gif"],
		maxFileSize: 512 * 1024,
		minWidth: 16,
		maxWidth: 256,
		minHeight: 16,
		maxHeight: 256,
	},
	ship_texture: {
		allowedMimeTypes: ["image/png"],
		maxFileSize: 2 * 1024 * 1024,
		minWidth: 9,
		maxWidth: 1024,
		minHeight: 9,
		maxHeight: 1024,
	},
	weapon_texture: {
		allowedMimeTypes: ["image/png"],
		maxFileSize: 1 * 1024 * 1024,
		minWidth: 3,
		maxWidth: 256,
		minHeight: 3,
		maxHeight: 256,
	},
};

export const GAME_RULES = DEFAULT_GAME_RULES;