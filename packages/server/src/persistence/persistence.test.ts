/**
 * 持久化层测试
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
	MemoryUserRepository,
	MemoryShipRepository,
	MemoryRoomSaveRepository,
	PersistenceManager,
} from "./index.js";
import type { UserProfile, ShipBuild, RoomArchive } from "./index.js";

describe("Persistence Layer", () => {
	describe("MemoryUserRepository", () => {
		let repo: MemoryUserRepository;

		beforeEach(() => {
			repo = new MemoryUserRepository();
		});

		it("should create and find user", async () => {
			const user: UserProfile = {
				id: "u1",
				name: "TestUser",
				role: "PLAYER",
				faction: "PLAYER",
				ready: false,
				connected: true,
				pingMs: 0,
				stats: {
					gamesPlayed: 0,
					gamesWon: 0,
					gamesLost: 0,
					totalDamageDealt: 0,
					totalDamageTaken: 0,
					totalShipsDestroyed: 0,
					totalShipsLost: 0,
				},
				preferences: {
					defaultFaction: "PLAYER",
					showDamageNumbers: true,
					showMovementRange: true,
					showWeaponRange: true,
					uiScale: 1,
					language: "zh",
				},
				shipBuildIds: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			await repo.create(user);
			const found = await repo.findById("u1");
			expect(found).toBeTruthy();
			expect(found?.name).toBe("TestUser");
		});

		it("should find online users", async () => {
			const baseUser = {
				role: "PLAYER",
				faction: "PLAYER",
				ready: false,
				pingMs: 0,
				stats: {
					gamesPlayed: 0,
					gamesWon: 0,
					gamesLost: 0,
					totalDamageDealt: 0,
					totalDamageTaken: 0,
					totalShipsDestroyed: 0,
					totalShipsLost: 0,
				},
				preferences: {
					defaultFaction: "PLAYER",
					showDamageNumbers: true,
					showMovementRange: true,
					showWeaponRange: true,
					uiScale: 1,
					language: "zh",
				},
				shipBuildIds: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			await repo.create({ ...baseUser, id: "u1", name: "Online", connected: true } as UserProfile);
			await repo.create({ ...baseUser, id: "u2", name: "Offline", connected: false } as UserProfile);

			const online = await repo.findOnline();
			expect(online).toHaveLength(1);
			expect(online[0].name).toBe("Online");
		});
	});

	describe("MemoryShipRepository", () => {
		let repo: MemoryShipRepository;

		beforeEach(() => {
			repo = new MemoryShipRepository();
		});

		it("should find ships by owner", async () => {
			const ship: ShipBuild = {
				id: "s1",
				ownerId: "user1",
				shipJson: {
					$schema: "ship-v2",
					$id: "ship:test",
					ship: {
						size: "FRIGATE",
						class: "STRIKE",
						maxHitPoints: 100,
						armorMaxPerQuadrant: 50,
						maxSpeed: 100,
						maxTurnRate: 60,
						fluxCapacity: 100,
						fluxDissipation: 10,
						category: "BALLISTIC",
						damageType: "KINETIC",
						size_weapon: "SMALL",
						damage: 10,
						range: 100,
						cooldown: 1,
						fluxCostPerShot: 5,
						mounts: [],
						mountType: "HARDPOINT",
						arc: 60,
						angle: 0,
						plugins: [],
						hullSize: "FRIGATE",
					},
					metadata: { name: "Test Ship" },
				},
				customizations: {},
				isPreset: false,
				isPublic: false,
				tags: [],
				usageCount: 0,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			await repo.create(ship);
			const found = await repo.findByOwner("user1");
			expect(found).toHaveLength(1);
		});
	});

	describe("MemoryRoomSaveRepository", () => {
		let repo: MemoryRoomSaveRepository;

		beforeEach(() => {
			repo = new MemoryRoomSaveRepository();
		});

		it("should find saves by room", async () => {
			const save: RoomArchive = {
				id: "save1",
				name: "Test Save",
				saveJson: {
					$schema: "save-v1",
					$id: "save:test",
					metadata: { name: "Test" },
					room: {
						turn: { count: 1, phase: "DEPLOYMENT", activeFaction: "PLAYER" },
						map: { width: 2000, height: 2000 },
						players: [],
					},
					ships: [],
				},
				metadata: {
					roomId: "room1",
					roomName: "Test Room",
					mapWidth: 2000,
					mapHeight: 2000,
					maxPlayers: 8,
					playerCount: 2,
					totalTurns: 5,
					gameDuration: 360000,
				},
				playerIds: ["p1", "p2"],
				isAutoSave: false,
				tags: [],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			await repo.create(save);
			const found = await repo.findByRoomId("room1");
			expect(found).toHaveLength(1);
		});
	});

	describe("PersistenceManager", () => {
		let manager: PersistenceManager;

		beforeEach(() => {
			manager = PersistenceManager.createMemory();
		});

		it("should clear all data", async () => {
			await manager.clearAll();
			expect(manager.users.count()).toBe(0);
			expect(manager.ships.count()).toBe(0);
			expect(manager.roomSaves.count()).toBe(0);
		});
	});
});
