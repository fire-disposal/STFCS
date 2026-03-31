import { describe, it, expect, beforeEach } from 'vitest';
import { RoomManager } from '../RoomManager';
import type { PlayerInfo } from '@vt/shared/types';
import { GLOBAL_ROOM_ID } from '@vt/shared/constants';

describe('RoomManager (single global room)', () => {
  let manager: RoomManager;

  const createTestPlayer = (id: string): PlayerInfo => ({
    id,
    name: `Player ${id}`,
    joinedAt: Date.now(),
  });

  beforeEach(() => {
    manager = new RoomManager(4);
  });

  it('always returns the global room', () => {
    const room = manager.createRoom('any-room');
    expect(room.id).toBe(GLOBAL_ROOM_ID);
    expect(manager.getRoom('other-room')?.id).toBe(GLOBAL_ROOM_ID);
    expect(manager.listRooms()).toHaveLength(1);
    expect(manager.getRoomCount()).toBe(1);
  });

  it('joins players into the global room', () => {
    const result = manager.joinRoom('room-1', createTestPlayer('player-1'));
    expect(result).toBe(true);

    const room = manager.getPlayerRoom('player-1');
    expect(room?.id).toBe(GLOBAL_ROOM_ID);
    expect(room?.players.has('player-1')).toBe(true);
  });

  it('enforces max player capacity on global room', () => {
    for (let i = 1; i <= 4; i++) {
      manager.joinRoom('ignored', createTestPlayer(`player-${i}`));
    }

    const result = manager.joinRoom('ignored', createTestPlayer('player-5'));
    expect(result).toBe(false);
  });

  it('marks player offline when leaving', () => {
    manager.joinRoom('ignored', createTestPlayer('player-1'));
    const removed = manager.leaveRoom('ignored', 'player-1');

    expect(removed).toBe(true);
    expect(manager.getPlayerRoom('player-1')).toBeUndefined();

    const state = manager.getGlobalState();
    expect(state.players['player-1']?.online).toBe(false);
  });
});
