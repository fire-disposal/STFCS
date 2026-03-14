import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerService } from '../PlayerService';
import type { PlayerInfo } from '@vt/shared/types';

describe('PlayerService', () => {
	let service: PlayerService;

	beforeEach(() => {
		service = new PlayerService();
	});

	describe('join', () => {
		it('should join a new player', async () => {
			const player: PlayerInfo = {
				id: 'player-1',
				name: 'TestPlayer',
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			};

			const result = await service.join(player);

			expect(result.success).toBe(true);
			expect(result.data).toEqual(player);
		});

		it('should return existing player if already joined', async () => {
			const player: PlayerInfo = {
				id: 'player-1',
				name: 'TestPlayer',
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			};

			await service.join(player);
			const result = await service.join(player);

			expect(result.success).toBe(true);
			expect(result.data?.id).toBe('player-1');
		});

		it('should store player in internal map', async () => {
			const player: PlayerInfo = {
				id: 'player-1',
				name: 'TestPlayer',
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			};

			await service.join(player);
			const retrieved = service.getPlayer('player-1');

			expect(retrieved).toEqual(player);
		});

		it('should initialize missing fields with defaults', async () => {
			const player: PlayerInfo = {
				id: 'player-1',
				name: 'TestPlayer',
				joinedAt: Date.now(),
			} as PlayerInfo;

			const result = await service.join(player);

			expect(result.success).toBe(true);
			expect(result.data?.isActive).toBe(true);
			expect(result.data?.isDMMode).toBe(false);
		});
	});

	describe('leave', () => {
		it('should leave an existing player', async () => {
			const player: PlayerInfo = {
				id: 'player-1',
				name: 'TestPlayer',
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			};

			await service.join(player);
			const result = await service.leave('player-1', 'default');

			expect(result.success).toBe(true);
			expect(service.getPlayer('player-1')).toBeUndefined();
		});

		it('should fail to leave non-existent player', async () => {
			const result = await service.leave('non-existent', 'default');

			expect(result.success).toBe(false);
			expect(result.error).toBe('Player not found');
		});
	});

	describe('getPlayer', () => {
		it('should return player by id', async () => {
			const player: PlayerInfo = {
				id: 'player-1',
				name: 'TestPlayer',
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			};

			await service.join(player);
			const retrieved = service.getPlayer('player-1');

			expect(retrieved).toEqual(player);
		});

		it('should return undefined for non-existent player', () => {
			const retrieved = service.getPlayer('non-existent');
			expect(retrieved).toBeUndefined();
		});
	});

	describe('listPlayers', () => {
		it('should list all players', async () => {
			const player1: PlayerInfo = {
				id: 'player-1',
				name: 'Player1',
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			};
			const player2: PlayerInfo = {
				id: 'player-2',
				name: 'Player2',
				joinedAt: Date.now(),
				isActive: true,
				isDMMode: false,
			};

			await service.join(player1);
			await service.join(player2);

			const players = service.listPlayers('default');

			expect(players.length).toBe(2);
			expect(players.map((p) => p.id)).toContain('player-1');
			expect(players.map((p) => p.id)).toContain('player-2');
		});

		it('should return empty array when no players', () => {
			const players = service.listPlayers('default');
			expect(players).toEqual([]);
		});
	});
});
