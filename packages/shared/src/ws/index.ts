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
  // Event messages (broadcast)
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

  // Request-Response messages
  REQUEST: 'REQUEST',
  RESPONSE: 'RESPONSE',

  // Connection/control messages
  PING: 'PING',
  PONG: 'PONG',
  ROOM_UPDATE: 'ROOM_UPDATE',
} as const;

export type WSMessageType = typeof WS_MESSAGE_TYPES[keyof typeof WS_MESSAGE_TYPES];

// Event message interfaces (keep existing for backward compatibility)
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

export interface PingMessage {
  type: typeof WS_MESSAGE_TYPES.PING;
  payload: {
    timestamp: number;
  };
}

export interface PongMessage {
  type: typeof WS_MESSAGE_TYPES.PONG;
  payload: {
    timestamp: number;
  };
}

export interface RoomPlayerSnapshot {
  id: string;
  name: string;
  isReady: boolean;
  currentShipId: string | null;
}

export interface RoomUpdateMessage {
  type: typeof WS_MESSAGE_TYPES.ROOM_UPDATE;
  payload: {
    roomId: string;
    players: RoomPlayerSnapshot[];
  };
}

// Operation-specific request payloads
export interface PlayerJoinRequestPayload {
  id: string;
  name: string;
  roomId?: string;
}

export interface PlayerLeaveRequestPayload {
  playerId: string;
  roomId: string;
}

export interface PlayerListRequestPayload {
  roomId: string;
}

export interface ShipMoveRequestPayload {
  shipId: string;
  phase: 1 | 2 | 3;
  type: 'straight' | 'strafe' | 'rotate';
  distance?: number;
  angle?: number;
}

export interface ShipToggleShieldRequestPayload {
  shipId: string;
}

export interface ShipVentRequestPayload {
  shipId: string;
}

export interface ShipGetStatusRequestPayload {
  shipId: string;
}

// Union type for all possible request payloads
export type RequestPayload =
  | { operation: 'player.join'; data: PlayerJoinRequestPayload }
  | { operation: 'player.leave'; data: PlayerLeaveRequestPayload }
  | { operation: 'player.list'; data: PlayerListRequestPayload }
  | { operation: 'ship.move'; data: ShipMoveRequestPayload }
  | { operation: 'ship.toggleShield'; data: ShipToggleShieldRequestPayload }
  | { operation: 'ship.vent'; data: ShipVentRequestPayload }
  | { operation: 'ship.getStatus'; data: ShipGetStatusRequestPayload };

// Operation-specific response payloads
export type PlayerJoinResponsePayload = PlayerInfo;
export type PlayerLeaveResponsePayload = void;
export type PlayerListResponsePayload = PlayerInfo[];
export type ShipMoveResponsePayload = ShipStatus | null;
export type ShipToggleShieldResponsePayload = ShipStatus | null;
export type ShipVentResponsePayload = ShipStatus | null;
export type ShipGetStatusResponsePayload = ShipStatus | null;

// Union type for all possible response payloads
export type ResponseData =
  | { operation: 'player.join'; data: PlayerJoinResponsePayload }
  | { operation: 'player.leave'; data: PlayerLeaveResponsePayload }
  | { operation: 'player.list'; data: PlayerListResponsePayload }
  | { operation: 'ship.move'; data: ShipMoveResponsePayload }
  | { operation: 'ship.toggleShield'; data: ShipToggleShieldResponsePayload }
  | { operation: 'ship.vent'; data: ShipVentResponsePayload }
  | { operation: 'ship.getStatus'; data: ShipGetStatusResponsePayload };

export type RequestOperation = RequestPayload['operation'];

export interface RequestMessage {
  type: typeof WS_MESSAGE_TYPES.REQUEST;
  payload: {
    requestId: string;
  } & RequestPayload;
}

export interface SuccessResponse<T extends RequestOperation = RequestOperation> {
  success: true;
  operation: T;
  data: Extract<ResponseData, { operation: T }>['data'];
  timestamp: number;
}

export interface ErrorResponse {
  success: false;
  operation: RequestOperation;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  timestamp: number;
}

export type ResponsePayload<T extends RequestOperation = RequestOperation> =
  | SuccessResponse<T>
  | ErrorResponse;

export interface ResponseMessage {
  type: typeof WS_MESSAGE_TYPES.RESPONSE;
  payload: {
    requestId: string;
  } & ResponsePayload;
}

// Utility type to extract response data type for an operation
export type ResponseForOperation<T extends RequestOperation> =
  Extract<ResponseData, { operation: T }>['data'];

// Generic handler type for request operations
export type OperationHandler<O extends RequestOperation> =
  (clientId: string, data: Extract<RequestPayload, { operation: O }>['data']) =>
    Promise<Extract<ResponseData, { operation: O }>['data']>;

// Utility type to create typed request handlers
export type RequestHandlers = {
  [O in RequestOperation]?: OperationHandler<O>;
};

// Union type for all possible WebSocket messages
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
  | ErrorMessage
  | PingMessage
  | PongMessage
  | RoomUpdateMessage
  | RequestMessage
  | ResponseMessage;

export type WSMessagePayloadMap = {
  [M in WSMessage as M['type']]: M['payload'];
};

export type WSMessageOf<T extends WSMessageType> = Extract<WSMessage, { type: T }>;

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
  on<T extends WSMessageType>(type: T, handler: (payload: WSMessagePayloadMap[T]) => void): void;
  off<T extends WSMessageType>(type: T, handler?: (payload: WSMessagePayloadMap[T]) => void): void;
  isConnected(): boolean;
}
