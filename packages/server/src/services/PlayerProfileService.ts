import { presetShips, presetWeapons, type InventoryToken, type WeaponJSON, type GameSave } from "@vt/data";
import type { RoomArchive } from "@vt/data";
import { PlayerInfoService } from "./PlayerInfoService.js";

let idCounter = 0;

function generateId(prefix: string, userId: string): string {
	idCounter++;
	return `${prefix}:${userId}_${Date.now().toString(36)}_${idCounter.toString(36)}`;
}

export class PlayerProfileService {
	constructor(private playerInfoService: PlayerInfoService) { }

	async createAccount(userId: string, playerName?: string): Promise<void> {
		const existingShips = await this.playerInfoService.getShips(userId);
		if (existingShips.length > 0) {
			console.log(`[PlayerProfileService] 用户 ${playerName ?? userId} 已有 ${existingShips.length} 艘舰船，跳过预设导入`);
			return;
		}

		for (const preset of presetShips) {
			const ship: InventoryToken = {
				$id: generateId("ship", userId),
				$presetRef: preset.$id,
				spec: preset.spec,
				metadata: {
					...preset.metadata,
				},
			};
			await this.playerInfoService.addShip(userId, ship);
			console.log(`[PlayerProfileService] 为 ${playerName ?? userId} 导入舰船预设: ${preset.metadata?.name ?? preset.$id}`);
		}

		for (const preset of presetWeapons) {
			const weapon: WeaponJSON = {
				...JSON.parse(JSON.stringify(preset)),
				$id: generateId("weapon", userId),
			};
			await this.playerInfoService.addWeapon(userId, weapon);
			console.log(`[PlayerProfileService] 为 ${playerName ?? userId} 导入武器预设: ${preset.metadata?.name ?? preset.$id}`);
		}

		console.log(`[PlayerProfileService] 已为用户 ${playerName ?? userId} 导入 ${presetShips.length} 艘舰船预设、${presetWeapons.length} 个武器预设`);
	}

	async getPlayerShips(userId: string): Promise<InventoryToken[]> {
		return await this.playerInfoService.getShips(userId);
	}

	async getPlayerWeapons(userId: string): Promise<WeaponJSON[]> {
		return await this.playerInfoService.getWeapons(userId);
	}

	async getPlayerShip(userId: string, shipId: string): Promise<InventoryToken | null> {
		const ships = await this.playerInfoService.getShips(userId);
		return ships.find((s) => s.$id === shipId) ?? null;
	}

	async getPlayerWeapon(userId: string, weaponId: string): Promise<WeaponJSON | null> {
		const weapons = await this.playerInfoService.getWeapons(userId);
		return weapons.find((w) => w.$id === weaponId) ?? null;
	}

	async deletePlayerShip(userId: string, shipId: string): Promise<boolean> {
		return await this.playerInfoService.deleteShip(userId, shipId);
	}

	async deletePlayerWeapon(userId: string, weaponId: string): Promise<boolean> {
		return await this.playerInfoService.deleteWeapon(userId, weaponId);
	}

	async createSave(userId: string, name: string, snapshot: GameSave["snapshot"]): Promise<GameSave> {
		const save: GameSave = {
			$id: generateId("save", userId),
			metadata: { name, createdAt: Date.now(), updatedAt: Date.now() },
			snapshot,
			createdAt: Date.now(),
		};

		const archive: RoomArchive = {
			id: save.$id,
			name,
			saveJson: save,
			metadata: {
				roomId: snapshot.roomId,
				roomName: name,
				mapWidth: snapshot.map?.size?.width ?? 2000,
				mapHeight: snapshot.map?.size?.height ?? 2000,
				maxPlayers: Object.keys(snapshot.players).length,
				playerCount: Object.keys(snapshot.players).length,
				totalTurns: snapshot.turnCount,
				gameDuration: Date.now() - snapshot.createdAt,
			},
			playerIds: Object.keys(snapshot.players),
			isAutoSave: false,
			tags: [],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};

		await this.playerInfoService.addRoomSave(userId, archive);
		return save;
	}

	async listSaves(userId: string): Promise<GameSave[]> {
		const archives = await this.playerInfoService.getRoomSaves(userId);
		return archives.map((a) => a.saveJson);
	}
}