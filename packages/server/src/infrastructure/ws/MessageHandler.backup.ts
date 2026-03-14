import type { WSMessage, DrawingElement } from '@vt/shared/ws';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';
import type { RoomManager } from './RoomManager';
import type { PlayerService } from '../../application/player/PlayerService';
import type { ShipService } from '../../application/ship/ShipService';

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

  constructor(options: MessageHandlerOptions) {
    this._roomManager = options.roomManager;
    this._playerService = options.playerService;
    this._shipService = options.shipService;
    this._roomDrawings = new Map();
  }

  async handleMessage(clientId: string, message: WSMessage): Promise<void> {
    try {
      switch (message.type) {
        case WS_MESSAGE_TYPES.PLAYER_JOINED:
          await this._handlePlayerJoined(clientId, message.payload as any);
          break;

        case WS_MESSAGE_TYPES.SHIP_MOVED:
          await this._handleShipMoved(clientId, message.payload as any);
          break;

        case WS_MESSAGE_TYPES.SHIELD_UPDATE:
          await this._handleShieldUpdate(clientId, message.payload as any);
          break;

        case WS_MESSAGE_TYPES.FLUX_STATE:
          await this._handleFluxState(clientId, message.payload as any);
          break;

        case WS_MESSAGE_TYPES.COMBAT_EVENT:
          await this._handleCombatEvent(clientId, message.payload as any);
          break;

        case WS_MESSAGE_TYPES.DRAWING_ADD:
          await this._handleDrawingAdd(clientId, message.payload as any);
          break;

        case WS_MESSAGE_TYPES.DRAWING_CLEAR:
          await this._handleDrawingClear(clientId, message.payload as any);
          break;

        case WS_MESSAGE_TYPES.CHAT_MESSAGE:
          await this._handleChatMessage(clientId, message.payload as any);
          break;

        default:
          console.warn(`Unhandled WS message type: ${(message as { type: string }).type}`);
      }
    } catch (error) {
      console.error(`Error handling message from ${clientId}:`, error);
      this._sendError(clientId, 'MESSAGE_ERROR', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private async _handlePlayerJoined(clientId: string, payload: { id: string; name: string; joinedAt: number; roomId?: string }): Promise<void> {
    const playerInfo = {
      id: payload.id,
      name: payload.name,
      joinedAt: payload.joinedAt,
    };

    await this._playerService.join(playerInfo);

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
    
    const roomManager = this._roomManager;
    const wsServer = (roomManager as unknown as { _wsServer?: { sendTo: (id: string, msg: WSMessage) => void } })._wsServer;
    if (wsServer) {
      wsServer.sendTo(clientId, {
        type: WS_MESSAGE_TYPES.DRAWING_SYNC,
        payload: {
          elements: drawings,
        },
      });
    }
  }

  private async _handleShipMoved(clientId: string, payload: { shipId: string; phase: 1 | 2 | 3; type: 'straight' | 'strafe' | 'rotate'; distance?: number; angle?: number; newX: number; newY: number; newHeading: number }): Promise<void> {
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    const movement = {
      shipId: payload.shipId,
      phase: payload.phase as 1 | 2 | 3,
      type: payload.type as 'straight' | 'strafe' | 'rotate',
      distance: payload.distance,
      angle: payload.angle,
    };

    const result = await this._shipService.moveShip(payload.shipId, movement);
    if (result.success) {
      this._roomManager.broadcastToRoom(playerRoom.id, {
        type: WS_MESSAGE_TYPES.SHIP_MOVED,
        payload: {
          shipId: payload.shipId,
          phase: payload.phase,
          type: payload.type,
          distance: payload.distance,
          angle: payload.angle,
          newX: payload.newX,
          newY: payload.newY,
          newHeading: payload.newHeading,
          timestamp: Date.now(),
        },
      });
    }
  }

  private async _handleShieldUpdate(clientId: string, payload: { shipId: string; active: boolean; type: 'front' | 'full'; coverageAngle: number }): Promise<void> {
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

  private async _handleFluxState(clientId: string, payload: { shipId: string; fluxState: string; currentFlux: number; softFlux: number; hardFlux: number }): Promise<void> {
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      return;
    }

    if (payload.fluxState === 'venting') {
      await this._shipService.ventShip(payload.shipId);
    }

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.FLUX_STATE,
      payload: {
        shipId: payload.shipId,
        fluxState: payload.fluxState as 'normal' | 'venting' | 'overloaded',
        currentFlux: payload.currentFlux,
        softFlux: payload.softFlux,
        hardFlux: payload.hardFlux,
      },
    });
  }

  private async _handleCombatEvent(clientId: string, payload: { sourceShipId: string; targetShipId: string; weaponId: string; hit: boolean; damage?: number; hitQuadrant?: string }): Promise<void> {
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

  private async _handleDrawingAdd(clientId: string, payload: { element: DrawingElement }): Promise<void> {
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

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.DRAWING_ADD,
      payload: {
        playerId: clientId,
        element: payload.element,
      },
    }, clientId);
  }

  private async _handleDrawingClear(clientId: string, payload: { clearAll?: boolean }): Promise<void> {
    const playerRoom = this._roomManager.getPlayerRoom(clientId);
    if (!playerRoom) {
      this._sendError(clientId, 'NOT_IN_ROOM', 'Player is not in a room');
      return;
    }

    if (payload.clearAll) {
      this._roomDrawings.set(playerRoom.id, []);
    }

    this._roomManager.broadcastToRoom(playerRoom.id, {
      type: WS_MESSAGE_TYPES.DRAWING_CLEAR,
      payload: {
        playerId: clientId,
      },
    });
  }

  private async _handleChatMessage(clientId: string, payload: { content: string }): Promise<void> {
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
    const roomManager = this._roomManager;
    const wsServer = (roomManager as unknown as { _wsServer?: { sendTo: (id: string, msg: WSMessage) => void } })._wsServer;
    if (wsServer) {
      wsServer.sendTo(clientId, {
        type: WS_MESSAGE_TYPES.ERROR,
        payload: { code, message, details },
      });
    }
  }

  getRoomDrawings(roomId: string): DrawingElement[] {
    return this._roomDrawings.get(roomId) ?? [];
  }
}

export default MessageHandler;