/**
 * 玩家档案服务
 *
 * 管理玩家账户、舰船和武器列表
 * 账户创建时自动载入预设数据
 */

import { presetShips, presetWeapons, type InventoryToken, type CombatToken, type WeaponJSON, type GameSave, type WeaponBuild } from "@vt/data";
import type { PersistenceManager } from "../persistence/PersistenceManager.js";
import type { ShipBuild, RoomArchive } from "../persistence/types.js";
import { ShipBuildService } from "./ship/ShipBuildService.js";
import { AssetService } from "./AssetService.js";

let idCounter = 0;

function generateId(prefix: string, userId: string): string {
	idCounter++;
	return `${prefix}:${userId}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class PlayerProfileService {
	private shipService: ShipBuildService;
	private assetService: AssetService;

	constructor(private persistence: PersistenceManager) {
		this.shipService = new ShipBuildService(persistence);
		this.assetService = new AssetService();
	}

	async createAccount(userId: string): Promise<void> {
		const existingShips = await this.persistence.ships.findBy({ ownerId: userId });
		if (existingShips.length > 0) {
			return;
		}

		for (const preset of presetShips) {
			const shipJson: InventoryToken = {
				$id: generateId("ship", userId),
				$presetRef: preset.$id,
				spec: preset.spec,
				metadata: {
					...preset.metadata,
					createdAt: Date.now(),
				},
			};

			await this.shipService.createShipBuild(userId, shipJson);
		}

		for (const preset of presetWeapons) {
			const weaponJson = JSON.parse(JSON.stringify(preset)) as WeaponJSON;
			weaponJson.$id = generateId("weapon", userId);

			const weaponBuild: WeaponBuild = {
				id: weaponJson.$id,
				data: weaponJson,
				ownerId: userId,
				isPreset: false,
				tags: ["preset-copy"],
				usageCount: 0,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			await this.persistence.weapons.create(weaponBuild);
		}

		console.log(`[PlayerProfileService] Created account for ${userId} with ${presetShips.length} ships, ${presetWeapons.length} weapons`);
	}

	async resetToDefaults(userId: string): Promise<{ ships: number; weapons: number }> {
		const userShips = await this.persistence.ships.findBy({ ownerId: userId });
		const userWeapons = await this.persistence.weapons.findBy({ ownerId: userId });

		for (const ship of userShips) {
			await this.persistence.ships.delete(ship.id);
		}

		for (const weapon of userWeapons) {
			await this.persistence.weapons.delete(weapon.id);
		}

		await this.createAccount(userId);

		return {
			ships: presetShips.length,
			weapons: presetWeapons.length,
		};
	}

	async getPlayerShips(userId: string): Promise<ShipBuild[]> {
		return await this.persistence.ships.findBy({ ownerId: userId });
	}

	async getPlayerWeapons(userId: string): Promise<WeaponBuild[]> {
		return await this.persistence.weapons.findBy({ ownerId: userId });
	}

	async getPlayerShip(userId: string, shipId: string): Promise<ShipBuild | null> {
		const ship = await this.persistence.ships.findById(shipId);
		if (ship?.ownerId !== userId) return null;
		return ship;
	}

	async getPlayerWeapon(userId: string, weaponId: string): Promise<WeaponBuild | null> {
		const weapon = await this.persistence.weapons.findById(weaponId);
		if (weapon?.ownerId !== userId) return null;
		return weapon;
	}

	async deletePlayerShip(userId: string, shipId: string): Promise<boolean> {
		const ship = await this.persistence.ships.findById(shipId);
		if (!ship || ship.ownerId !== userId) return false;
		return await this.persistence.ships.delete(shipId);
	}

	async deletePlayerWeapon(userId: string, weaponId: string): Promise<boolean> {
		const weapon = await this.persistence.weapons.findById(weaponId);
		if (!weapon || weapon.ownerId !== userId) return false;
		return await this.persistence.weapons.delete(weaponId);
	}

	async createSave(userId: string, name: string, ships: CombatToken[]): Promise<GameSave> {
		const save: GameSave = {
			$id: generateId("save", userId),
			metadata: { name, createdAt: Date.now(), updatedAt: Date.now() },
			tokens: ships,
			createdAt: Date.now(),
		};

		const archive: RoomArchive = {
			id: save.$id,
			name,
			saveJson: save,
			metadata: {
				roomId: "",
				roomName: name,
				mapWidth: 2000,
				mapHeight: 2000,
				maxPlayers: 2,
				playerCount: 1,
				totalTurns: 0,
				gameDuration: 0,
			},
			playerIds: [userId],
			isAutoSave: false,
			tags: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		await this.persistence.roomSaves.create(archive);

		return save;
	}

	async listSaves(userId: string): Promise<GameSave[]> {
		const archives = await this.persistence.roomSaves.findBy({ playerIds: [userId] });
		return archives.map((a) => a.saveJson);
	}

	async uploadAvatar(userId: string, buffer: Buffer, filename: string, mimeType: string): Promise<string> {
		return this.assetService.uploadAvatar(userId, buffer, filename, mimeType);
	}

	async uploadShipTexture(userId: string, buffer: Buffer, filename: string, mimeType: string): Promise<string> {
		return this.assetService.uploadShipTexture(userId, buffer, filename, mimeType);
	}

	async getAssetData(assetId: string): Promise<Uint8Array | null> {
		return this.assetService.getAssetData(assetId);
	}
}