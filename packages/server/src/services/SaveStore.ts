/**
 * 内存存档存储实现
 *
 * 用于开发和测试，生产环境应使用数据库或文件系统
 */

import type { GameSave, SaveStore, SaveSummary } from "../schema/GameSave.js";

export class MemorySaveStore implements SaveStore {
	private saves = new Map<string, GameSave>();

	async save(saveData: GameSave): Promise<void> {
		console.log(`[MemorySaveStore] Saving: ${saveData.saveName} (${saveData.saveId})`);
		this.saves.set(saveData.saveId, saveData);
	}

	async load(saveId: string): Promise<GameSave> {
		const save = this.saves.get(saveId);
		if (!save) {
			throw new Error(`Save not found: ${saveId}`);
		}
		console.log(`[MemorySaveStore] Loaded: ${save.saveName}`);
		return save;
	}

	async delete(saveId: string): Promise<void> {
		const save = this.saves.get(saveId);
		if (save) {
			console.log(`[MemorySaveStore] Deleted: ${save.saveName}`);
			this.saves.delete(saveId);
		}
	}

	async list(): Promise<SaveSummary[]> {
		const summaries: SaveSummary[] = [];

		for (const save of this.saves.values()) {
			summaries.push({
				saveId: save.saveId,
				saveName: save.saveName,
				roomName: save.roomName,
				playerCount: save.players.length,
				shipCount: save.ships.length,
				turnCount: save.turnCount,
				currentPhase: save.currentPhase,
				createdAt: save.createdAt,
				updatedAt: save.updatedAt,
				fileSize: JSON.stringify(save).length,
			});
		}

		// 按更新时间排序（最新的在前）
		return summaries.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	async exists(saveId: string): Promise<boolean> {
		return this.saves.has(saveId);
	}

	async getSummary(saveId: string): Promise<SaveSummary> {
		const save = await this.load(saveId);
		return {
			saveId: save.saveId,
			saveName: save.saveName,
			roomName: save.roomName,
			playerCount: save.players.length,
			shipCount: save.ships.length,
			turnCount: save.turnCount,
			currentPhase: save.currentPhase,
			createdAt: save.createdAt,
			updatedAt: save.updatedAt,
			fileSize: JSON.stringify(save).length,
		};
	}

	/**
	 * 清空所有存档（用于测试）
	 */
	clear(): void {
		this.saves.clear();
	}

	/**
	 * 获取存档数量（用于测试）
	 */
	get count(): number {
		return this.saves.size;
	}
}
