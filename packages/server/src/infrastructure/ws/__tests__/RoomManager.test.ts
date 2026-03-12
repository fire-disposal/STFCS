import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../RoomManager';
import type { PlayerInfo } from '@stfcs/shared/types';

describe('RoomManager', () => {
  let manager: RoomManager;

  const createTestPlayer = (id: string): PlayerInfo => ({
    id,
    name: `Player ${id}`,
    joinedAt: Date.now(),
  });

  beforeEach(() => {
    manager = new RoomManager(4);
  });

  describe('createRoom', () => {
    it('should create a new room', () => {
      const room = manager.createRoom('room-1');

      expect(room).toBeDefined();
      expect(room.id).toBe('room-1');
      expect(room.players.size).toBe(0);
    });

    it('should return existing room', () => {
      const room1 = manager.createRoom('room-1');
      const room2 = manager.createRoom('room-1');

      expect(room1).toBe(room2);
    });
  });

  describe('joinRoom', () => {
    it('should join player to room', () => {
      const player = createTestPlayer('player-1');
      const result = manager.joinRoom('room-1', player);

      expect(result).toBe(true);

      const room = manager.getRoom('room-1');
      expect(room?.players.has('player-1')).toBe(true);
    });

    it('should create room if not exists', () => {
      const player = createTestPlayer('player-1');
      manager.joinRoom('new-room', player);

      const room = manager.getRoom('new-room');
      expect(room).toBeDefined();
    });

    it('should reject if room is full', () => {
      manager.createRoom('room-1');

      for (let i = 1; i <= 4; i++) {
        manager.joinRoom('room-1', createTestPlayer(`player-${i}`));
      }

      const result = manager.joinRoom('room-1', createTestPlayer('player-5'));
      expect(result).toBe(false);
    });
  });

  describe('leaveRoom', () => {
    it('should remove player from room', () => {
      const player = createTestPlayer('player-1');
      const player2 = createTestPlayer('player-2');
      manager.joinRoom('room-1', player);
      manager.joinRoom('room-1', player2);

      const result = manager.leaveRoom('room-1', 'player-1');
      expect(result).toBe(true);

      const room = manager.getRoom('room-1');
      expect(room).toBeDefined();
      expect(room?.players.has('player-1')).toBe(false);
      expect(room?.players.has('player-2')).toBe(true);
    });

    it('should delete room when last player leaves', () => {
      const player = createTestPlayer('player-1');
      manager.joinRoom('room-1', player);

      manager.leaveRoom('room-1', 'player-1');

      const room = manager.getRoom('room-1');
      expect(room).toBeUndefined();
    });

    it('should return false for non-existent room', () => {
      const result = manager.leaveRoom('non-existent', 'player-1');
      expect(result).toBe(false);
    });
  });

  describe('getRoom', () => {
    it('should return room by id', () => {
      manager.createRoom('room-1');
      const room = manager.getRoom('room-1');

      expect(room).toBeDefined();
      expect(room?.id).toBe('room-1');
    });

    it('should return undefined for non-existent room', () => {
      const room = manager.getRoom('non-existent');
      expect(room).toBeUndefined();
    });
  });

  describe('getPlayerRoom', () => {
    it('should return room for player', () => {
      const player = createTestPlayer('player-1');
      manager.joinRoom('room-1', player);

      const room = manager.getPlayerRoom('player-1');
      expect(room).toBeDefined();
      expect(room?.id).toBe('room-1');
    });

    it('should return undefined for player not in room', () => {
      const room = manager.getPlayerRoom('player-1');
      expect(room).toBeUndefined();
    });
  });

  describe('listRooms', () => {
    it('should list all rooms', () => {
      manager.createRoom('room-1');
      manager.createRoom('room-2');

      const rooms = manager.listRooms();
      expect(rooms.length).toBe(2);
      expect(rooms.map((r) => r.id)).toContain('room-1');
      expect(rooms.map((r) => r.id)).toContain('room-2');
    });
  });

  describe('getRoomCount', () => {
    it('should return number of rooms', () => {
      expect(manager.getRoomCount()).toBe(0);

      manager.createRoom('room-1');
      expect(manager.getRoomCount()).toBe(1);

      manager.createRoom('room-2');
      expect(manager.getRoomCount()).toBe(2);
    });
  });
});
