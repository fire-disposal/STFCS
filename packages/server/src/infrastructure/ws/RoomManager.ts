import type { WSMessage } from '@vt/shared/ws';
import type { IWSServer } from '@vt/shared/ws';
import type { PlayerInfo } from '@vt/shared/types';

export interface Room {
  id: string;
  players: Map<string, PlayerInfo>;
  createdAt: number;
  maxPlayers: number;
}

export interface IRoomManager {
  createRoom(roomId: string): Room;
  joinRoom(roomId: string, player: PlayerInfo): boolean;
  leaveRoom(roomId: string, playerId: string): boolean;
  getRoom(roomId: string): Room | undefined;
  getPlayerRoom(playerId: string): Room | undefined;
  broadcastToRoom(roomId: string, message: WSMessage, excludePlayerId?: string): void;
  deleteRoom(roomId: string): void;
  listRooms(): Room[];
}

export class RoomManager implements IRoomManager {
  private _rooms: Map<string, Room>;
  private _playerRooms: Map<string, string>;
  private _maxPlayersPerRoom: number;
  private _wsServer?: IWSServer;

  constructor(maxPlayersPerRoom: number = 8) {
    this._rooms = new Map();
    this._playerRooms = new Map();
    this._maxPlayersPerRoom = maxPlayersPerRoom;
  }

  setWSServer(wsServer: IWSServer): void {
    this._wsServer = wsServer;
  }

  createRoom(roomId: string): Room {
    if (this._rooms.has(roomId)) {
      return this._rooms.get(roomId)!;
    }

    const room: Room = {
      id: roomId,
      players: new Map(),
      createdAt: Date.now(),
      maxPlayers: this._maxPlayersPerRoom,
    };

    this._rooms.set(roomId, room);
    return room;
  }

  joinRoom(roomId: string, player: PlayerInfo): boolean {
    let room = this._rooms.get(roomId);
    if (!room) {
      room = this.createRoom(roomId);
    }

    if (room.players.size >= room.maxPlayers) {
      return false;
    }

    if (room.players.has(player.id)) {
      return true;
    }

    room.players.set(player.id, player);
    this._playerRooms.set(player.id, roomId);
    return true;
  }

  leaveRoom(roomId: string, playerId: string): boolean {
    const room = this._rooms.get(roomId);
    if (!room) {
      return false;
    }

    const removed = room.players.delete(playerId);
    this._playerRooms.delete(playerId);

    if (room.players.size === 0) {
      this._rooms.delete(roomId);
    }

    return removed;
  }

  getRoom(roomId: string): Room | undefined {
    return this._rooms.get(roomId);
  }

  getPlayerRoom(playerId: string): Room | undefined {
    const roomId = this._playerRooms.get(playerId);
    if (!roomId) {
      return undefined;
    }
    return this._rooms.get(roomId);
  }

  broadcastToRoom(roomId: string, message: WSMessage, excludePlayerId?: string): void {
    const room = this._rooms.get(roomId);
    if (!room || !this._wsServer) {
      return;
    }

    for (const [playerId] of room.players.entries()) {
      if (playerId !== excludePlayerId) {
        this._wsServer.sendTo(playerId, message);
      }
    }
  }

  deleteRoom(roomId: string): void {
    const room = this._rooms.get(roomId);
    if (!room) {
      return;
    }

    for (const [playerId] of room.players.entries()) {
      this._playerRooms.delete(playerId);
    }

    this._rooms.delete(roomId);
  }

  listRooms(): Room[] {
    return Array.from(this._rooms.values());
  }

  getRoomCount(): number {
    return this._rooms.size;
  }
}

export default RoomManager;
