import { Point } from '../../types/geometry';

export interface IDomainEvent {
  readonly type: string;
  readonly timestamp: number;
}

export interface WeaponFiredEvent extends IDomainEvent {
  readonly type: 'WEAPON_FIRED';
  readonly weaponId: string;
  readonly mountId: string;
  readonly sourceShipId: string;
  readonly targetShipId: string;
  readonly weaponType: 'ballistic' | 'energy' | 'missile';
}

export interface DamageDealtEvent extends IDomainEvent {
  readonly type: 'DAMAGE_DEALT';
  readonly sourceShipId: string;
  readonly targetShipId: string;
  readonly weaponId: string;
  readonly damage: number;
  readonly shieldAbsorbed: number;
  readonly armorReduced: number;
  readonly hullDamage: number;
  readonly hitQuadrant?: string;
}

export interface ArmorHitEvent extends IDomainEvent {
  readonly type: 'ARMOR_HIT';
  readonly shipId: string;
  readonly quadrant: string;
  readonly damage: number;
  readonly remainingArmor: number;
}

export type CombatEvent =
  | WeaponFiredEvent
  | DamageDealtEvent
  | ArmorHitEvent;
