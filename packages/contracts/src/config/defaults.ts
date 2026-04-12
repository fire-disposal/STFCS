/**
 * 默认配置数据
 *
 * 提供内置的舰船、武器、船体定义
 * 作为无外部配置文件时的回退
 */

import type {
	WeaponDefinition,
	HullDefinition,
	ShipDefinition,
} from './schemas.js';

// ==================== 默认武器定义 ====================

/** 默认武器：自动炮弹 */
export const DEFAULT_WEAPON_AUTOCANNON: WeaponDefinition = {
	id: 'weapon_autocannon',
	name: 'Autocannon',
	nameLocalized: { zh: '自动炮弹', en: 'Autocannon' },
	description: 'Standard ballistic weapon with good range and damage.',
	category: 'BALLISTIC',
	damageType: 'KINETIC',
	mountType: 'TURRET',
	damage: 100,
	empDamage: 0,
	range: 700,
	arc: 180,
	turnRate: 30,
	fluxCost: 80,
	ammo: 100,
	ammoPerShot: 1,
	cooldown: 0.8,
	chargeTime: 0,
	burstSize: 1,
	burstDelay: 0,
	sprite: 'weapon_autocannon',
	projectileSprite: 'projectile_ballistic',
	sound: 'weapon_autocannon_fire',
};

/** 默认武器：激光炮 */
export const DEFAULT_WEAPON_LASER: WeaponDefinition = {
	id: 'weapon_laser',
	name: 'Laser Cannon',
	nameLocalized: { zh: '激光炮', en: 'Laser Cannon' },
	description: 'Energy weapon with consistent damage output.',
	category: 'ENERGY',
	damageType: 'ENERGY',
	mountType: 'FIXED',
	damage: 80,
	empDamage: 20,
	range: 600,
	arc: 30,
	turnRate: 0,
	fluxCost: 120,
	ammoPerShot: 1,
	cooldown: 1.0,
	chargeTime: 0,
	burstSize: 1,
	burstDelay: 0,
	sprite: 'weapon_laser',
	projectileSprite: 'projectile_energy',
	sound: 'weapon_laser_fire',
};

/** 默认武器：导弹发射器 */
export const DEFAULT_WEAPON_MISSILE: WeaponDefinition = {
	id: 'weapon_missile',
	name: 'Missile Launcher',
	nameLocalized: { zh: '导弹发射器', en: 'Missile Launcher' },
	description: 'Guided missile with high explosive warhead.',
	category: 'MISSILE',
	damageType: 'HIGH_EXPLOSIVE',
	mountType: 'TURRET',
	damage: 300,
	empDamage: 0,
	range: 1000,
	arc: 360,
	turnRate: 0,
	fluxCost: 50,
	ammo: 10,
	ammoPerShot: 1,
	cooldown: 3.0,
	chargeTime: 0,
	burstSize: 1,
	burstDelay: 0,
	special: {
		guided: true,
		homing: true,
		beam: false,
		areaEffect: 50,
	},
	sprite: 'weapon_missile',
	projectileSprite: 'projectile_missile',
	sound: 'weapon_missile_fire',
};

/** 默认武器：碎片炮 */
export const DEFAULT_WEAPON_FRAGMENTATION: WeaponDefinition = {
	id: 'weapon_flak',
	name: 'Flak Cannon',
	nameLocalized: { zh: '防空炮', en: 'Flak Cannon' },
	description: 'Anti-fighter weapon with wide spread.',
	category: 'BALLISTIC',
	damageType: 'FRAGMENTATION',
	mountType: 'TURRET',
	damage: 50,
	empDamage: 0,
	range: 500,
	arc: 360,
	turnRate: 60,
	fluxCost: 30,
	ammo: 200,
	ammoPerShot: 1,
	cooldown: 0.3,
	chargeTime: 0,
	burstSize: 4,
	burstDelay: 0.1,
	sprite: 'weapon_flak',
	projectileSprite: 'projectile_flak',
	sound: 'weapon_flak_fire',
};

// ==================== 默认船体定义 ====================

/** 默认船体：护卫舰 */
export const DEFAULT_HULL_FRIGATE: HullDefinition = {
	id: 'hull_frigate',
	name: 'Standard Frigate',
	nameLocalized: { zh: '标准护卫舰', en: 'Standard Frigate' },
	description: 'A balanced frigate hull suitable for various roles.',
	size: 'FRIGATE',
	hitPoints: 2000,
	armor: {
		maxValue: 200,
		quadrants: {
			FRONT_TOP: 200,
			FRONT_BOTTOM: 200,
			LEFT_TOP: 150,
			LEFT_BOTTOM: 150,
			RIGHT_TOP: 150,
			RIGHT_BOTTOM: 150,
		},
	},
	flux: {
		capacity: 3000,
		dissipation: 200,
		ventRate: 400,
	},
	shield: {
		type: 'FRONT',
		radius: 80,
		centerOffset: { x: 0, y: 0 },
		coverageAngle: 120,
		efficiency: 1.0,
		maintenanceCost: 10,
	},
	maxSpeed: 120,
	maxTurnRate: 30,
	acceleration: 50,
	turnAcceleration: 15,
	weaponSlots: [
		{
			id: 'slot_front_medium',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: 30, y: 0 },
			facing: 0,
			arc: 180,
		},
		{
			id: 'slot_front_small',
			type: 'FIXED',
			size: 'SMALL',
			position: { x: 25, y: 10 },
			facing: 0,
			arc: 30,
		},
		{
			id: 'slot_front_small_2',
			type: 'FIXED',
			size: 'SMALL',
			position: { x: 25, y: -10 },
			facing: 0,
			arc: 30,
		},
		{
			id: 'slot_rear_small',
			type: 'TURRET',
			size: 'SMALL',
			position: { x: -20, y: 0 },
			facing: 180,
			arc: 180,
		},
	],
	sprite: 'hull_frigate',
	spriteScale: 1,
	collisionRadius: 30,
};

/** 默认船体：驱逐舰 */
export const DEFAULT_HULL_DESTROYER: HullDefinition = {
	id: 'hull_destroyer',
	name: 'Standard Destroyer',
	nameLocalized: { zh: '标准驱逐舰', en: 'Standard Destroyer' },
	description: 'A larger hull with more weapon slots and armor.',
	size: 'DESTROYER',
	hitPoints: 4000,
	armor: {
		maxValue: 350,
		quadrants: {
			FRONT_TOP: 400,
			FRONT_BOTTOM: 400,
			LEFT_TOP: 300,
			LEFT_BOTTOM: 300,
			RIGHT_TOP: 300,
			RIGHT_BOTTOM: 300,
		},
	},
	flux: {
		capacity: 5000,
		dissipation: 300,
		ventRate: 600,
	},
	shield: {
		type: 'OMNI',
		radius: 100,
		centerOffset: { x: 0, y: 0 },
		coverageAngle: 360,
		efficiency: 1.0,
		maintenanceCost: 15,
	},
	maxSpeed: 90,
	maxTurnRate: 20,
	acceleration: 40,
	turnAcceleration: 10,
	weaponSlots: [
		{
			id: 'slot_front_large',
			type: 'TURRET',
			size: 'LARGE',
			position: { x: 40, y: 0 },
			facing: 0,
			arc: 120,
		},
		{
			id: 'slot_front_medium',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: 35, y: 15 },
			facing: 0,
			arc: 180,
		},
		{
			id: 'slot_front_medium_2',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: 35, y: -15 },
			facing: 0,
			arc: 180,
		},
		{
			id: 'slot_side_small',
			type: 'TURRET',
			size: 'SMALL',
			position: { x: 0, y: 25 },
			facing: 90,
			arc: 180,
		},
		{
			id: 'slot_side_small_2',
			type: 'TURRET',
			size: 'SMALL',
			position: { x: 0, y: -25 },
			facing: 270,
			arc: 180,
		},
		{
			id: 'slot_rear_medium',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: -30, y: 0 },
			facing: 180,
			arc: 180,
		},
	],
	sprite: 'hull_destroyer',
	spriteScale: 1.2,
	collisionRadius: 45,
};

/** 默认船体：巡洋舰 */
export const DEFAULT_HULL_CRUISER: HullDefinition = {
	id: 'hull_cruiser',
	name: 'Standard Cruiser',
	nameLocalized: { zh: '标准巡洋舰', en: 'Standard Cruiser' },
	description: 'A heavy cruiser hull with strong armor and many weapon slots.',
	size: 'CRUISER',
	hitPoints: 8000,
	armor: {
		maxValue: 500,
		quadrants: {
			FRONT_TOP: 600,
			FRONT_BOTTOM: 600,
			LEFT_TOP: 450,
			LEFT_BOTTOM: 450,
			RIGHT_TOP: 450,
			RIGHT_BOTTOM: 450,
		},
	},
	flux: {
		capacity: 10000,
		dissipation: 500,
		ventRate: 1000,
	},
	shield: {
		type: 'OMNI',
		radius: 140,
		centerOffset: { x: 0, y: 0 },
		coverageAngle: 360,
		efficiency: 0.9,
		maintenanceCost: 25,
	},
	maxSpeed: 60,
	maxTurnRate: 12,
	acceleration: 25,
	turnAcceleration: 6,
	weaponSlots: [
		{
			id: 'slot_front_huge',
			type: 'FIXED',
			size: 'LARGE',
			position: { x: 50, y: 0 },
			facing: 0,
			arc: 60,
		},
		{
			id: 'slot_front_medium',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: 45, y: 20 },
			facing: 0,
			arc: 180,
		},
		{
			id: 'slot_front_medium_2',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: 45, y: -20 },
			facing: 0,
			arc: 180,
		},
		{
			id: 'slot_side_medium',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: 10, y: 35 },
			facing: 90,
			arc: 180,
		},
		{
			id: 'slot_side_medium_2',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: 10, y: -35 },
			facing: 270,
			arc: 180,
		},
		{
			id: 'slot_rear_medium',
			type: 'TURRET',
			size: 'MEDIUM',
			position: { x: -40, y: 0 },
			facing: 180,
			arc: 180,
		},
	],
	sprite: 'hull_cruiser',
	spriteScale: 1.5,
	collisionRadius: 60,
};

// ==================== 默认舰船定义 ====================

/** 默认舰船：狼级护卫舰 */
export const DEFAULT_SHIP_WOLF: ShipDefinition = {
	id: 'ship_wolf',
	name: 'Wolf-class Frigate',
	nameLocalized: { zh: '狼级护卫舰', en: 'Wolf-class Frigate' },
	description: 'A fast attack frigate with energy weapons.',
	hullId: 'hull_frigate',
	weaponLoadout: {
		'slot_front_medium': 'weapon_laser',
		'slot_front_small': 'weapon_laser',
		'slot_front_small_2': 'weapon_laser',
		'slot_rear_small': 'weapon_flak',
	},
	tags: ['fast', 'energy', 'attack'],
	faction: 'federation',
	cost: 8,
};

/** 默认舰船：锤头鲨驱逐舰 */
export const DEFAULT_SHIP_HAMMERHEAD: ShipDefinition = {
	id: 'ship_hammerhead',
	name: 'Hammerhead Destroyer',
	nameLocalized: { zh: '锤头鲨驱逐舰', en: 'Hammerhead Destroyer' },
	description: 'A balanced destroyer with mixed armament.',
	hullId: 'hull_destroyer',
	weaponLoadout: {
		'slot_front_large': 'weapon_autocannon',
		'slot_front_medium': 'weapon_autocannon',
		'slot_front_medium_2': 'weapon_autocannon',
		'slot_side_small': 'weapon_flak',
		'slot_side_small_2': 'weapon_flak',
		'slot_rear_medium': 'weapon_missile',
	},
	tags: ['balanced', 'ballistic', 'line'],
	faction: 'federation',
	cost: 15,
};

/** 默认舰船：猎鹰巡洋舰 */
export const DEFAULT_SHIP_FALCON: ShipDefinition = {
	id: 'ship_falcon',
	name: 'Falcon Cruiser',
	nameLocalized: { zh: '猎鹰巡洋舰', en: 'Falcon Cruiser' },
	description: 'A heavy cruiser with powerful forward armament.',
	hullId: 'hull_cruiser',
	weaponLoadout: {
		'slot_front_huge': 'weapon_autocannon',
		'slot_front_medium': 'weapon_laser',
		'slot_front_medium_2': 'weapon_laser',
		'slot_side_medium': 'weapon_autocannon',
		'slot_side_medium_2': 'weapon_autocannon',
		'slot_rear_medium': 'weapon_missile',
	},
	tags: ['heavy', 'mixed', 'flagship'],
	faction: 'federation',
	cost: 25,
};

// ==================== 默认配置集合 ====================

/** 默认武器定义集合 */
export const DEFAULT_WEAPONS: Record<string, WeaponDefinition> = {
	weapon_autocannon: DEFAULT_WEAPON_AUTOCANNON,
	weapon_laser: DEFAULT_WEAPON_LASER,
	weapon_missile: DEFAULT_WEAPON_MISSILE,
	weapon_flak: DEFAULT_WEAPON_FRAGMENTATION,
};

/** 默认船体定义集合 */
export const DEFAULT_HULLS: Record<string, HullDefinition> = {
	hull_frigate: DEFAULT_HULL_FRIGATE,
	hull_destroyer: DEFAULT_HULL_DESTROYER,
	hull_cruiser: DEFAULT_HULL_CRUISER,
};

/** 默认舰船定义集合 */
export const DEFAULT_SHIPS: Record<string, ShipDefinition> = {
	ship_wolf: DEFAULT_SHIP_WOLF,
	ship_hammerhead: DEFAULT_SHIP_HAMMERHEAD,
	ship_falcon: DEFAULT_SHIP_FALCON,
};