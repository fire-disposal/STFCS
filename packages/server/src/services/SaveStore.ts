/**
 * 内存存档存储
 */

import type { GameSave, SaveStore, SaveSummary } from "../schema/types.js";

class MemorySaveStore implements SaveStore {
	private saves = new Map<string, GameSave>();

	async save(data: GameSave) {
		this.saves.set(data.saveId, data);
	}
	async load(id: string) {
		const s = this.saves.get(id);
		if (!s) throw new Error(`Save not found: ${id}`);
		return s;
	}
	async delete(id: string) {
		this.saves.delete(id);
	}
	async exists(id: string) {
		return this.saves.has(id);
	}
	async list(): Promise<SaveSummary[]> {
		return Array.from(this.saves.values())
			.map((s) => ({
				saveId: s.saveId,
				saveName: s.saveName,
				roomName: s.roomName,
				playerCount: s.players.length,
				shipCount: s.ships.length,
				turnCount: s.turnCount,
				currentPhase: s.currentPhase,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
				fileSize: JSON.stringify(s).length,
			}))
			.sort((a, b) => b.updatedAt - a.updatedAt);
	}
	async getSummary(id: string) {
		const s = await this.load(id);
		return {
			saveId: s.saveId,
			saveName: s.saveName,
			roomName: s.roomName,
			playerCount: s.players.length,
			shipCount: s.ships.length,
			turnCount: s.turnCount,
			currentPhase: s.currentPhase,
			createdAt: s.createdAt,
			updatedAt: s.updatedAt,
			fileSize: JSON.stringify(s).length,
		};
	}
}

export const saveStore = new MemorySaveStore();