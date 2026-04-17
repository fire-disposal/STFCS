/**
 * 存档服务 (基于 SQLite)
 *
 * 职责：
 * - 封装存档存储逻辑
 * - 提供存档 CRUD 接口
 * - 序列化/反序列化游戏状态
 */

import { serializeGameSave, deserializeShipSave } from "../schema/GameSave.js";
import { GAME_SAVE_VERSION } from "../schema/constants.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import { GamePhase, Faction } from "@vt/data";
import type { GameSave, SaveMetadata, SaveSummary } from "../schema/types.js";
import { persistence } from "./PersistenceManager.js";

export class SaveService {
/**
 * 保存游戏
 */
async saveGame(
state: GameRoomState,
roomId: string,
name?: string,
description?: string
): Promise<string> {
const saveName = name || `存档_${state.turnCount}`;
const saveData = serializeGameSave(state, roomId, saveName, description);

await persistence.saves.save(saveData.id, saveData);

return saveData.id;
}

/**
 * 加载游戏
 */
async loadGame(state: GameRoomState, saveId: string): Promise<boolean> {
const saveData = await persistence.saves.get(saveId);
if (!saveData) return false;

// 版本兼容性检查
if (saveData.version && saveData.version !== GAME_SAVE_VERSION) {
console.warn(`存档版本不匹配: ${saveData.version} vs ${GAME_SAVE_VERSION}`);
}

return this.applySave(state, saveData);
}

/**
 * 删除存档
 */
async deleteSave(saveId: string): Promise<void> {
await persistence.saves.delete(saveId);
}

/**
 * 获取存档列表
 */
async listSaves(): Promise<SaveSummary> {
const saves = await persistence.saves.list();
return { saves, total: saves.length };
}

	/**
	 * 获取存档元数据
	 */
	async getSaveMetadata(saveId: string): Promise<SaveMetadata | undefined> {
		const saveData = await persistence.saves.get(saveId);
		if (!saveData) return undefined;
		return {
			id: saveData.id,
			name: saveData.name,
			description: saveData.description,
			createdAt: saveData.createdAt,
			updatedAt: saveData.updatedAt,
			turnCount: saveData.turnCount,
		};
	}

	/**
	 * 导出存档数据
	 */
	async exportSave(saveId: string): Promise<GameSave> {
		const saveData = await persistence.saves.get(saveId);
		if (!saveData) {
			throw new Error(`存档 ${saveId} 不存在`);
		}
		return saveData;
	}

	/**
	 * 导入存档数据
	 */
	async importSave(saveData: GameSave): Promise<string> {
		if (!saveData.id || !saveData.name) {
			throw new Error("无效的存档数据结构");
		}
		await persistence.saves.save(saveData.id, saveData);
		return saveData.id;
	}

	/**
	 * 应用存档到游戏状态
	 */
private applySave(state: GameRoomState, save: GameSave): boolean {
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

state.mapWidth = save.mapWidth;
state.mapHeight = save.mapHeight;

state.ships.clear();
save.ships.forEach((s) => {
try {
const ship = deserializeShipSave(s);
state.ships.set(s.id, ship);
} catch (err) {
console.error(`反序列化舰船 ${s.id} 失败:`, err);
}
});

return true;
}
}

export const saveService = new SaveService();