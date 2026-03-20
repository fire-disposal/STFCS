/**
 * 舰船工厂
 * 
 * 从配置定义创建舰船实例
 * 整合 ConfigManager 和 Ship 领域模型
 */

import { Ship } from '../../domain/ship/Ship';
import type { ShipConfig } from '../../domain/ship/types';
import type {
	ShipDefinition,
	HullDefinition,
	WeaponDefinition,
	CreateShipInstanceParams,
	ShipInstanceState,
} from '@vt/shared/config';
import type { ConfigManager } from '../../infrastructure/assets/ConfigManager';

export interface ShipFactoryOptions {
	configManager: ConfigManager;
}

/**
 * 舰船工厂
 * 负责从配置创建舰船实例
 */
export class ShipFactory {
	private readonly _configManager: ConfigManager;
	
	constructor(options: ShipFactoryOptions) {
		this._configManager = options.configManager;
	}
	
	/**
	 * 从舰船定义ID创建舰船实例
	 */
	async createFromDefinition(params: CreateShipInstanceParams): Promise<Ship> {
		const { id, shipDefinitionId, position, heading, ownerId, faction, controllingPlayerId, isEnemy } = params;
		
		// 获取舰船定义
		const shipDef = await this._configManager.loadShipDefinition(shipDefinitionId);
		if (!shipDef) {
			throw new Error(`Ship definition not found: ${shipDefinitionId}`);
		}
		
		// 获取船体定义
		const hullDef = await this._configManager.loadHullDefinition(shipDef.hullId);
		if (!hullDef) {
			throw new Error(`Hull definition not found: ${shipDef.hullId}`);
		}
		
		// 构建 ShipConfig
		const config: ShipConfig = {
			id,
			initialPosition: position,
			initialHeading: heading,
			speed: hullDef.maxSpeed,
			maneuverability: hullDef.maxTurnRate,
			armor: this._buildArmorConfig(hullDef),
			flux: {
				capacity: hullDef.flux.capacity,
				dissipation: hullDef.flux.dissipation,
				initialSoftFlux: 0,
				initialHardFlux: 0,
			},
			shield: hullDef.shield && hullDef.shield.type !== 'NONE' ? {
				type: hullDef.shield.type as 'FRONT' | 'OMNI',
				radius: hullDef.shield.radius,
				centerOffset: hullDef.shield.centerOffset,
				coverageAngle: hullDef.shield.coverageAngle,
				efficiency: hullDef.shield.efficiency,
				maintenanceCost: hullDef.shield.maintenanceCost,
			} : undefined,
		};
		
		// 创建舰船实例
		const ship = new Ship(config);
		
		// 存储额外的元数据
		(ship as unknown as Record<string, unknown>)._shipDefinitionId = shipDefinitionId;
		(ship as unknown as Record<string, unknown>)._hullDefinitionId = shipDef.hullId;
		(ship as unknown as Record<string, unknown>)._ownerId = ownerId;
		(ship as unknown as Record<string, unknown>)._faction = faction || shipDef.faction || 'neutral';
		(ship as unknown as Record<string, unknown>)._controllingPlayerId = controllingPlayerId;
		(ship as unknown as Record<string, unknown>)._isEnemy = isEnemy ?? false;
		(ship as unknown as Record<string, unknown>)._weaponLoadout = shipDef.weaponLoadout;
		
		return ship;
	}
	
	/**
	 * 构建装甲配置
	 */
	private _buildArmorConfig(hullDef: HullDefinition): ShipConfig['armor'] {
		const quadrants: ShipConfig['armor'] = {};
		
		const quadrantMapping: Record<string, string> = {
			'FRONT_TOP': 'frontTop',
			'FRONT_BOTTOM': 'frontBottom',
			'LEFT_TOP': 'leftTop',
			'LEFT_BOTTOM': 'leftBottom',
			'RIGHT_TOP': 'rightTop',
			'RIGHT_BOTTOM': 'rightBottom',
		};
		
		for (const [key, value] of Object.entries(quadrantMapping)) {
			const armorValue = hullDef.armor.quadrants?.[key as keyof typeof hullDef.armor.quadrants] ?? hullDef.armor.maxValue;
			quadrants[value as keyof ShipConfig['armor']] = {
				maxValue: hullDef.armor.maxValue,
				initialValue: armorValue,
			};
		}
		
		return quadrants;
	}
	
	/**
	 * 获取舰船的武器挂载配置
	 */
	async getWeaponLoadout(shipId: string, shipDefinitionId: string): Promise<Map<string, WeaponDefinition>> {
		const shipDef = await this._configManager.loadShipDefinition(shipDefinitionId);
		if (!shipDef) {
			return new Map();
		}
		
		const loadout = new Map<string, WeaponDefinition>();
		
		for (const [slotId, weaponId] of Object.entries(shipDef.weaponLoadout)) {
			const weaponDef = await this._configManager.loadWeaponDefinition(weaponId);
			if (weaponDef) {
				loadout.set(slotId, weaponDef);
			}
		}
		
		return loadout;
	}
	
	/**
	 * 获取舰船实例的完整状态
	 */
	async getShipInstanceState(ship: Ship): Promise<ShipInstanceState> {
		const shipData = ship as unknown as Record<string, unknown>;
		const shipDefinitionId = shipData._shipDefinitionId as string;
		const hullDefinitionId = shipData._hullDefinitionId as string;
		
		const hullDef = hullDefinitionId ? await this._configManager.loadHullDefinition(hullDefinitionId) : null;
		
		// 构建装甲象限状态
		const armorQuadrants = {
			FRONT_TOP: 0,
			FRONT_BOTTOM: 0,
			LEFT_TOP: 0,
			LEFT_BOTTOM: 0,
			RIGHT_TOP: 0,
			RIGHT_BOTTOM: 0,
		} as Record<string, number>;
		
		for (const [type, quadrant] of ship.armorQuadrants) {
			armorQuadrants[type] = quadrant.value;
		}
		
		return {
			id: ship.id,
			shipDefinitionId,
			hullDefinitionId,
			position: ship.position,
			heading: ship.heading,
			ownerId: shipData._ownerId as string,
			faction: shipData._faction as string,
			controllingPlayerId: shipData._controllingPlayerId as string | undefined,
			isEnemy: shipData._isEnemy as boolean,
			hitPoints: 0, // TODO: 从船体计算
			maxHitPoints: hullDef?.hitPoints ?? 2000,
			armorQuadrants,
			maxArmorPerQuadrant: hullDef?.armor.maxValue ?? 200,
			flux: ship.flux.current,
			fluxCapacity: ship.flux.capacity,
			fluxDissipation: ship.flux.dissipation,
			softFlux: ship.flux.softFlux,
			hardFlux: ship.flux.hardFlux,
			fluxState: ship.status === 'OVERLOADED' ? 'overloaded' : ship.status === 'VENTING' ? 'venting' : 'normal',
			shieldActive: ship.shield?.isActive ?? false,
			shieldRadius: ship.shield?.radius ?? 0,
			shieldType: (ship.shield?.type as 'FRONT' | 'OMNI' | 'NONE') ?? 'NONE',
			weaponCooldowns: {},
			weaponAmmo: {},
			remainingActions: 3,
			actionsPerTurn: 3,
			remainingMovement: 100,
			maxMovement: 100,
			isVenting: ship.status === 'VENTING',
			isOverloaded: ship.status === 'OVERLOADED',
			overloadTurnsRemaining: 0,
		};
	}
}

// 工厂实例缓存
let _instance: ShipFactory | null = null;

/**
 * 获取舰船工厂实例
 */
export function getShipFactory(configManager: ConfigManager): ShipFactory {
	if (!_instance) {
		_instance = new ShipFactory({ configManager });
	}
	return _instance;
}

/**
 * 重置舰船工厂（用于测试）
 */
export function resetShipFactory(): void {
	_instance = null;
}