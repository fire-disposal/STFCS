/**
 * 存档服务
 *
 * 职责：
 * - 封装存档存储逻辑
 * - 提供存档 CRUD 接口
 * - 序列化/反序列化游戏状态
 *
 * 存储：默认内存存储，可选文件存储
 */

import { serializeGameSave, deserializeShipSave } from "../schema/GameSave.js";
import { GAME_SAVE_VERSION, SAVE_DIR, MAX_SAVES_PER_ROOM } from "../schema/constants.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import { GamePhase, Faction } from "@vt/data";
import type { GameSave, SaveMetadata, SaveSummary } from "../schema/types.js";
import * as fs from "fs";
import * as path from "path";

/**
 * 内存存档存储
 */
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
				description: s.description,
				createdAt: s.createdAt,
				updatedAt: s.updatedAt,
				turnCount: s.turnCount,
			}))
			.sort((a, b) => b.updatedAt - a.updatedAt);
		return { saves, total: saves.length };
	}
}

/**
 * 文件存档存储（可选）
 *
 * 存档格式：JSON 文件，存储在 SAVE_DIR 目录
 */
class FileSaveStore {
	private saveDir: string;

	constructor(saveDir: string = SAVE_DIR) {
		this.saveDir = saveDir;
		this.ensureDir();
	}

	private ensureDir(): void {
		if (!fs.existsSync(this.saveDir)) {
			fs.mkdirSync(this.saveDir, { recursive: true });
		}
	}

	private getFilePath(id: string): string {
		return path.join(this.saveDir, `${id}.json`);
	}

	async save(data: GameSave): Promise<void> {
		const filePath = this.getFilePath(data.id);
		const json = JSON.stringify(data, null, 2);
		await fs.promises.writeFile(filePath, json, "utf-8");
	}

	async load(id: string): Promise<GameSave> {
		const filePath = this.getFilePath(id);
		if (!fs.existsSync(filePath)) {
			throw new Error(`存档不存在: ${id}`);
		}
		const json = await fs.promises.readFile(filePath, "utf-8");
		return JSON.parse(json) as GameSave;
	}

	async delete(id: string): Promise<void> {
		const filePath = this.getFilePath(id);
		if (fs.existsSync(filePath)) {
			await fs.promises.unlink(filePath);
		}
	}

	async exists(id: string): Promise<boolean> {
		return fs.existsSync(this.getFilePath(id));
	}

	async list(): Promise<SaveSummary> {
		const files = await fs.promises.readdir(this.saveDir);
		const saves: SaveMetadata[] = [];

		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const filePath = path.join(this.saveDir, file);
				const json = await fs.promises.readFile(filePath, "utf-8");
				const save = JSON.parse(json) as GameSave;
				saves.push({
					id: save.id,
					name: save.name,
					description: save.description,
					createdAt: save.createdAt,
					updatedAt: save.updatedAt,
					turnCount: save.turnCount,
				});
			} catch {
				// 忽略无效存档
			}
		}

		saves.sort((a, b) => b.updatedAt - a.updatedAt);
		return { saves, total: saves.length };
	}
}

/**
 * 存档服务
 */
export class SaveService {
	private useFileStorage: boolean;
	private store: MemorySaveStore | FileSaveStore;

	constructor(useFileStorage: boolean = false) {
		this.useFileStorage = useFileStorage;
		this.store = useFileStorage ? new FileSaveStore() : new MemorySaveStore();
	}

	/**
	 * 保存游戏
	 *
	 * @param state 游戏状态
	 * @param roomId 房间 ID
	 * @param name 存档名称
	 * @param description 存档描述
	 * @returns 存档 ID
	 */
	async saveGame(
		state: GameRoomState,
		roomId: string,
		name?: string,
		description?: string
	): Promise<string> {
		const saveName = name || `存档_${state.turnCount}`;
		const save = serializeGameSave(state, roomId, saveName, description);
		await this.store.save(save);
		return save.id;
	}

	/**
	 * 加载游戏
	 *
	 * @param state 游戏状态（目标）
	 * @param saveId 存档 ID
	 * @returns 是否成功加载
	 */
	async loadGame(state: GameRoomState, saveId: string): Promise<boolean> {
		const save = await this.store.load(saveId);

		// 版本兼容性检查
		if (save.version && save.version !== GAME_SAVE_VERSION) {
			console.warn(`存档版本不匹配: ${save.version} vs ${GAME_SAVE_VERSION}`);
		}

		return this.applySave(state, save);
	}

	/**
	 * 删除存档
	 */
	async deleteSave(saveId: string): Promise<void> {
		await this.store.delete(saveId);
	}

	/**
	 * 获取存档列表
	 */
	async listSaves(): Promise<SaveSummary> {
		return this.store.list();
	}

	/**
	 * 检查存档是否存在
	 */
	async exists(saveId: string): Promise<boolean> {
		return this.store.exists(saveId);
	}

	/**
	 * 导出存档（用于客户端下载）
	 */
	async exportSave(saveId: string): Promise<GameSave> {
		return this.store.load(saveId);
	}

	/**
	 * 导入存档
	 */
	async importSave(saveData: GameSave): Promise<string> {
		if (!saveData.id || !saveData.name) {
			throw new Error("无效的存档数据");
		}

		// 更新时间戳
		saveData.updatedAt = Date.now();
		if (!saveData.version) {
			saveData.version = GAME_SAVE_VERSION;
		}

		await this.store.save(saveData);
		return saveData.id;
	}

	/**
	 * 应用存档到游戏状态
	 */
	private applySave(state: GameRoomState, save: GameSave): boolean {
		// 验证枚举值
		const isEnumValue = <T extends Record<string, string>>(
			enumObj: T,
			value: unknown
		): value is T[keyof T] => Object.values(enumObj).includes(value as T[keyof T]);

		// 恢复游戏阶段
		state.currentPhase = isEnumValue(GamePhase, save.currentPhase)
			? save.currentPhase
			: GamePhase.DEPLOYMENT;
		state.turnCount = save.turnCount;
		state.activeFaction = isEnumValue(Faction, save.activeFaction)
			? save.activeFaction
			: Faction.PLAYER;

		// 恢复地图尺寸
		state.mapWidth = save.mapWidth;
		state.mapHeight = save.mapHeight;

		// 清除并重建舰船
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

	/**
	 * 获取存档元数据
	 */
	async getSaveMetadata(saveId: string): Promise<SaveMetadata | undefined> {
		try {
			const save = await this.store.load(saveId);
			return {
				id: save.id,
				name: save.name,
				description: save.description,
				createdAt: save.createdAt,
				updatedAt: save.updatedAt,
				turnCount: save.turnCount,
			};
		} catch {
			return undefined;
		}
	}

	/**
	 * 切换存储模式
	 *
	 * @param useFileStorage 是否使用文件存储
	 */
	setStorageMode(useFileStorage: boolean): void {
		this.useFileStorage = useFileStorage;
		this.store = useFileStorage ? new FileSaveStore() : new MemorySaveStore();
	}
}

// 默认使用内存存储
export const saveService = new SaveService(false);