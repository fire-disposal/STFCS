import fs from "fs/promises";
import path from "path";
import type { PlayerInfo, InventoryToken, WeaponJSON, RoomArchive } from "@vt/data";
import { validatePlayerInfo, InventoryTokenSchema, WeaponJSONSchema } from "@vt/data";

const PLAYERS_DIR = path.resolve(process.cwd(), "storage", "players");

interface PlayerFile {
	info: PlayerInfo;
	ships: InventoryToken[];
	weapons: WeaponJSON[];
	roomSaves: RoomArchive[];
}

async function ensureDir(): Promise<void> {
	await fs.mkdir(PLAYERS_DIR, { recursive: true });
}

function getFilePath(username: string, playerId: string): string {
	return path.join(PLAYERS_DIR, `${username}${playerId}.json`);
}

function findFilePathByPlayerId(files: string[], playerId: string): string | null {
	return files.find((f) => f.endsWith(`${playerId}.json`)) ?? null;
}

function findFilePathByUsername(files: string[], username: string): string | null {
	return files.find((f) => f.startsWith(`${username}#`) && f.endsWith(".json")) ?? null;
}

export class PlayerInfoService {
	/**
	 * 获取所有已存在的 playerId 集合
	 * 用于新用户注册时避免短数字 ID 冲突
	 */
	async getAllPlayerIds(): Promise<Set<string>> {
		await ensureDir();
		const files = await fs.readdir(PLAYERS_DIR);
		const ids = new Set<string>();
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			// 文件名格式: {username}#{xxx}.json → 提取 #xxx
			const match = file.match(/#\d{3}\.json$/);
			if (match) {
				ids.add(match[0].replace(".json", ""));
			}
		}
		return ids;
	}

	async loadPlayerFile(filePath: string): Promise<PlayerFile | null> {
		try {
			const content = await fs.readFile(filePath, "utf-8");
			const data = JSON.parse(content) as PlayerFile;
			if (data.info) data.info = validatePlayerInfo(data.info);
			return data;
		} catch {
			return null;
		}
	}

	async savePlayerFile(filePath: string, data: PlayerFile): Promise<void> {
		await ensureDir();
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	}

	async findByPlayerId(playerId: string): Promise<{ file: PlayerFile; path: string } | null> {
		await ensureDir();
		const files = await fs.readdir(PLAYERS_DIR);
		const fileName = findFilePathByPlayerId(files, playerId);
		if (!fileName) return null;
		const filePath = path.join(PLAYERS_DIR, fileName);
		const file = await this.loadPlayerFile(filePath);
		if (!file) return null;
		return { file, path: filePath };
	}

	async findByUsername(username: string): Promise<{ file: PlayerFile; path: string } | null> {
		await ensureDir();
		const files = await fs.readdir(PLAYERS_DIR);
		const fileName = findFilePathByUsername(files, username);
		if (!fileName) return null;
		const filePath = path.join(PLAYERS_DIR, fileName);
		const file = await this.loadPlayerFile(filePath);
		if (!file) return null;
		return { file, path: filePath };
	}

	async create(username: string, playerId: string): Promise<PlayerFile> {
		await ensureDir();
		const filePath = getFilePath(username, playerId);
		const now = Date.now();
		const file: PlayerFile = {
			info: {
				playerId,
				username,
				displayName: username,
				avatar: null,
				stats: { gamesPlayed: 0, wins: 0, totalDamage: 0 },
				createdAt: now,
				updatedAt: now,
				lastLogin: now,
			},
			ships: [],
			weapons: [],
			roomSaves: [],
		};
		await this.savePlayerFile(filePath, file);
		return file;
	}

	async updateInfo(playerId: string, patch: Partial<PlayerInfo>): Promise<PlayerInfo | null> {
		const result = await this.findByPlayerId(playerId);
		if (!result) return null;
		const now = Date.now();
		result.file.info = validatePlayerInfo({ ...result.file.info, ...patch, updatedAt: now });
		await this.savePlayerFile(result.path, result.file);
		return result.file.info;
	}

	async getShips(playerId: string): Promise<InventoryToken[]> {
		const result = await this.findByPlayerId(playerId);
		return result?.file.ships ?? [];
	}

	async getWeapons(playerId: string): Promise<WeaponJSON[]> {
		const result = await this.findByPlayerId(playerId);
		return result?.file.weapons ?? [];
	}

	async addShip(playerId: string, ship: InventoryToken): Promise<InventoryToken> {
		const result = await this.findByPlayerId(playerId);
		if (!result) throw new Error("玩家不存在");
		const validated = InventoryTokenSchema.parse(ship) as InventoryToken;
		result.file.ships.push(validated);
		await this.savePlayerFile(result.path, result.file);
		return validated;
	}

	async updateShip(playerId: string, shipId: string, updates: Partial<InventoryToken>): Promise<InventoryToken | null> {
		const result = await this.findByPlayerId(playerId);
		if (!result) return null;
		const idx = result.file.ships.findIndex((s) => s.$id === shipId);
		if (idx === -1) return null;
		const updated = InventoryTokenSchema.parse({ ...result.file.ships[idx], ...updates }) as InventoryToken;
		result.file.ships[idx] = updated;
		await this.savePlayerFile(result.path, result.file);
		return updated;
	}

	async deleteShip(playerId: string, shipId: string): Promise<boolean> {
		const result = await this.findByPlayerId(playerId);
		if (!result) return false;
		const idx = result.file.ships.findIndex((s) => s.$id === shipId);
		if (idx === -1) return false;
		result.file.ships.splice(idx, 1);
		await this.savePlayerFile(result.path, result.file);
		return true;
	}

	async addWeapon(playerId: string, weapon: WeaponJSON): Promise<WeaponJSON> {
		const result = await this.findByPlayerId(playerId);
		if (!result) throw new Error("玩家不存在");
		const validated = WeaponJSONSchema.parse(weapon) as WeaponJSON;
		result.file.weapons.push(validated);
		await this.savePlayerFile(result.path, result.file);
		return validated;
	}

	async updateWeapon(playerId: string, weaponId: string, updates: Partial<WeaponJSON>): Promise<WeaponJSON | null> {
		const result = await this.findByPlayerId(playerId);
		if (!result) return null;
		const idx = result.file.weapons.findIndex((w) => w.$id === weaponId);
		if (idx === -1) return null;
		const updated = WeaponJSONSchema.parse({ ...result.file.weapons[idx], ...updates }) as WeaponJSON;
		result.file.weapons[idx] = updated;
		await this.savePlayerFile(result.path, result.file);
		return updated;
	}

	async deleteWeapon(playerId: string, weaponId: string): Promise<boolean> {
		const result = await this.findByPlayerId(playerId);
		if (!result) return false;
		const idx = result.file.weapons.findIndex((w) => w.$id === weaponId);
		if (idx === -1) return false;
		result.file.weapons.splice(idx, 1);
		await this.savePlayerFile(result.path, result.file);
		return true;
	}

	async addRoomSave(playerId: string, save: RoomArchive): Promise<void> {
		const result = await this.findByPlayerId(playerId);
		if (!result) return;
		result.file.roomSaves.push(save);
		await this.savePlayerFile(result.path, result.file);
	}

	async getRoomSaves(playerId: string): Promise<RoomArchive[]> {
		const result = await this.findByPlayerId(playerId);
		return result?.file.roomSaves ?? [];
	}

	async deleteRoomSave(playerId: string, saveId: string): Promise<boolean> {
		const result = await this.findByPlayerId(playerId);
		if (!result) return false;
		const idx = result.file.roomSaves.findIndex((s) => s.id === saveId);
		if (idx === -1) return false;
		result.file.roomSaves.splice(idx, 1);
		await this.savePlayerFile(result.path, result.file);
		return true;
	}
}