export type WeaponType = 'ballistic' | 'energy' | 'missile';

export interface WeaponConfig {
  id: string;
  name: string;
  type: WeaponType;
  damage: number;
  range: number;
  arc: number;
  cooldown: number;
  fluxCost: number;
}

export interface IWeapon {
  readonly id: string;
  readonly name: string;
  readonly type: WeaponType;
  readonly damage: number;
  readonly range: number;
  readonly arc: number;
  readonly cooldown: number;
  readonly fluxCost: number;
}

export class Weapon implements IWeapon {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _type: WeaponType;
  private readonly _damage: number;
  private readonly _range: number;
  private readonly _arc: number;
  private readonly _cooldown: number;
  private readonly _fluxCost: number;

  constructor(config: WeaponConfig) {
    if (config.damage < 0) {
      throw new Error('Weapon damage cannot be negative');
    }
    if (config.range <= 0) {
      throw new Error('Weapon range must be positive');
    }
    if (config.arc < 0 || config.arc > 360) {
      throw new Error('Weapon arc must be between 0 and 360 degrees');
    }
    if (config.cooldown < 0) {
      throw new Error('Weapon cooldown cannot be negative');
    }
    if (config.fluxCost < 0) {
      throw new Error('Weapon flux cost cannot be negative');
    }

    this._id = config.id;
    this._name = config.name;
    this._type = config.type;
    this._damage = config.damage;
    this._range = config.range;
    this._arc = config.arc;
    this._cooldown = config.cooldown;
    this._fluxCost = config.fluxCost;
  }

  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get type(): WeaponType {
    return this._type;
  }

  get damage(): number {
    return this._damage;
  }

  get range(): number {
    return this._range;
  }

  get arc(): number {
    return this._arc;
  }

  get cooldown(): number {
    return this._cooldown;
  }

  get fluxCost(): number {
    return this._fluxCost;
  }

  isWithinRange(distance: number): boolean {
    return distance <= this._range && distance > 0;
  }

  isTargetInArc(facingAngle: number, targetAngle: number): boolean {
    const normalizedFacing = ((facingAngle % 360) + 360) % 360;
    const normalizedTarget = ((targetAngle % 360) + 360) % 360;
    
    let angleDiff = Math.abs(normalizedTarget - normalizedFacing);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    return angleDiff <= this._arc / 2;
  }

  canEngage(distance: number, facingAngle: number, targetAngle: number): boolean {
    return this.isWithinRange(distance) && this.isTargetInArc(facingAngle, targetAngle);
  }

  toDTO(): WeaponConfig {
    return {
      id: this._id,
      name: this._name,
      type: this._type,
      damage: this._damage,
      range: this._range,
      arc: this._arc,
      cooldown: this._cooldown,
      fluxCost: this._fluxCost,
    };
  }
}
