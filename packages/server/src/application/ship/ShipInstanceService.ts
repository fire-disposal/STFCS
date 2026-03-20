/**
 * 舰船实例化服务
 *
 * 负责从舰船定义创建实际的 Ship 实例
 * 管理 Token 与 Ship 的关联
 */

import { Ship } from '../../domain/ship/Ship';
import type { ShipConfig, ShipArmorQuadrantType } from '../../domain/ship/types';
import type { ShipService, CreateShipCommand } from './ShipService';
import type {
	ShipDefinition,
	HullDefinition,
	WeaponDefinition,
	ShipInstanceState,
} from '@vt/shared/config';
import type { TokenInfo, FactionId, UnitTurnState } from '@vt/shared/types';
import type { RoomManager } from '../../infrastructure/ws/RoomManager';

export interface CreateShipInstanceParams {
	id: string;
	shipDefinitionId: string;
	position: { x: number; y: number };
	heading: number;
	ownerId: string;
	faction?: FactionId;
	controllingPlayerId?: string;
	isEnemy?: boolean;
}

export interface ShipInstanceResult {
	ship: Ship;
	token: TokenInfo;
	instanceState: ShipInstanceState;
}

/**
 * 舰船实例化服务
 */
export class ShipInstanceService {
	private _shipService: ShipService;
	private _roomManager: RoomManager | null = null;

	// 舰船定义缓存
	private _shipDefinitions: Map<string, ShipDefinition> = new Map();
	private _hullDefinitions: Map<string, HullDefinition> = new Map();
	private _weaponDefinitions: Map<string, WeaponDefinition> = new Map();

	// 实例状态缓存
	private _instanceStates: Map<string, ShipInstanceState> = new Map();

	constructor(shipService: ShipService) {
		this._shipService = shipService;
	}

	setRoomManager(roomManager: RoomManager): void {
		this._roomManager = roomManager;
	}

	// ==================== 定义注册 ====================

	/**
	 * 注册舰船定义
	 */
	registerShipDefinition(definition: ShipDefinition): void {
		this._shipDefinitions.set(definition.id, definition);
	}

	/**
	 * 注册船体定义
	 */
	registerHullDefinition(definition: HullDefinition): void {
		this._hullDefinitions.set(definition.id, definition);
	}

	/**
	 * 注册武器定义
	 */
	registerWeaponDefinition(definition: WeaponDefinition): void {
		this._weaponDefinitions.set(definition.id, definition);
	}

	/**
	 * 批量注册定义
	 */
	registerDefinitions(params: {
		ships?: Record<string, ShipDefinition>;
		hulls?: Record<string, HullDefinition>;
		weapons?: Record<string, WeaponDefinition>;
	}): void {
		if (params.ships) {
			for (const [id, def] of Object.entries(params.ships)) {
				this._shipDefinitions.set(id, def);
			}
		}
		if (params.hulls) {
			for (const [id, def] of Object.entries(params.hulls)) {
				this._hullDefinitions.set(id, def);
			}
		}
		if (params.weapons) {
			for (const [id, def] of Object.entries(params.weapons)) {
				this._weaponDefinitions.set(id, def);
			}
		}
	}

	// ==================== 实例创建 ====================

	/**
	 * 从舰船定义创建实例
	 */
	async createInstance(params: CreateShipInstanceParams): Promise<ShipInstanceResult> {
		const shipDef = this._shipDefinitions.get(params.shipDefinitionId);
		if (!shipDef) {
			throw new Error(`Ship definition not found: ${params.shipDefinitionId}`);
		}

		const hullDef = this._hullDefinitions.get(shipDef.hullId);
		if (!hullDef) {
			throw new Error(`Hull definition not found: ${shipDef.hullId}`);
		}

		// 构建 ShipConfig
		const quadrants = hullDef.armor.quadrants ?? {
			FRONT_TOP: hullDef.armor.maxValue,
			FRONT_BOTTOM: hullDef.armor.maxValue,
			LEFT_TOP: hullDef.armor.maxValue,
			LEFT_BOTTOM: hullDef.armor.maxValue,
			RIGHT_TOP: hullDef.armor.maxValue,
			RIGHT_BOTTOM: hullDef.armor.maxValue,
		};

		const armorQuadrants: Record<ShipArmorQuadrantType, { maxValue: number; initialValue?: number }> = {
			FRONT_TOP: { maxValue: quadrants.FRONT_TOP },
			FRONT_BOTTOM: { maxValue: quadrants.FRONT_BOTTOM },
			LEFT_TOP: { maxValue: quadrants.LEFT_TOP },
			LEFT_BOTTOM: { maxValue: quadrants.LEFT_BOTTOM },
			RIGHT_TOP: { maxValue: quadrants.RIGHT_TOP },
			RIGHT_BOTTOM: { maxValue: quadrants.RIGHT_BOTTOM },
		};

		const shipConfig: CreateShipCommand = {
			id: params.id,
			initialPosition: params.position,
			initialHeading: params.heading,
			speed: Math.floor(hullDef.maxSpeed / 60), // 转换为每回合移动单位
			maneuverability: hullDef.maxTurnRate,
			armor: armorQuadrants,
			flux: {
				capacity: hullDef.flux.capacity,
				dissipation: hullDef.flux.dissipation,
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

		// 创建 Ship 实例
		const ship = this._shipService.createShip(shipConfig);

		// 创建 Token 信息
		const token: TokenInfo = {
			id: params.id,
			ownerId: params.ownerId,
			position: params.position,
			heading: params.heading,
			type: 'ship',
			size: hullDef.collisionRadius * 2,
			scale: hullDef.spriteScale ?? 1,
			turnState: 'waiting' as UnitTurnState,
			maxMovement: shipConfig.speed,
			remainingMovement: shipConfig.speed,
			actionsPerTurn: 3,
			remainingActions: 3,
			layer: 1,
			collisionRadius: hullDef.collisionRadius,
			metadata: {
				shipDefinitionId: params.shipDefinitionId,
				hullId: shipDef.hullId,
				name: shipDef.name,
				nameLocalized: shipDef.nameLocalized,
			},
			faction: params.faction,
			controllingPlayerId: params.controllingPlayerId ?? params.ownerId,
			isEnemy: params.isEnemy ?? false,
		};

		// 创建实例状态
		const instanceState: ShipInstanceState = {
			id: params.id,
			shipDefinitionId: params.shipDefinitionId,
			hullDefinitionId: shipDef.hullId,
			position: params.position,
			heading: params.heading,
			ownerId: params.ownerId,
			faction: params.faction ?? 'player',
			controllingPlayerId: params.controllingPlayerId,
			isEnemy: params.isEnemy ?? false,
			hitPoints: hullDef.hitPoints,
			maxHitPoints: hullDef.hitPoints,
			armorQuadrants: quadrants,
			maxArmorPerQuadrant: hullDef.armor.maxValue,
			flux: 0,
			fluxCapacity: hullDef.flux.capacity,
			fluxDissipation: hullDef.flux.dissipation,
			softFlux: 0,
			hardFlux: 0,
			fluxState: 'normal',
			shieldActive: false,
			shieldRadius: hullDef.shield?.radius ?? 0,
			shieldType: hullDef.shield?.type ?? 'FRONT',
			weaponCooldowns: {},
			weaponAmmo: {},
			remainingActions: 3,
			actionsPerTurn: 3,
			remainingMovement: shipConfig.speed,
			maxMovement: shipConfig.speed,
			isVenting: false,
			isOverloaded: false,
			overloadTurnsRemaining: 0,
		};

		// 初始化武器状态
		for (const [slotId, weaponId] of Object.entries(shipDef.weaponLoadout)) {
			const weaponDef = this._weaponDefinitions.get(weaponId);
			if (weaponDef) {
				instanceState.weaponCooldowns[slotId] = 0;
				instanceState.weaponAmmo[slotId] = weaponDef.ammo ?? Infinity;
			}
		}

		// 缓存实例状态
		this._instanceStates.set(params.id, instanceState);

		return { ship, token, instanceState };
	}

	/**
	 * 获取实例状态
	 */
	getInstanceState(shipId: string): ShipInstanceState | undefined {
		return this._instanceStates.get(shipId);
	}

	/**
	 * 更新实例状态
	 */
	updateInstanceState(shipId: string, updates: Partial<ShipInstanceState>): void {
		const state = this._instanceStates.get(shipId);
		if (state) {
			Object.assign(state, updates);
		}
	}

	/**
	 * 获取舰船定义
	 */
	getShipDefinition(id: string): ShipDefinition | undefined {
		return this._shipDefinitions.get(id);
	}

	/**
	 * 获取船体定义
	 */
	getHullDefinition(id: string): HullDefinition | undefined {
		return this._hullDefinitions.get(id);
	}

	/**
	 * 获取武器定义
	 */
	getWeaponDefinition(id: string): WeaponDefinition | undefined {
		return this._weaponDefinitions.get(id);
	}

	/**
	 * 获取所有舰船定义
	 */
	getAllShipDefinitions(): ShipDefinition[] {
		return Array.from(this._shipDefinitions.values());
	}

	/**
	 * 删除实例
	 */
	deleteInstance(shipId: string): boolean {
		return this._instanceStates.delete(shipId);
	}

	/**
	 * 清除所有实例
	 */
	clearInstances(): void {
		this._instanceStates.clear();
	}
}

export default ShipInstanceService;