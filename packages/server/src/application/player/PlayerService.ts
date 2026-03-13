import type { PlayerInfo } from '@vt/shared/types';
import { WS_MESSAGE_TYPES } from '@vt/shared/ws';
import type { IWSServer } from '@vt/shared/ws';
import type { RoomManager } from '../../infrastructure/ws/RoomManager';

export interface JoinPlayerResult {
  success: boolean;
  player?: PlayerInfo;
  error?: string;
}

export interface LeavePlayerResult {
  success: boolean;
  error?: string;
}

export interface IPlayerService {
  join(player: PlayerInfo): Promise<JoinPlayerResult>;
  leave(playerId: string, roomId: string): Promise<LeavePlayerResult>;
  getPlayer(playerId: string): PlayerInfo | undefined;
  listPlayers(roomId: string): PlayerInfo[];
}

export class PlayerService implements IPlayerService {
  private _players: Map<string, PlayerInfo>;
  private _wsServer?: IWSServer;
  private _roomManager?: RoomManager;

  constructor() {
    this._players = new Map();
  }

  setWSServer(wsServer: IWSServer): void {
    this._wsServer = wsServer;
  }

  setRoomManager(roomManager: RoomManager): void {
    this._roomManager = roomManager;
  }

  async join(player: PlayerInfo): Promise<JoinPlayerResult> {
    if (this._players.has(player.id)) {
      return {
        success: true,
        player: this._players.get(player.id),
      };
    }

    this._players.set(player.id, player);

    if (this._roomManager) {
      const defaultRoom = 'default';
      this._roomManager.joinRoom(defaultRoom, player);
    }

    if (this._wsServer) {
      this._wsServer.broadcast({
        type: WS_MESSAGE_TYPES.PLAYER_JOINED,
        payload: player,
      });
    }

    return {
      success: true,
      player,
    };
  }

  async leave(playerId: string, roomId: string): Promise<LeavePlayerResult> {
    const player = this._players.get(playerId);
    if (!player) {
      return {
        success: false,
        error: 'Player not found',
      };
    }

    if (this._roomManager) {
      this._roomManager.leaveRoom(roomId, playerId);
    }

    this._players.delete(playerId);

    if (this._wsServer) {
      this._wsServer.broadcast({
        type: WS_MESSAGE_TYPES.PLAYER_LEFT,
        payload: { playerId, reason: 'Player left' },
      });
    }

    return {
      success: true,
    };
  }

  getPlayer(playerId: string): PlayerInfo | undefined {
    return this._players.get(playerId);
  }

  listPlayers(roomId: string): PlayerInfo[] {
    if (!this._roomManager) {
      return Array.from(this._players.values());
    }

    const room = this._roomManager.getRoom(roomId);
    if (!room) {
      return [];
    }

    return Array.from(room.players.values());
  }
}

export default PlayerService;
