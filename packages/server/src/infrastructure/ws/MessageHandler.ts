import type {
  ChatMessagePayload,
  CombatEventMessage,
  DrawingAddMessage,
  DrawingClearMessage,
  DrawingElement,
  ErrorResponse,
  FluxStateMessage,
  OperationHandler,
  PlayerJoinedMessage,
  RequestHandlers,
  RequestMessage,
  RequestOperation,
  RequestPayload,
  ResponseMessage,
  ShipMovedMessage,
  ShieldUpdateMessage,
  SuccessResponse,
  WSMessage,
} from '@vt/shared/ws';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';
import type { PlayerService } from '../../application/player/PlayerService';
import type { ShipService } from '../../application/ship/ShipService';
import type { RoomManager } from './RoomManager';

interface WSSender {
  sendTo: (id: string, msg: WSMessage) => void;
}

export interface MessageHandlerOptions {
  roomManager: RoomManager;
  playerService: PlayerService;
  shipService: ShipService;
}

export class MessageHandler {
  private _roomManager: RoomManager;
  private _playerService: PlayerService;
  private _shipService: ShipService;
  private _roomDrawings: Map<string, DrawingElement[]>;
  private _requestHandlers: RequestHandlers;

  constructor(options: MessageHandlerOptions) {
    this._roomManager = options.roomManager;
    this._playerService = options.playerService;
    this._shipService = options.shipService;
    this._roomDrawings = new Map();
    this._requestHandlers = this._createRequestHandlers();
  }

  private _getWSServer(): WSSender | undefined {
    return (this._roomManager as unknown as { _wsServer?: WSSender })._wsServer;
  }

  private _createRequestHandlers(): RequestHandlers {
    return {
      'player.join': this._handlePlayerJoin.bind(this),
      'player.leave': this._handlePlayerLeave.bind(this),
      'player.list': this._handlePlayerList.bind(this),
      'ship.move': this._handleShipMove.bind(this),
      'ship.toggleShield': this._handleShipToggleShield.bind(this),
      'ship.vent': this._handleShipVent.bind(this),
      'ship.getStatus': this._handleShipGetStatus.bind(this),
    };
  }

  async handleMessage(clientId: string, message: WSMessage): Promise<void> {
    try {
      switch (message.type) {
        case WS_MESSAGE_TYPES.REQUEST:
          await this._handleRequestMessage(clientId, message);
          break;

        case WS_MESSAGE_TYPES.PLAYER_JOINED:
          await this._handlePlayerJoined(clientId, message);
          break;

        case WS_MESSAGE_TYPES.SHIP_MOVED:
          await this._handleShipMoved(clientId, message);
          break;

        case WS_MESSAGE_TYPES.SHIELD_UPDATE:
          await this._handleShieldUpdate(clientId, message);
          break;

        case WS_MESSAGE_TYPES.FLUX_STATE:
          await this._handleFluxState(clientId, message);
          break;

        case WS_MESSAGE_TYPES.COMBAT_EVENT:
          await this._handleCombatEvent(clientId, message);
          break;

        case WS_MESSAGE_TYPES.DRAWING_ADD:
          await this._handleDrawingAdd(clientId, message);
          break;

        case WS_MESSAGE_TYPES.DRAWING_CLEAR:
          await this._handleDrawingClear(clientId, message);
          break;

        case WS_MESSAGE_TYPES.CHAT_MESSAGE:
          await this._handleChatMessage(clientId, message);
          break;

        default:
          console.warn(`Unhandled WS message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      this._sendError(clientId, 'MESSAGE_ERROR', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async _handleRequestMessage(clientId: string, request: RequestMessage): Promise<void> {
    const { requestId, operation, data } = request.payload;

    const handler = this._requestHandlers[operation] as OperationHandler<typeof operation> | undefined;
    if (!handler) {
      const errorResponse: ErrorResponse = {
        success: false,
        operation,
        error: {
          code: 'INVALID_OPERATION',
          message: `No handler for operation: ${operation}`,
        },
        timestamp: Date.now(),
      };
      this._sendResponse(clientId, requestId, errorResponse);
      return;
    }

    try {
      const result = await handler(clientId, data);
      const successResponse: SuccessResponse<typeof operation> = {
        success: true,
        operation,
        data: result,
        timestamp: Date.now(),
      };
      this._sendResponse(clientId, requestId, successResponse);
    } catch (error) {
      const errorResponse: ErrorResponse = {
        success: false,
        operation,
        error: {
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: Date.now(),
      };
      this._sendResponse(clientId, requestId, errorResponse);
    }
  }

  private async _handlePlayerJoin(
    _clientId: string,
    data: Extract<RequestPayload, { operation: 'player.join' }>['data']
  ) {
    const playerInfo = {
      id: data.id,
      name: data.name,
      joinedAt: Date.now(),
    };

    const result = await this._playerService.join(playerInfo);
    if (!result.success || !result.player) {
      throw new Error(result.error ?? 'Failed to join');
    }

    return result.player;
  }

  private async _handlePlayerLeave(
    _clientId: string,
    data: Extract<RequestPayload, { operation: 'player.leave' }>['data']
  ) {
    const result = await this._playerService.leave(data.playerId, data.roomId);
    if (!result.success) {
      throw new Error(result.error ?? 'Failed to leave');
    }

    return undefined;
  }

  private async _handlePlayerList(
    _clientId: string,
    data: Extract<RequestPayload, { operation: 'player.list' }>['data']
  ) {
    return this._playerService.listPlayers(data.roomId);
  }

  private async _handleShipMove(
    clientId: string,
    data: Extract<RequestPayload, { operation: 'ship.move' }>['data']
  ) {
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      throw new Error('Player is not in a room');
    }

    const result = await this._shipService.moveShip(data.shipId, {
      shipId: data.shipId,
      phase: data.phase,
      type: data.type,
      distance: data.distance,
      angle: data.angle,
    });

    if (!result.success) {
      throw new Error(result.error ?? 'Movement failed');
    }

    const status = this._shipService.getShipStatus(data.shipId);

    this._roomManager.broadcastToRoom(
      playerRoom.id,
      {
        type: WS_MESSAGE_TYPES.SHIP_MOVED,
        payload: {
          shipId: data.shipId,
          phase: data.phase,
          type: data.type,
          distance: data.distance,
          angle: data.angle,
          newX: status?.position.x ?? 0,
          newY: status?.position.y ?? 0,
          newHeading: status?.heading ?? 0,
          timestamp: Date.now(),
        },
      },
      clientId
    );

    return status ?? null;
  }

  private async _handleShipToggleShield(
    clientId: string,
    data: Extract<RequestPayload, { operation: 'ship.toggleShield' }>['data']
  ) {
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      throw new Error('Player is not in a room');
    }

    const success = await this._shipService.toggleShield(data.shipId);
    if (!success) {
      throw new Error('Failed to toggle shield');
    }

    const status = this._shipService.getShipStatus(data.shipId);

    this._roomManager.broadcastToRoom(
      playerRoom.id,
      {
        type: WS_MESSAGE_TYPES.SHIELD_UPDATE,
        payload: {
          shipId: data.shipId,
          active: status?.shield?.active ?? false,
          type: status?.shield?.type ?? 'front',
          coverageAngle: status?.shield?.coverageAngle ?? 0,
        },
      },
      clientId
    );

    return status ?? null;
  }

  private async _handleShipVent(
    clientId: string,
    data: Extract<RequestPayload, { operation: 'ship.vent' }>['data']
  ) {
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      throw new Error('Player is not in a room');
    }

    const success = await this._shipService.ventShip(data.shipId);
    if (!success) {
      throw new Error('Failed to vent');
    }

    const status = this._shipService.getShipStatus(data.shipId);

    this._roomManager.broadcastToRoom(
      playerRoom.id,
      {
        type: WS_MESSAGE_TYPES.FLUX_STATE,
        payload: {
          shipId: data.shipId,
          fluxState: status?.fluxState ?? 'normal',
          currentFlux: status?.flux?.current ?? 0,
          softFlux: status?.flux?.softFlux ?? 0,
          hardFlux: status?.flux?.hardFlux ?? 0,
        },
      },
      clientId
    );

    return status ?? null;
  }

  private async _handleShipGetStatus(
    _clientId: string,
    data: Extract<RequestPayload, { operation: 'ship.getStatus' }>['data']
  ) {
    return this._shipService.getShipStatus(data.shipId) ?? null;
  }

  private async _handlePlayerJoined(clientId: string, message: PlayerJoinedMessage): Promise<void> {
    const payload = message.payload;
    await this._playerService.join(payload);

    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (playerRoom) {
      const drawings = this._roomDrawings.get(playerRoom.id) ?? [];
      if (drawings.length > 0) {
        this._sendDrawingsToPlayer(clientId, drawings);
      }
    }
  }

  private _sendDrawingsToPlayer(clientId: string, drawings: DrawingElement[]): void {
    if (drawings.length === 0) return;

    const wsServer = this._getWSServer();
    wsServer?.sendTo(clientId, {
      type: WS_MESSAGE_TYPES.DRAWING_SYNC,
      payload: {
        elements: drawings,
      },
    });
  }

  private async _handleShipMoved(clientId: string, message: ShipMovedMessage): Promise<void> {
    const payload = message.payload;
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    const result = await this._shipService.moveShip(payload.shipId, {
      shipId: payload.shipId,
      phase: payload.phase,
      type: payload.type,
      distance: payload.distance,
      angle: payload.angle,
    });

    if (result.success) {
      this._roomManager.broadcastToRoom(playerRoom.id, {
        type: WS_MESSAGE_TYPES.SHIP_MOVED,
        payload: {
          ...payload,
          timestamp: Date.now(),
        },
      });
    }
  }

  private async _handleShieldUpdate(clientId: string, message: ShieldUpdateMessage): Promise<void> {
    const payload = message.payload;
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    if (payload.active) {
      await this._shipService.enableShield(payload.shipId);
    } else {
      await this._shipService.disableShield(payload.shipId);
    }

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.SHIELD_UPDATE,
      payload,
    });
  }

  private async _handleFluxState(clientId: string, message: FluxStateMessage): Promise<void> {
    const payload = message.payload;
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      return;
    }

    if (payload.fluxState === 'venting') {
      await this._shipService.ventShip(payload.shipId);
    }

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.FLUX_STATE,
      payload,
    });
  }

  private async _handleCombatEvent(clientId: string, message: CombatEventMessage): Promise<void> {
    const payload = message.payload;
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.COMBAT_EVENT,
      payload: {
        ...payload,
        timestamp: Date.now(),
      },
    });
  }

  private async _handleDrawingAdd(clientId: string, message: DrawingAddMessage): Promise<void> {
    const payload = message.payload;
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    let drawings = this._roomDrawings.get(playerRoom.id);
    if (!drawings) {
      drawings = [];
      this._roomDrawings.set(playerRoom.id, drawings);
    }
    drawings.push(payload.element);

    this._roomManager.broadcastToRoom(
      playerRoom.id,
      {
        type: WS_MESSAGE_TYPES.DRAWING_ADD,
        payload: {
          playerId: clientId,
          element: payload.element,
        },
      },
      clientId
    );
  }

  private async _handleDrawingClear(clientId: string, message: DrawingClearMessage): Promise<void> {
    const payload = message.payload;
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    if (payload.playerId === clientId) {
      this._roomDrawings.set(playerRoom.id, []);
    }

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.DRAWING_CLEAR,
      payload: {
        playerId: clientId,
      },
    });
  }

  private async _handleChatMessage(clientId: string, message: ChatMessagePayload): Promise<void> {
    const payload = message.payload;
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    const player = this._playerService.getPlayer(clientId);

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.CHAT_MESSAGE,
      payload: {
        senderId: clientId,
        senderName: player?.name ?? 'Unknown',
        content: payload.content,
        timestamp: Date.now(),
      },
    });
  }

  private _sendError(clientId: string, code: string, message: string, details?: Record<string, unknown>): void {
    const wsServer = this._getWSServer();
    wsServer?.sendTo(clientId, {
      type: WS_MESSAGE_TYPES.ERROR,
      payload: { code, message, details },
    });
  }

  private _sendResponse(
    clientId: string,
    requestId: string,
    response: SuccessResponse<RequestOperation> | ErrorResponse
  ): void {
    const wsServer = this._getWSServer();
    if (!wsServer) return;

    const responseMessage: ResponseMessage = {
      type: WS_MESSAGE_TYPES.RESPONSE,
      payload: {
        requestId,
        ...response,
      },
    };

    wsServer.sendTo(clientId, responseMessage);
  }

  getRoomDrawings(roomId: string): DrawingElement[] {
    return this._roomDrawings.get(roomId) ?? [];
  }
}

export default MessageHandler;
