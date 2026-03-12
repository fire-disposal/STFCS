import { Point } from '../../types/geometry';

export type ShieldType = 'FRONT' | 'OMNI';

export interface IShield {
  readonly type: ShieldType;
  readonly radius: number;
  readonly centerOffset: Point;
  readonly coverageAngle: number;
  readonly efficiency: number;
  readonly maintenanceCost: number;
  readonly isActive: boolean;
}

export interface ShieldConfig {
  type: ShieldType;
  radius: number;
  centerOffset: Point;
  coverageAngle: number;
  efficiency: number;
  maintenanceCost: number;
}

export class Shield implements IShield {
  private readonly _type: ShieldType;
  private readonly _radius: number;
  private readonly _centerOffset: Point;
  private readonly _coverageAngle: number;
  private readonly _efficiency: number;
  private readonly _maintenanceCost: number;
  private _isActive: boolean;

  constructor(config: ShieldConfig, initialActive?: boolean) {
    if (config.radius <= 0) {
      throw new Error('Shield radius must be positive');
    }
    if (config.efficiency <= 0 || config.efficiency > 1) {
      throw new Error('Shield efficiency must be between 0 and 1');
    }
    if (config.coverageAngle <= 0 || config.coverageAngle > 360) {
      throw new Error('Shield coverage angle must be between 0 and 360');
    }
    if (config.maintenanceCost < 0) {
      throw new Error('Shield maintenance cost cannot be negative');
    }

    this._type = config.type;
    this._radius = config.radius;
    this._centerOffset = { ...config.centerOffset };
    this._coverageAngle = config.coverageAngle;
    this._efficiency = config.efficiency;
    this._maintenanceCost = config.maintenanceCost;
    this._isActive = initialActive ?? false;
  }

  get type(): ShieldType {
    return this._type;
  }

  get radius(): number {
    return this._radius;
  }

  get centerOffset(): Point {
    return { ...this._centerOffset };
  }

  get coverageAngle(): number {
    return this._coverageAngle;
  }

  get efficiency(): number {
    return this._efficiency;
  }

  get maintenanceCost(): number {
    return this._maintenanceCost;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  activate(): void {
    this._isActive = true;
  }

  deactivate(): void {
    this._isActive = false;
  }

  toggle(): void {
    this._isActive = !this._isActive;
  }

  calculateFluxCost(damageAbsorbed: number): number {
    return damageAbsorbed * this._efficiency;
  }

  coversAngle(angle: number): boolean {
    const normalizedAngle = ((angle % 360) + 360) % 360;
    const halfCoverage = this._coverageAngle / 2;
    return normalizedAngle >= (90 - halfCoverage) && normalizedAngle <= (90 + halfCoverage);
  }

  copy(): Shield {
    return new Shield({
      type: this._type,
      radius: this._radius,
      centerOffset: this._centerOffset,
      coverageAngle: this._coverageAngle,
      efficiency: this._efficiency,
      maintenanceCost: this._maintenanceCost,
    }, this._isActive);
  }
}
