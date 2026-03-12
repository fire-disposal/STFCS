export { Ship } from './Ship';
export { ArmorQuadrant } from './ArmorQuadrant';
export { Shield } from './Shield';
export { FluxSystem } from './FluxSystem';
export { FluxState, FluxStateValues } from './FluxState';
export { ShipStatus, ShipStatusValues } from './ShipStatus';
export type {
  IShip,
  ShipConfig,
  ShipMovementPhase,
  MovementValidationResult,
  ArmorQuadrantConfig,
} from './types';
export type { IArmorQuadrant, ArmorQuadrantType } from './ArmorQuadrant';
export type { IShield, ShieldType, ShieldConfig } from './Shield';
export type { IFluxSystem, FluxSystemConfig } from './FluxSystem';
export type {
  IDomainEvent,
  ShipMovedEvent,
  ShieldToggledEvent,
  FluxOverloadedEvent,
  ShieldMaintenanceEvent,
  ShipEvent,
} from './events';
