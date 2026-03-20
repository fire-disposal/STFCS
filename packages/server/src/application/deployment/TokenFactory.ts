/**
 * Token 工厂
 *
 * 从舰船定义创建完整的 Token 实例
 * 包含武器、护甲、护盾、辐能等完整状态
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  ShipDefinition,
  HullDefinition,
  WeaponDefinition,
  DamageType,
  HullSize,
} from '@vt/shared/config';
import type { FactionId, ArmorQuadrant } from '@vt/shared/types';
import type {
  ShipTokenV2,
  WeaponInstanceState,
  WeaponMountInstance,
  ShipWeaponSystem,
  ArmorInstanceState,
  ShieldInstanceState,
  FluxInstanceState,
  HullInstanceState,
  ActionsState,
  MovementState,
  TokenVisualState,
} from '@vt/shared/types';
import {
  createDefaultMovementState,
  createDefaultArmorState,
  createDefaultShieldState,
  createDefaultFluxState,
  createDefaultHullState,
  createDefaultActionsState,
} from '@vt/shared/types';

// ==================== 类型定义 ====================

/** Token 工厂依赖 */
export interface TokenFactoryDeps {
  /** 获取舰船定义 */
  getShipDefinition(id: string): ShipDefinition | undefined;
  /** 获取船体定义 */
  getHullDefinition(id: string): HullDefinition | undefined;
  /** 获取武器定义 */
  getWeaponDefinition(id: string): WeaponDefinition | undefined;
}

/** 创建舰船 Token 参数 */
export interface CreateShipTokenParams {
  /** 舰船定义 ID */
  shipDefinitionId: string;
  /** 所有者 ID（玩家 ID） */
  ownerId: string;
  /** 阵营 */
  faction: FactionId;
  /** 初始位置 */
  position: { x: number; y: number };
  /** 初始朝向 */
  heading: number;
  /** 舰船名称（可选） */
  shipName?: string;
}

/** 创建敌方单位参数 */
export interface CreateEnemyUnitParams extends CreateShipTokenParams {
  /** 是否为敌方单位 */
  isEnemy?: boolean;
}

// ==================== Token 工厂类 ====================

export class TokenFactory {
  constructor(private readonly deps: TokenFactoryDeps) {}

  /**
   * 从舰船定义创建完整的 Token 实例
   */
  createShipToken(params: CreateShipTokenParams): ShipTokenV2 | null {
    const shipDef = this.deps.getShipDefinition(params.shipDefinitionId);
    if (!shipDef) {
      console.error(`Ship definition not found: ${params.shipDefinitionId}`);
      return null;
    }

    const hullDef = this.deps.getHullDefinition(shipDef.hullId);
    if (!hullDef) {
      console.error(`Hull definition not found: ${shipDef.hullId}`);
      return null;
    }

    const tokenId = `ship_${uuidv4()}`;

    // 构建武器系统
    const weapons = this._buildWeaponSystem(shipDef, hullDef);

    // 构建护甲状态
    const armor = this._buildArmorState(hullDef);

    // 构建护盾状态
    const shield = this._buildShieldState(hullDef);

    // 构建辐能状态
    const flux = this._buildFluxState(hullDef);

    // 构建船体状态
    const hull = this._buildHullState(hullDef);

    // 构建移动状态
    const movement = this._buildMovementState(hullDef);

    // 构建行动点状态
    const actions = this._buildActionsState(hullDef);

    // 构建视觉状态
    const visual = this._buildVisualState(hullDef);

    return {
      id: tokenId,
      ownerId: params.ownerId,
      type: 'ship',
      hullId: shipDef.hullId,
      shipId: params.shipDefinitionId,
      shipName: params.shipName ?? shipDef.name,
      hullSize: hullDef.size,
      position: params.position,
      heading: params.heading,
      size: hullDef.collisionRadius * 2,
      visual,
      faction: params.faction,
      isEnemy: false,
      turnState: 'waiting',
      currentRound: 0,
      metadata: {},
      hull,
      armor,
      shield,
      flux,
      movement,
      weapons,
      actions,
      isDestroyed: false,
      canAct: true,
      isDisabled: false,
      disabledTimeRemaining: 0,
    };
  }

  /**
   * 创建敌方单位
   */
  createEnemyUnit(params: CreateEnemyUnitParams): ShipTokenV2 | null {
    const token = this.createShipToken(params);
    if (token) {
      token.isEnemy = true;
    }
    return token;
  }

  // ==================== 私有方法 ====================

  /**
   * 构建武器系统
   */
  private _buildWeaponSystem(
    shipDef: ShipDefinition,
    hullDef: HullDefinition
  ): ShipWeaponSystem {
    const weapons: Record<string, WeaponInstanceState> = {};
    const mounts: Record<string, WeaponMountInstance> = {};

    for (const slot of hullDef.weaponSlots) {
      // 创建挂载点实例
      const mountInstance: WeaponMountInstance = {
        id: slot.id,
        mountType: slot.type,
        position: slot.position,
        facing: slot.facing,
        arcMin: slot.facing - slot.arc / 2,
        arcMax: slot.facing + slot.arc / 2,
        arc: slot.arc,
      };
      mounts[slot.id] = mountInstance;

      // 检查是否有武器装备
      const weaponId = shipDef.weaponLoadout[slot.id];
      if (!weaponId) continue;

      const weaponDef = this.deps.getWeaponDefinition(weaponId);
      if (!weaponDef) {
        console.warn(`Weapon definition not found: ${weaponId}`);
        continue;
      }

      // 创建武器实例
      const instanceId = `weapon_${uuidv4()}`;
      const weaponInstance: WeaponInstanceState = {
        instanceId,
        weaponId: weaponId,
        mountId: slot.id,
        name: weaponDef.name,
        category: weaponDef.category,
        damageType: weaponDef.damageType as DamageType,
        baseDamage: weaponDef.damage,
        empDamage: weaponDef.empDamage ?? 0,
        range: weaponDef.range,
        arc: slot.arc,
        turnRate: weaponDef.turnRate ?? 0,
        fluxCostPerShot: weaponDef.fluxCost,
        maxAmmo: weaponDef.ammo,
        ammoPerShot: weaponDef.ammoPerShot ?? 1,
        cooldown: weaponDef.cooldown,
        chargeTime: weaponDef.chargeTime ?? 0,
        burstSize: weaponDef.burstSize ?? 1,
        burstDelay: weaponDef.burstDelay ?? 0,
        state: 'ready',
        cooldownRemaining: 0,
        chargeProgress: 0,
        currentAmmo: weaponDef.ammo,
        currentFacing: slot.facing,
        isGuided: weaponDef.special?.guided ?? false,
        isHoming: weaponDef.special?.homing ?? false,
        isBeam: weaponDef.special?.beam ?? false,
        areaEffectRadius: weaponDef.special?.areaEffect ?? 0,
        hasFiredThisTurn: false,
        shotsFiredThisTurn: 0,
      };
      weapons[instanceId] = weaponInstance;
    }

    return {
      weapons,
      mounts,
      groups: [],
      activeGroupIndex: 0,
    };
  }

  /**
   * 构建护甲状态
   */
  private _buildArmorState(hullDef: HullDefinition): ArmorInstanceState {
    const maxPerQuadrant = hullDef.armor.maxValue;
    const quadrants = hullDef.armor.quadrants ?? {
      FRONT_TOP: maxPerQuadrant,
      FRONT_BOTTOM: maxPerQuadrant,
      LEFT_TOP: maxPerQuadrant * 0.75,
      LEFT_BOTTOM: maxPerQuadrant * 0.75,
      RIGHT_TOP: maxPerQuadrant * 0.75,
      RIGHT_BOTTOM: maxPerQuadrant * 0.75,
    };

    return {
      maxPerQuadrant,
      quadrants,
      baseArmorRating: maxPerQuadrant,
    };
  }

  /**
   * 构建护盾状态
   */
  private _buildShieldState(hullDef: HullDefinition): ShieldInstanceState {
    if (!hullDef.shield || hullDef.shield.type === 'NONE') {
      return {
        type: 'NONE',
        active: false,
        current: 0,
        max: 0,
        radius: 0,
        centerOffset: { x: 0, y: 0 },
        coverageAngle: 0,
        efficiency: 1,
        maintenanceCost: 0,
      };
    }

    const shieldConfig = hullDef.shield;
    const maxShieldHp = Math.floor(shieldConfig.radius * 10); // 简化计算

    return {
      type: shieldConfig.type,
      active: false,
      current: maxShieldHp,
      max: maxShieldHp,
      radius: shieldConfig.radius,
      centerOffset: shieldConfig.centerOffset,
      coverageAngle: shieldConfig.coverageAngle,
      efficiency: shieldConfig.efficiency,
      maintenanceCost: shieldConfig.maintenanceCost,
    };
  }

  /**
   * 构建辐能状态
   */
  private _buildFluxState(hullDef: HullDefinition): FluxInstanceState {
    return {
      current: 0,
      capacity: hullDef.flux.capacity,
      softFlux: 0,
      hardFlux: 0,
      dissipation: hullDef.flux.dissipation,
      ventRate: hullDef.flux.ventRate ?? hullDef.flux.dissipation * 2,
      state: 'normal',
      overloadTimeRemaining: 0,
      ventTimeRemaining: 0,
      overloadDuration: 0,
    };
  }

  /**
   * 构建船体状态
   */
  private _buildHullState(hullDef: HullDefinition): HullInstanceState {
    return {
      current: hullDef.hitPoints,
      max: hullDef.hitPoints,
      disabled: false,
      disabledTimeRemaining: 0,
    };
  }

  /**
   * 构建移动状态
   */
  private _buildMovementState(hullDef: HullDefinition): MovementState {
    return createDefaultMovementState(hullDef.maxSpeed, hullDef.maxTurnRate);
  }

  /**
   * 构建行动点状态
   */
  private _buildActionsState(hullDef: HullDefinition): ActionsState {
    // 根据舰船尺寸决定行动点数
    const actionsPerTurn = this._getActionsPerTurn(hullDef.size);
    return createDefaultActionsState(actionsPerTurn);
  }

  /**
   * 构建视觉状态
   */
  private _buildVisualState(hullDef: HullDefinition): TokenVisualState {
    return {
      scale: hullDef.spriteScale,
      layer: 0,
      collisionRadius: hullDef.collisionRadius,
      visible: true,
      highlighted: false,
    };
  }

  /**
   * 根据舰船尺寸获取行动点数
   */
  private _getActionsPerTurn(size: HullSize): number {
    switch (size) {
      case 'FIGHTER':
        return 2;
      case 'FRIGATE':
        return 3;
      case 'DESTROYER':
        return 3;
      case 'CRUISER':
        return 4;
      case 'CAPITAL':
        return 5;
      default:
        return 3;
    }
  }
}

// ==================== 工厂函数 ====================

/**
 * 创建 Token 工厂实例
 */
export function createTokenFactory(deps: TokenFactoryDeps): TokenFactory {
  return new TokenFactory(deps);
}