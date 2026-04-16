/**
 * 存档服务
 *
 * 职责：
 * - 封装存档存储逻辑
 * - 提供存档 CRUD 接口
 * - 序列化/反序列化游戏状态
 */

import { serializeGameSave, deserializeShipSave } from "../schema/GameSave.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import { GamePhase, Faction } from "../schema/types.js";
import type { GameSave, SaveMetadata, SaveSummary } from "../schema/types.js";

export interface SaveInfo {
	id: string;
	name: string;
	createdAt: number;
	updatedAt: number;
	turnCount: number;
}

class MemorySaveStore {
	private saves = new Map<string, GameSave>();

	async save(data: GameSave): Promise<void> {
		this.saves.set(data.id, data);
	}

	async load(id: string): Promise<GameSave> {
		const s = this.saves.get(id);
		if (!s) throw new Error(`存档不存在: ${id}`);
		return s;
	}

	async delete(id: string): Promise<void> {
		this.saves.delete(id);
	}

	async exists(id: string): Promise<boolean> {
		return this.saves.has(id);
	}

	async list(): Promise<SaveSummary> {
		const saves = Array.from(this.saves.values())
			.map((s): SaveMetadata => ({
				id: s.id,
				name: s.name,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
				turnCount: s.turnCount,
			}))
			.sort((a, b) => b.updatedAt - a.updatedAt);
		return { saves, total: saves.length };
	}

	async getMetadata(id: string): Promise<SaveMetadata> {
		const s = await this.load(id);
		return {
			id: s.id,
			name: s.name,
			createdAt: s.createdAt,
			updatedAt: s.updatedAt,
			turnCount: s.turnCount,
		};
	}
}

export class SaveService {
	private store = new MemorySaveStore();

	/** 保存游戏 */
	async saveGame(state: GameRoomState, roomId: string, name: string): Promise<string> {
		const save = serializeGameSave(state, roomId, name);
		await this.store.save(save);
		return save.id;
	}

	/** 加载游戏 */
	async loadGame(state: GameRoomState, saveId: string): Promise<boolean> {
		const save = await this.store.load(saveId);
		return this.applySave(state, save);
	}

	/** 删除存档 */
	async deleteSave(saveId: string): Promise<void> {
		await this.store.delete(saveId);
	}

	/** 获取存档列表 */
	async listSaves(): Promise<SaveSummary> {
		return this.store.list();
	}

	/** 检查存档是否存在 */
	async exists(saveId: string): Promise<boolean> {
		return this.store.exists(saveId);
	}

	/** 导出存档（用于客户端下载） */
	async exportSave(saveId: string): Promise<GameSave> {
		return this.store.load(saveId);
	}

	/** 导入存档 */
	async importSave(saveData: GameSave): Promise<string> {
		if (!saveData.id || !saveData.name) {
			throw new Error("无效的存档数据");
		}
		await this.store.save(saveData);
		return saveData.id;
	}

	/** 应用存档到游戏状态 */
	private applySave(state: GameRoomState, save: GameSave): boolean {
		// 验证枚举值
		const isEnumValue = <T extends Record<string, string>>(
			enumObj: T,
			value: unknown
		): value is T[keyof T] => Object.values(enumObj).includes(value as T[keyof T]);

		state.currentPhase = isEnumValue(GamePhase, save.currentPhase)
			? save.currentPhase
			: GamePhase.DEPLOYMENT;
		state.turnCount = save.turnCount;
		state.activeFaction = isEnumValue(Faction, save.activeFaction)
			? save.activeFaction
			: Faction.PLAYER;

		// 清除并重建舰船
		state.ships.clear();
		save.ships.forEach((s) => state.ships.set(s.id, deserializeShipSave(s)));

		return true;
	}
}

export const saveService = new SaveService();