import fs from "fs/promises";
import path from "path";
import type { PlayerInfo } from "@vt/data";
import { validatePlayerInfo } from "@vt/data";

const PLAYERS_DIR = path.resolve(process.cwd(), "data", "players");

async function ensureDir(): Promise<void> {
	try {
		await fs.mkdir(PLAYERS_DIR, { recursive: true });
	} catch {}
}

function getFileName(username: string, playerId: string): string {
	return `${username}${playerId}.json`;
}

export class PlayerInfoService {
	private cache = new Map<string, PlayerInfo>();
	private usernameToPlayerId = new Map<string, string>();

	async getPlayerInfo(playerId: string): Promise<PlayerInfo | null> {
		const cached = this.cache.get(playerId);
		if (cached) return cached;

		await ensureDir();
		const files = await fs.readdir(PLAYERS_DIR);
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			const filePath = path.join(PLAYERS_DIR, file);
			try {
				const content = await fs.readFile(filePath, "utf-8");
				const data = JSON.parse(content) as Record<string, unknown>;
				const info = data["info"] as PlayerInfo | undefined;
				if (!info) continue;
				const validated = validatePlayerInfo(info);
				this.cache.set(validated.playerId, validated);
				this.usernameToPlayerId.set(validated.username, validated.playerId);
				if (validated.playerId === playerId) return validated;
			} catch {}
		}
		return null;
	}

	async getPlayerInfoByUsername(username: string): Promise<PlayerInfo | null> {
		const cachedPlayerId = this.usernameToPlayerId.get(username);
		if (cachedPlayerId) return this.getPlayerInfo(cachedPlayerId);

		await ensureDir();
		const files = await fs.readdir(PLAYERS_DIR);
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			if (!file.startsWith(username)) continue;
			const filePath = path.join(PLAYERS_DIR, file);
			try {
				const content = await fs.readFile(filePath, "utf-8");
				const data = JSON.parse(content) as Record<string, unknown>;
				const info = data["info"] as PlayerInfo | undefined;
				if (!info || info.username !== username) continue;
				const validated = validatePlayerInfo(info);
				this.cache.set(validated.playerId, validated);
				this.usernameToPlayerId.set(validated.username, validated.playerId);
				return validated;
			} catch {}
		}
		return null;
	}

	async createPlayerInfo(username: string, playerId: string): Promise<PlayerInfo> {
		await ensureDir();
		const now = Date.now();
		const info: PlayerInfo = {
			playerId,
			username,
			displayName: username,
			avatar: null,
			stats: {
				gamesPlayed: 0,
				wins: 0,
				totalDamage: 0,
			},
			createdAt: now,
			updatedAt: now,
			lastLogin: now,
		};

		await this.savePlayerInfo(username, playerId, info);
		this.usernameToPlayerId.set(username, playerId);
		return info;
	}

	async updatePlayerInfo(username: string, playerId: string, patch: Partial<PlayerInfo>): Promise<PlayerInfo | null> {
		const existing = await this.getPlayerInfo(playerId);
		if (!existing) return null;

		const now = Date.now();
		const updated: PlayerInfo = {
			...existing,
			...patch,
			updatedAt: now,
		};

		await this.savePlayerInfo(username, playerId, validatePlayerInfo(updated));
		return updated;
	}

	async updateLastLogin(playerId: string): Promise<PlayerInfo | null> {
		const existing = await this.getPlayerInfo(playerId);
		if (!existing) return null;

		const now = Date.now();
		const updated: PlayerInfo = {
			...existing,
			lastLogin: now,
			updatedAt: now,
		};

		await this.savePlayerInfo(updated.username, playerId, updated);
		return updated;
	}

	private async savePlayerInfo(username: string, playerId: string, info: PlayerInfo): Promise<void> {
		this.cache.set(playerId, info);
		await ensureDir();
		const fileName = getFileName(username, playerId);
		const filePath = path.join(PLAYERS_DIR, fileName);

		let data: Record<string, unknown> = {};
		try {
			const content = await fs.readFile(filePath, "utf-8");
			data = JSON.parse(content) as Record<string, unknown>;
		} catch {}

		data["info"] = info;
		await fs.writeFile(filePath, JSON.stringify(data, null, 2));
	}

	clearCache(): void {
		this.cache.clear();
		this.usernameToPlayerId.clear();
	}
}