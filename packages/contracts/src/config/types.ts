/**
 * 配置类型扩展和工具类型
 */

import type {
	DamageType,
	ShieldType,
	WeaponDefinition,
	HullDefinition,
	ShipDefinition,
	ArmorQuadrantConfig,
} from './schemas.js';

// ==================== 伤害系数映射 ====================

/** 伤害类型对护盾/装甲的系数 */
export interface DamageModifiers {
	shield: number;
	armor: number;
	hull: number;
}

/** 伤害类型系数表 */
export const DAMAGE_MODIFIERS: Record<DamageType, DamageModifiers> = {
	KINETIC: {
		shield: 2.0,
		armor: 0.5,
		hull: 1.0,
	},
	HIGH_EXPLOSIVE: {
		shield: 0.5,
		armor: 2.0,
		hull: 1.0,
	},
	FRAGMENTATION: {
		shield: 0.25,
		armor: 0.25,
		hull: 1.0,
	},
	ENERGY: {
		shield: 1.0,
		armor: 1.0,
		hull: 1.0,
	},
};

// ==================== 武器槽位大小 ====================

export type WeaponSlotSize = 'SMALL' | 'MEDIUM' | 'LARGE' | 'HUGE';

/** 武器槽位大小兼容性 */
export const WEAPON_SIZE_COMPATIBILITY: Record<WeaponSlotSize, WeaponSlotSize[]> = {
	HUGE: ['HUGE', 'LARGE', 'MEDIUM', 'SMALL'],
	LARGE: ['LARGE', 'MEDIUM', 'SMALL'],
	MEDIUM: ['MEDIUM', 'SMALL'],
	SMALL: ['SMALL'],
};

// ==================== 舰船实例类型 ====================

/** 创建舰船实例的参数 */
export interface CreateShipInstanceParams {
	id: string;                    // 实例ID
	shipDefinitionId: string;      // 舰船定义ID
	position: { x: number; y: number };
	heading: number;
	ownerId: string;
	faction?: string;
	controllingPlayerId?: string;
	isEnemy?: boolean;
}

/** 舰船实例运行时状态 */
export interface ShipInstanceState {
	id: string;
	shipDefinitionId: string;
	hullDefinitionId: string;
	
	// 位置状态
	position: { x: number; y: number };
	heading: number;
	
	// 归属
	ownerId: string;
	faction: string;
	controllingPlayerId?: string;
	isEnemy: boolean;
	
	// 船体状态
	hitPoints: number;
	maxHitPoints: number;
	
	// 装甲状态
	armorQuadrants: Record<ArmorQuadrantConfig, number>;
	maxArmorPerQuadrant: number;
	
	// Flux状态
	flux: number;
	fluxCapacity: number;
	fluxDissipation: number;
	softFlux: number;
	hardFlux: number;
	fluxState: 'normal' | 'venting' | 'overloaded';
	
	// 护盾状态
	shieldActive: boolean;
	shieldRadius: number;
	shieldType: ShieldType;
	
	// 武器状态
	weaponCooldowns: Record<string, number>;
	weaponAmmo: Record<string, number>;
	
	// 行动状态
	remainingActions: number;
	actionsPerTurn: number;
	remainingMovement: number;
	maxMovement: number;
	
	// 状态标记
	isVenting: boolean;
	isOverloaded: boolean;
	overloadTurnsRemaining: number;
}

// ==================== 配置加载器接口 ====================

/** 配置加载器接口（前后端通用） */
export interface IConfigLoader {
	loadShipDefinition(id: string): Promise<ShipDefinition | null>;
	loadHullDefinition(id: string): Promise<HullDefinition | null>;
	loadWeaponDefinition(id: string): Promise<WeaponDefinition | null>;
	
	// 同步版本（用于已预加载的场景）
	getShipDefinition(id: string): ShipDefinition | undefined;
	getHullDefinition(id: string): HullDefinition | undefined;
	getWeaponDefinition(id: string): WeaponDefinition | undefined;
	
	// 批量加载
	loadAll(): Promise<void>;
}

// ==================== 配置验证结果 ====================

export interface ConfigValidationResult {
	valid: boolean;
	errors: ConfigValidationError[];
}

export interface ConfigValidationError {
	path: string;
	message: string;
	value?: unknown;
}

// ==================== 资源引用类型 ====================

/** 资源引用（用于运行时解析） */
export interface AssetRef<T> {
	readonly id: string;
	readonly type: 'ship' | 'hull' | 'weapon' | 'sprite' | 'sound';
	resolve(): Promise<T>;
	cached?: T;
}

// ==================== 默认值常量 ====================

/** 默认舰船属性 */
export const DEFAULT_SHIP_STATS = {
	actionsPerTurn: 3,
	baseMovement: 100,
	collisionRadius: 30,
	spriteScale: 1,
} as const;

/** 默认武器属性 */
export const DEFAULT_WEAPON_STATS = {
	turnRate: 0,
	empDamage: 0,
	ammo: Infinity,
	ammoPerShot: 1,
	chargeTime: 0,
	burstSize: 1,
	burstDelay: 0,
} as const;

/** 默认Flux属性 */
export const DEFAULT_FLUX_STATS = {
	ventRateMultiplier: 2,  // 主动散热速度 = dissipation * 2
} as const;