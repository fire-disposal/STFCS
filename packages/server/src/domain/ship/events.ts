export interface IDomainEvent {
  readonly type: string;
  readonly timestamp: number;
}

export interface ShipMovedEvent extends IDomainEvent {
  readonly type: 'SHIP_MOVED';
  readonly shipId: string;
  readonly previousPosition: { x: number; y: number };
  readonly newPosition: { x: number; y: number };
  readonly previousHeading: number;
  readonly newHeading: number;
  readonly phase: 1 | 2 | 3;
}

export interface ShieldToggledEvent extends IDomainEvent {
  readonly type: 'SHIELD_TOGGLED';
  readonly shipId: string;
  readonly isActive: boolean;
}

export interface FluxOverloadedEvent extends IDomainEvent {
  readonly type: 'FLUX_OVERLOADED';
  readonly shipId: string;
  readonly fluxLevel: number;
  readonly capacity: number;
}

export interface ShieldMaintenanceEvent extends IDomainEvent {
  readonly type: 'SHIELD_MAINTENANCE';
  readonly shipId: string;
  readonly fluxCost: number;
}

export type ShipEvent = 
  | ShipMovedEvent 
  | ShieldToggledEvent 
  | FluxOverloadedEvent
  | ShieldMaintenanceEvent;
