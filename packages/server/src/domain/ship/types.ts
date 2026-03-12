import { Point } from '../../types/geometry';
import { ArmorQuadrantType } from './ArmorQuadrant';
import { ShieldConfig } from './Shield';
import { FluxSystemConfig } from './FluxSystem';
import { ShipStatus } from './ShipStatus';

export interface IShip {
  readonly id: string;
  readonly position: Point;
  readonly heading: number;
  readonly speed: number;
  readonly maneuverability: number;
  readonly status: ShipStatus;
}

export type ShipMovementPhase = 1 | 2 | 3;

export interface MovementValidationResult {
  readonly isValid: boolean;
  readonly reason?: string;
}

export interface ArmorQuadrantConfig {
  maxValue: number;
  initialValue?: number;
}

export interface ShipConfig {
  id: string;
  initialPosition: Point;
  initialHeading: number;
  speed: number;
  maneuverability: number;
  armor: Partial<Record<ArmorQuadrantType, ArmorQuadrantConfig>>;
  flux: FluxSystemConfig;
  shield?: ShieldConfig;
}
