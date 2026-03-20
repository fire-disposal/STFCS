/**
 * 数据驱动配置 Schema 定义
 * 
 * 所有游戏配置数据（舰船、武器、船体等）的 Zod Schema
 * 作为前后端共享的单一真相来源
 */

import { z } from 'zod';

// ==================== 基础类型 ====================

/** 伤害类型 */
export const DamageTypeSchema = z.enum([
	'KINETIC',      // 动能 - 2x护盾, 0.5x装甲
	'HIGH_EXPLOSIVE', // 高爆 - 0.5x护盾, 2x装甲
	'FRAGMENTATION', // 碎片 - 0.25x护盾, 0.25x装甲
	'ENERGY',       // 能量 - 1x全类型
]);

/** 武器类型 */
export const WeaponCategorySchema = z.enum([
	'BALLISTIC',    // 弹道
	'ENERGY',       // 能量
	'MISSILE',      // 导弹
]);

/** 武器挂载类型 */
export const MountTypeSchema = z.enum([
	'FIXED',        // 固定
	'TURRET',       // 炮塔
	'HYBRID',       // 混合
]);

/** 护盾类型 */
export const ShieldTypeSchema = z.enum([
	'FRONT',        // 前向护盾
	'OMNI',         // 全向护盾
	'NONE',         // 无护盾
]);

/** 舰船尺寸级别 */
export const HullSizeSchema = z.enum([
	'FIGHTER',      // 战机
	'FRIGATE',      // 护卫舰
	'DESTROYER',    // 驱逐舰
	'CRUISER',      // 巡洋舰
	'CAPITAL',      // 主力舰
]);

/** 装甲象限 */
export const ArmorQuadrantConfigSchema = z.enum([
	'FRONT_TOP',
	'FRONT_BOTTOM',
	'LEFT_TOP',
	'LEFT_BOTTOM',
	'RIGHT_TOP',
	'RIGHT_BOTTOM',
]);

// ==================== 武器配置 ====================

/** 武器定义 Schema */
export const WeaponDefinitionSchema = z.object({
	// 基础信息
	id: z.string().min(1),
	name: z.string().min(1),
	nameLocalized: z.object({
		zh: z.string().min(1),
		en: z.string().min(1),
	}).optional(),
	description: z.string().optional(),
	
	// 武器类型
	category: WeaponCategorySchema,
	damageType: DamageTypeSchema,
	mountType: MountTypeSchema,
	
	// 战斗属性
	damage: z.number().min(0),
	empDamage: z.number().min(0).default(0),  // EMP伤害
	range: z.number().min(0),
	arc: z.number().min(0).max(360),          // 射击角度
	turnRate: z.number().min(0).default(0),   // 炮塔转向速度
	
	// 资源消耗
	fluxCost: z.number().min(0),              // 每次射击flux消耗
	ammo: z.number().min(0).optional(),       // 弹药（导弹/弹道）
	ammoPerShot: z.number().min(1).default(1),
	
	// 射击参数
	cooldown: z.number().min(0),              // 冷却时间（秒）
	chargeTime: z.number().min(0).default(0), // 充能时间
	burstSize: z.number().min(1).default(1),  // 每次射击子弹数
	burstDelay: z.number().min(0).default(0), // 连发间隔
	
	// 特殊效果
	special: z.object({
		guided: z.boolean().default(false),    // 制导
		homing: z.boolean().default(false),    // 追踪
		beam: z.boolean().default(false),      // 光束
		areaEffect: z.number().min(0).default(0), // 范围伤害半径
	}).optional(),
	
	// 视觉资源
	sprite: z.string().optional(),
	projectileSprite: z.string().optional(),
	sound: z.string().optional(),
});

// ==================== 船体配置 ====================

/** 护盾配置 Schema */
export const ShieldConfigSchema = z.object({
	type: ShieldTypeSchema,
	radius: z.number().min(0),
	centerOffset: z.object({
		x: z.number(),
		y: z.number(),
	}).default({ x: 0, y: 0 }),
	coverageAngle: z.number().min(0).max(360),
	efficiency: z.number().min(0).max(2),     // 护盾效率
	maintenanceCost: z.number().min(0),       // 每秒flux消耗
});

/** Flux系统配置 Schema */
export const FluxConfigSchema = z.object({
	capacity: z.number().min(0),              // 容量
	dissipation: z.number().min(0),           // 散热速度
	ventRate: z.number().min(0).optional(),   // 主动散热速度
});

/** 装甲配置 Schema */
export const ArmorConfigSchema = z.object({
	maxValue: z.number().min(0),              // 每象限最大值
	quadrants: z.record(ArmorQuadrantConfigSchema, z.number().min(0)).optional(),
});

/** 船体定义 Schema */
export const HullDefinitionSchema = z.object({
	// 基础信息
	id: z.string().min(1),
	name: z.string().min(1),
	nameLocalized: z.object({
		zh: z.string().min(1),
		en: z.string().min(1),
	}).optional(),
	description: z.string().optional(),
	
	// 船体属性
	size: HullSizeSchema,
	hitPoints: z.number().min(0),             // 船体HP
	armor: ArmorConfigSchema,
	flux: FluxConfigSchema,
	shield: ShieldConfigSchema.optional(),
	
	// 运动属性
	maxSpeed: z.number().min(0),
	maxTurnRate: z.number().min(0),           // 最大转向速度
	acceleration: z.number().min(0),
	turnAcceleration: z.number().min(0),
	
	// 武器挂载点
	weaponSlots: z.array(z.object({
		id: z.string().min(1),
		type: MountTypeSchema,
		size: z.enum(['SMALL', 'MEDIUM', 'LARGE', 'HUGE']),
		position: z.object({
			x: z.number(),
			y: z.number(),
		}),
		facing: z.number(),                    // 初始朝向
		arc: z.number().min(0).max(360),       // 射界
	})).default([]),
	
	// 视觉资源
	sprite: z.string().optional(),
	spriteScale: z.number().min(0.1).default(1),
	collisionRadius: z.number().min(0),
});

// ==================== 舰船配置 ====================

/** 舰船定义 Schema（船体 + 武器配置） */
export const ShipDefinitionSchema = z.object({
	// 基础信息
	id: z.string().min(1),
	name: z.string().min(1),
	nameLocalized: z.object({
		zh: z.string().min(1),
		en: z.string().min(1),
	}).optional(),
	description: z.string().optional(),
	
	// 船体引用
	hullId: z.string().min(1),
	
	// 武器配置（挂载点ID -> 武器ID）
	weaponLoadout: z.record(z.string(), z.string()).default({}),
	
	// 舰船特性
	variant: z.string().optional(),           // 变体名称
	skin: z.string().optional(),              // 皮肤ID
	
	// 元数据
	tags: z.array(z.string()).default([]),
	faction: z.string().optional(),           // 默认阵营
	cost: z.number().min(0).optional(),       // 部署点数
});

// ==================== 资源清单 ====================

/** 资源清单 Schema */
export const AssetManifestSchema = z.object({
	version: z.string(),
	ships: z.array(z.string()),
	weapons: z.array(z.string()),
	hulls: z.array(z.string()),
	sprites: z.record(z.string(), z.string()).optional(),
});

// ==================== 类型推导 ====================

export type DamageType = z.infer<typeof DamageTypeSchema>;
export type WeaponCategory = z.infer<typeof WeaponCategorySchema>;
export type MountType = z.infer<typeof MountTypeSchema>;
export type ShieldType = z.infer<typeof ShieldTypeSchema>;
export type HullSize = z.infer<typeof HullSizeSchema>;
export type ArmorQuadrantConfig = z.infer<typeof ArmorQuadrantConfigSchema>;

export type WeaponDefinition = z.infer<typeof WeaponDefinitionSchema>;
export type ShieldConfig = z.infer<typeof ShieldConfigSchema>;
export type FluxConfig = z.infer<typeof FluxConfigSchema>;
export type ArmorConfig = z.infer<typeof ArmorConfigSchema>;
export type HullDefinition = z.infer<typeof HullDefinitionSchema>;
export type ShipDefinition = z.infer<typeof ShipDefinitionSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;