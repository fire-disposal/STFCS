/**
 * 配置验证函数
 * 
 * 提供配置数据的验证和合并功能
 */

import { z } from 'zod';
import type {
	WeaponDefinition,
	HullDefinition,
	ShipDefinition,
} from './schemas.js';
import {
	WeaponDefinitionSchema,
	HullDefinitionSchema,
	ShipDefinitionSchema,
} from './schemas.js';
import {
	DEFAULT_WEAPONS,
	DEFAULT_HULLS,
	DEFAULT_SHIPS,
} from './defaults.js';
import type {
	ConfigValidationResult,
	ConfigValidationError,
} from './types.js';

// ==================== 验证函数 ====================

/**
 * 验证武器定义
 */
export function validateWeaponDefinition(data: unknown): ConfigValidationResult {
	const errors: ConfigValidationError[] = [];
	
	try {
		WeaponDefinitionSchema.parse(data);
		return { valid: true, errors: [] };
	} catch (e) {
		if (e instanceof z.ZodError) {
			for (const issue of e.issues) {
				errors.push({
					path: issue.path.join('.'),
					message: issue.message,
					value: issue.path.reduce((obj: unknown, key) => {
						if (obj && typeof obj === 'object') {
							return (obj as Record<string, unknown>)[String(key)];
						}
						return undefined;
					}, data),
				});
			}
		}
		return { valid: false, errors };
	}
}

/**
 * 验证船体定义
 */
export function validateHullDefinition(data: unknown): ConfigValidationResult {
	const errors: ConfigValidationError[] = [];
	
	try {
		HullDefinitionSchema.parse(data);
		return { valid: true, errors: [] };
	} catch (e) {
		if (e instanceof z.ZodError) {
			for (const issue of e.issues) {
				errors.push({
					path: issue.path.join('.'),
					message: issue.message,
					value: issue.path.reduce((obj: unknown, key) => {
						if (obj && typeof obj === 'object') {
							return (obj as Record<string, unknown>)[String(key)];
						}
						return undefined;
					}, data),
				});
			}
		}
		return { valid: false, errors };
	}
}

/**
 * 验证舰船定义
 */
export function validateShipDefinition(data: unknown): ConfigValidationResult {
	const errors: ConfigValidationError[] = [];
	
	try {
		ShipDefinitionSchema.parse(data);
		return { valid: true, errors: [] };
	} catch (e) {
		if (e instanceof z.ZodError) {
			for (const issue of e.issues) {
				errors.push({
					path: issue.path.join('.'),
					message: issue.message,
					value: issue.path.reduce((obj: unknown, key) => {
						if (obj && typeof obj === 'object') {
							return (obj as Record<string, unknown>)[String(key)];
						}
						return undefined;
					}, data),
				});
			}
		}
		return { valid: false, errors };
	}
}

// ==================== 合并函数 ====================

/**
 * 合并武器定义（用户配置覆盖默认值）
 */
export function mergeWeaponDefinition(
	userData: Partial<WeaponDefinition>
): WeaponDefinition {
	const defaults = DEFAULT_WEAPONS[userData.id || ''] || {
		id: userData.id || 'unknown',
		name: userData.name || 'Unknown Weapon',
		category: 'BALLISTIC',
		damageType: 'KINETIC',
		mountType: 'TURRET',
		damage: 100,
		range: 500,
		arc: 180,
		fluxCost: 50,
		cooldown: 1,
		ammoPerShot: 1,
		burstSize: 1,
		burstDelay: 0,
		chargeTime: 0,
		empDamage: 0,
		turnRate: 0,
	};

	return {
		...defaults,
		...userData,
	} as WeaponDefinition;
}

/**
 * 合并船体定义
 */
export function mergeHullDefinition(
	userData: Partial<HullDefinition>
): HullDefinition {
	const defaults = DEFAULT_HULLS[userData.id || ''] || DEFAULT_HULLS.hull_frigate;
	
	return {
		...defaults,
		...userData,
		armor: {
			...defaults.armor,
			...userData.armor,
		},
		flux: {
			...defaults.flux,
			...userData.flux,
		},
		weaponSlots: userData.weaponSlots || defaults.weaponSlots,
	} as HullDefinition;
}

/**
 * 合并舰船定义
 */
export function mergeShipDefinition(
	userData: Partial<ShipDefinition>
): ShipDefinition {
	const defaults = DEFAULT_SHIPS[userData.id || ''] || {
		id: userData.id || 'unknown',
		name: userData.name || 'Unknown Ship',
		hullId: 'hull_frigate',
		weaponLoadout: {},
		tags: [],
	};

	return {
		...defaults,
		...userData,
	} as ShipDefinition;
}

// ==================== 引用验证 ====================

/**
 * 验证舰船定义的引用完整性
 * 检查 hullId 和 weaponLoadout 中的武器ID是否存在
 */
export function validateShipReferences(
	ship: ShipDefinition,
	hulls: Record<string, HullDefinition>,
	weapons: Record<string, WeaponDefinition>
): ConfigValidationResult {
	const errors: ConfigValidationError[] = [];
	
	// 检查 hullId
	if (!hulls[ship.hullId]) {
		errors.push({
			path: 'hullId',
			message: `Hull definition not found: ${ship.hullId}`,
			value: ship.hullId,
		});
	}
	
	// 检查武器引用
	const hull = hulls[ship.hullId];
	if (hull) {
		for (const [slotId, weaponId] of Object.entries(ship.weaponLoadout)) {
			// 检查槽位是否存在
			const slot = hull.weaponSlots.find(s => s.id === slotId);
			if (!slot) {
				errors.push({
					path: `weaponLoadout.${slotId}`,
					message: `Weapon slot not found in hull: ${slotId}`,
					value: weaponId,
				});
				continue;
			}
			
			// 检查武器是否存在
			if (!weapons[weaponId]) {
				errors.push({
					path: `weaponLoadout.${slotId}`,
					message: `Weapon definition not found: ${weaponId}`,
					value: weaponId,
				});
				continue;
			}
			
			// 检查武器尺寸兼容性
			const weapon = weapons[weaponId];
			const slotSizeIndex = ['SMALL', 'MEDIUM', 'LARGE', 'HUGE'].indexOf(slot.size);
			const weaponSizeIndex = ['SMALL', 'MEDIUM', 'LARGE', 'HUGE'].indexOf(
				weapon.mountType === 'FIXED' ? 'SMALL' : slot.size // 简化处理
			);
			
			if (weaponSizeIndex > slotSizeIndex) {
				errors.push({
					path: `weaponLoadout.${slotId}`,
					message: `Weapon too large for slot: ${weaponId} requires ${slot.size} or larger`,
					value: weaponId,
				});
			}
		}
	}
	
	return {
		valid: errors.length === 0,
		errors,
	};
}

// ==================== 批量验证 ====================

export interface BatchValidationResult {
	valid: boolean;
	weapons: Record<string, ConfigValidationResult>;
	hulls: Record<string, ConfigValidationResult>;
	ships: Record<string, ConfigValidationResult>;
	references: Record<string, ConfigValidationResult>;
}

/**
 * 批量验证所有配置
 */
export function validateAllConfigs(
	weapons: Record<string, unknown>,
	hulls: Record<string, unknown>,
	ships: Record<string, unknown>
): BatchValidationResult {
	const weaponResults: Record<string, ConfigValidationResult> = {};
	const hullResults: Record<string, ConfigValidationResult> = {};
	const shipResults: Record<string, ConfigValidationResult> = {};
	const referenceResults: Record<string, ConfigValidationResult> = {};
	
	// 验证武器
	for (const [id, data] of Object.entries(weapons)) {
		weaponResults[id] = validateWeaponDefinition(data);
	}
	
	// 验证船体
	for (const [id, data] of Object.entries(hulls)) {
		hullResults[id] = validateHullDefinition(data);
	}
	
	// 验证舰船
	for (const [id, data] of Object.entries(ships)) {
		shipResults[id] = validateShipDefinition(data);
	}
	
	// 验证引用完整性
	const validWeapons = Object.fromEntries(
		Object.entries(weapons).filter(([id]) => weaponResults[id]?.valid)
	) as Record<string, WeaponDefinition>;
	const validHulls = Object.fromEntries(
		Object.entries(hulls).filter(([id]) => hullResults[id]?.valid)
	) as Record<string, HullDefinition>;
	
	for (const [id, data] of Object.entries(ships)) {
		if (shipResults[id]?.valid) {
			referenceResults[id] = validateShipReferences(
				data as ShipDefinition,
				validHulls,
				validWeapons
			);
		}
	}
	
	// 汇总结果
	const allValid = 
		Object.values(weaponResults).every(r => r.valid) &&
		Object.values(hullResults).every(r => r.valid) &&
		Object.values(shipResults).every(r => r.valid) &&
		Object.values(referenceResults).every(r => r.valid);
	
	return {
		valid: allValid,
		weapons: weaponResults,
		hulls: hullResults,
		ships: shipResults,
		references: referenceResults,
	};
}