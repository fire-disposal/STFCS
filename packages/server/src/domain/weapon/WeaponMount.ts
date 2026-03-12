import { Point } from '../../types/geometry';
import { Weapon } from './Weapon';

export type WeaponMountType = 'fixed' | 'turret';

export interface WeaponMountConfig {
  id: string;
  weapon: Weapon;
  mountType: WeaponMountType;
  position: Point;
  facing: number;
  arcOffset?: number;
}

export interface IWeaponMount {
  readonly id: string;
  readonly weapon: Weapon;
  readonly mountType: WeaponMountType;
  readonly position: Point;
  readonly facing: number;
  readonly arcMin: number;
  readonly arcMax: number;
}

export class WeaponMountEntity implements IWeaponMount {
  private readonly _id: string;
  private readonly _weapon: Weapon;
  private readonly _mountType: WeaponMountType;
  private readonly _position: Point;
  private _facing: number;
  private readonly _arcMin: number;
  private readonly _arcMax: number;

  constructor(config: WeaponMountConfig) {
    const arcOffset = config.arcOffset ?? 0;

    if (config.mountType === 'fixed' && arcOffset === 0) {
      const halfArc = config.weapon.arc / 2;
      this._arcMin = -halfArc;
      this._arcMax = halfArc;
    } else {
      this._arcMin = -arcOffset;
      this._arcMax = arcOffset;
    }

    this._id = config.id;
    this._weapon = config.weapon;
    this._mountType = config.mountType;
    this._position = { ...config.position };
    this._facing = ((config.facing % 360) + 360) % 360;
  }

  get id(): string {
    return this._id;
  }

  get weapon(): Weapon {
    return this._weapon;
  }

  get mountType(): WeaponMountType {
    return this._mountType;
  }

  get position(): Point {
    return { ...this._position };
  }

  get facing(): number {
    return this._facing;
  }

  get arcMin(): number {
    return this._arcMin;
  }

  get arcMax(): number {
    return this._arcMax;
  }

  get totalArc(): number {
    return this._arcMax - this._arcMin;
  }

  rotate(delta: number): void {
    if (this._mountType === 'turret') {
      this._facing = ((this._facing + delta) % 360 + 360) % 360;
    }
  }

  setFacing(facing: number): void {
    if (this._mountType === 'turret') {
      this._facing = ((facing % 360) + 360) % 360;
    }
  }

  isTargetInArc(targetPosition: Point, shipPosition: Point): boolean {
    const dx = targetPosition.x - shipPosition.x;
    const dy = targetPosition.y - shipPosition.y;
    const targetAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 90) % 360;
    const normalizedTarget = ((targetAngle + 360) % 360);
    
    let angleDiff = Math.abs(normalizedTarget - this._facing);
    if (angleDiff > 180) {
      angleDiff = 360 - angleDiff;
    }

    return angleDiff <= this.totalArc / 2;
  }

  canEngageTarget(targetPosition: Point, shipPosition: Point, distance: number): boolean {
    return this._weapon.isWithinRange(distance) && this.isTargetInArc(targetPosition, shipPosition);
  }

  toDTO(): {
    id: string;
    weaponId: string;
    mountType: WeaponMountType;
    position: Point;
    facing: number;
    arcMin: number;
    arcMax: number;
  } {
    return {
      id: this._id,
      weaponId: this._weapon.id,
      mountType: this._mountType,
      position: this._position,
      facing: this._facing,
      arcMin: this._arcMin,
      arcMax: this._arcMax,
    };
  }
}
