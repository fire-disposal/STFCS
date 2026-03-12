import { Point } from '../../types/geometry';

export interface IDomainEvent {
  readonly type: string;
  readonly timestamp: number;
}

export interface TokenPlacedEvent extends IDomainEvent {
  readonly type: 'TOKEN_PLACED';
  readonly tokenId: string;
  readonly ownerId: string;
  readonly position: Point;
  readonly heading: number;
  readonly tokenType: 'ship' | 'station' | 'asteroid';
}

export interface TokenMovedEvent extends IDomainEvent {
  readonly type: 'TOKEN_MOVED';
  readonly tokenId: string;
  readonly previousPosition: Point;
  readonly newPosition: Point;
  readonly previousHeading: number;
  readonly newHeading: number;
}

export interface TokenRemovedEvent extends IDomainEvent {
  readonly type: 'TOKEN_REMOVED';
  readonly tokenId: string;
  readonly reason: string;
}

export interface CameraUpdatedEvent extends IDomainEvent {
  readonly type: 'CAMERA_UPDATED';
  readonly centerX: number;
  readonly centerY: number;
  readonly zoom: number;
  readonly rotation: number;
}

export interface MapInitializedEvent extends IDomainEvent {
  readonly type: 'MAP_INITIALIZED';
  readonly mapId: string;
  readonly width: number;
  readonly height: number;
}

export type MapEvent =
  | TokenPlacedEvent
  | TokenMovedEvent
  | TokenRemovedEvent
  | CameraUpdatedEvent
  | MapInitializedEvent;
