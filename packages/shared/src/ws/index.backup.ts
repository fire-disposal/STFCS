import type {
  PlayerInfo,
  ShipStatus,
  ShipMovement,
  ExplosionData,
  FluxOverloadState,
  MapConfig,
  TokenInfo,
  CameraState,
  CombatResult,
} from '../types';

export const WS_MESSAGE_TYPES = {
  PLAYER_JOINED: 'PLAYER_JOINED',
  PLAYER_LEFT: 'PLAYER_LEFT',
  SHIP_MOVED: 'SHIP_MOVED',
  SHIP_STATUS_UPDATE: 'SHIP_STATUS_UPDATE',
  EXPLOSION: 'EXPLOSION',
  SHIELD_UPDATE: 'SHIELD_UPDATE',
  FLUX_STATE: 'FLUX_STATE',
  COMBAT_EVENT: 'COMBAT_EVENT',
  MAP_INITIALIZED: 'MAP_INITIALIZED',
  TOKEN_PLACED: 'TOKEN_PLACED',
  TOKEN_MOVED: 'TOKEN_MOVED',
  CAMERA_UPDATED: 'CAMERA_UPDATED',
  WEAPON_FIRED: 'WEAPON_FIRED',
  DAMAGE_DEALT: 'DAMAGE_DEALT',
  DRAWING_ADD: 'DRAWING_ADD',
  DRAWING_CLEAR: 'DRAWING_CLEAR',
  DRAWING_SYNC: 'DRAWING_SYNC',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  ERROR: 'ERROR',
} as const;

export type WSMessageType = typeof WS_MESSAGE_TYPES[keyof typeof WS_MESSAGE_TYPES];

export interface PlayerJoinedMessage {
  type: typeof WS_MESSAGE_TYPES.PLAYER_JOINED;
  payload: PlayerInfo;
}

export interface PlayerLeftMessage {
  type: typeof WS_MESSAGE_TYPES.PLAYER_LEFT;
  payload: { playerId: string; reason?: string };
}

export interface ShipMovedMessage {
  type: typeof WS_MESSAGE_TYPES.SHIP_MOVED;
  payload: ShipMovement;
}

export interface ShipStatusUpdateMessage {
  type: typeof WS_MESSAGE_TYPES.SHIP_STATUS_UPDATE;
  payload: ShipStatus;
}

export interface ExplosionMessage {
  type: typeof WS_MESSAGE_TYPES.EXPLOSION;
  payload: ExplosionData;
}

export interface ShieldUpdateMessage {
  type: typeof WS_MESSAGE_TYPES.SHIELD_UPDATE;
  payload: {
    shipId: string;
    active: boolean;
    type: 'front' | 'full';
    coverageAngle: number;
  };
}

export interface FluxStateMessage {
  type: typeof WS_MESSAGE_TYPES.FLUX_STATE;
  payload: {
    shipId: string;
    fluxState: FluxOverloadState;
    currentFlux: number;
    softFlux: number;
    hardFlux: number;
  };
}

export interface CombatEventMessage {
  type: typeof WS_MESSAGE_TYPES.COMBAT_EVENT;
  payload: {
    sourceShipId: string;
    targetShipId: string;
    weaponId: string;
    hit: boolean;
    damage?: number;
    hitQuadrant?: string;
    timestamp: number;
  };
}

export interface ErrorMessage {
  type: typeof WS_MESSAGE_TYPES.ERROR;
  payload: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface MapInitializedMessage {
  type: typeof WS_MESSAGE_TYPES.MAP_INITIALIZED;
  payload: MapConfig & { tokens: TokenInfo[] };
}

export interface TokenPlacedMessage {
  type: typeof WS_MESSAGE_TYPES.TOKEN_PLACED;
  payload: TokenInfo;
}

export interface TokenMovedMessage {
  type: typeof WS_MESSAGE_TYPES.TOKEN_MOVED;
  payload: {
    tokenId: string;
    previousPosition: { x: number; y: number };
    newPosition: { x: number; y: number };
    previousHeading: number;
    newHeading: number;
    timestamp: number;
  };
}

export interface CameraUpdatedMessage {
  type: typeof WS_MESSAGE_TYPES.CAMERA_UPDATED;
  payload: CameraState;
}

export interface WeaponFiredMessage {
  type: typeof WS_MESSAGE_TYPES.WEAPON_FIRED;
  payload: {
    sourceShipId: string;
    targetShipId: string;
    weaponId: string;
    mountId: string;
    timestamp: number;
  };
}

export interface DamageDealtMessage {
  type: typeof WS_MESSAGE_TYPES.DAMAGE_DEALT;
  payload: CombatResult;
}

export interface DrawingElement {
  type: 'path' | 'line' | 'arrow' | 'rect' | 'circle';
  color: string;
  lineWidth: number;
  path?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  cx?: number;
  cy?: number;
  radius?: number;
}

export interface DrawingAddMessage {
  type: typeof WS_MESSAGE_TYPES.DRAWING_ADD;
  payload: {
    playerId: string;
    element: DrawingElement;
  };
}

export interface DrawingClearMessage {
  type: typeof WS_MESSAGE_TYPES.DRAWING_CLEAR;
  payload: {
    playerId: string;
  };
}

export interface DrawingSyncMessage {
  type: typeof WS_MESSAGE_TYPES.DRAWING_SYNC;
  payload: {
    elements: DrawingElement[];
  };
}

export interface ChatMessagePayload {
  type: typeof WS_MESSAGE_TYPES.CHAT_MESSAGE;
  payload: {
    senderId: string;
    senderName: string;
    content: string;
    timestamp: number;
  };
}

export type WSMessage =
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | ShipMovedMessage
  | ShipStatusUpdateMessage
  | ExplosionMessage
  | ShieldUpdateMessage
  | FluxStateMessage
  | CombatEventMessage
  | MapInitializedMessage
  | TokenPlacedMessage
  | TokenMovedMessage
  | CameraUpdatedMessage
  | WeaponFiredMessage
  | DamageDealtMessage
  | DrawingAddMessage
  | DrawingClearMessage
  | DrawingSyncMessage
  | ChatMessagePayload
  | ErrorMessage;

export interface IWSServer {
  broadcast(message: WSMessage, excludeClientId?: string): void;
  sendTo(clientId: string, message: WSMessage): void;
  getConnectedClients(): Set<string>;
  close(): void;
}

export interface IWSClient {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: WSMessage): void;
  on(type: WSMessageType, handler: (payload: unknown) => void): void;
  off(type: WSMessageType, handler?: (payload: unknown) => void): void;
  isConnected(): boolean;
}
