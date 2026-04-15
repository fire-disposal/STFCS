/**
 * 存档服务 - WebSocket 版本
 *
 * 通过 WebSocket 与 SaveRoom 通信，处理所有存档相关操作：
 * - 获取存档列表
 * - 保存游戏
 * - 加载游戏
 * - 删除存档
 * - 导入/导出存档
 */

import { Client, Room } from "@colyseus/sdk";
import type {
	GameSave,
	SaveSummary,
	SaveListResponse,
	SaveGameResponse,
	SaveLoadResponse,
	SaveDeleteResponse,
	SaveExportResponse,
	SaveImportResponse,
} from "@vt/types";

export class SaveService {
	private client: Client;
	private saveRoom: Room | null = null;
	private messageHandlers = new Map<string, Set<(payload: unknown) => void>>();
	private connectPromise: Promise<void> | null = null;

	constructor(client: Client) {
		this.client = client;
	}

	/**
	 * 连接到存档房间
	 */
	async connect(): Promise<void> {
		if (this.saveRoom) {
			return;
		}

		if (this.connectPromise) {
			return this.connectPromise;
		}

		this.connectPromise = (async () => {
			try {
				this.saveRoom = await this.client.joinOrCreate("system_save");
				this.setupMessageHandlers();
				console.log("[SaveService] Connected to SaveRoom");
			} catch (error) {
				console.error("[SaveService] Failed to connect to SaveRoom:", error);
				throw error;
			} finally {
				this.connectPromise = null;
			}
		})();

		return this.connectPromise;
	}

	/**
	 * 设置消息处理器
	 */
	private setupMessageHandlers(): void {
		if (!this.saveRoom) return;

		const setupHandler = (type: string) => {
			this.saveRoom!.onMessage(type, (payload: unknown) => {
				this.emit(type, payload);
			});
		};

		setupHandler("SAVE_LIST_RESPONSE");
		setupHandler("SAVE_GAME_RESPONSE");
		setupHandler("SAVE_LOAD_RESPONSE");
		setupHandler("SAVE_DELETE_RESPONSE");
		setupHandler("SAVE_EXPORT_RESPONSE");
		setupHandler("SAVE_IMPORT_RESPONSE");
		setupHandler("ERROR");
	}

	/**
	 * 获取存档列表
	 */
	async listSaves(): Promise<SaveSummary[]> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const timeoutMs = 10000;

			const handler = (payload: unknown) => {
				if (payload && typeof payload === "object" && "saves" in payload) {
					resolve((payload as SaveListResponse).saves);
				} else {
					reject(new Error("无效的存档列表"));
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as { code: string; message: string };
				reject(new Error(error.message || "获取存档列表失败"));
			};

			this.once("SAVE_LIST_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.saveRoom!.send("SAVE_LIST_REQUEST");

			// 超时处理
			setTimeout(() => {
				this.off("SAVE_LIST_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				if (!this.saveRoom) {
					reject(new Error("连接已断开"));
				}
			}, timeoutMs);
		});
	}

	/**
	 * 保存游戏
	 */
	async saveGame(save: GameSave): Promise<void> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const handler = (payload: unknown) => {
				if (payload && typeof payload === "object" && "success" in payload) {
					const response = payload as SaveGameResponse;
					if (response.success) {
						resolve();
					} else {
						reject(new Error(response.message || "保存失败"));
					}
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as { code: string; message: string };
				reject(new Error(error.message || "保存失败"));
			};

			this.once("SAVE_GAME_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.saveRoom!.send("SAVE_GAME_REQUEST", save);

			setTimeout(() => {
				this.off("SAVE_GAME_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				reject(new Error("保存超时"));
			}, 10000);
		});
	}

	/**
	 * 加载游戏
	 */
	async loadGame(saveId: string): Promise<GameSave> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const handler = (payload: unknown) => {
				if (payload && typeof payload === "object" && "save" in payload) {
					resolve((payload as SaveLoadResponse).save);
				} else {
					reject(new Error("无效的存档数据"));
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as { code: string; message: string };
				reject(new Error(error.message || "加载失败"));
			};

			this.once("SAVE_LOAD_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.saveRoom!.send("SAVE_LOAD_REQUEST", { saveId });

			setTimeout(() => {
				this.off("SAVE_LOAD_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				reject(new Error("加载超时"));
			}, 10000);
		});
	}

	/**
	 * 删除存档
	 */
	async deleteSave(saveId: string): Promise<void> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const handler = (payload: unknown) => {
				if (payload && typeof payload === "object" && "success" in payload) {
					const response = payload as SaveDeleteResponse;
					if (response.success) {
						resolve();
					} else {
						reject(new Error(response.message || "删除失败"));
					}
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as { code: string; message: string };
				reject(new Error(error.message || "删除失败"));
			};

			this.once("SAVE_DELETE_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.saveRoom!.send("SAVE_DELETE_REQUEST", { saveId });

			setTimeout(() => {
				this.off("SAVE_DELETE_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				reject(new Error("删除超时"));
			}, 10000);
		});
	}

	/**
	 * 导出存档（获取存档数据）
	 */
	async exportSave(saveId: string): Promise<GameSave> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const handler = (payload: unknown) => {
				if (payload && typeof payload === "object" && "save" in payload) {
					const response = payload as SaveExportResponse;
					if (response.success) {
						resolve(response.save);
					} else {
						reject(new Error("导出失败"));
					}
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as { code: string; message: string };
				reject(new Error(error.message || "导出失败"));
			};

			this.once("SAVE_EXPORT_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.saveRoom!.send("SAVE_EXPORT_REQUEST", { saveId });

			setTimeout(() => {
				this.off("SAVE_EXPORT_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				reject(new Error("导出超时"));
			}, 10000);
		});
	}

	/**
	 * 导入存档（保存存档数据）
	 */
	async importSave(save: GameSave): Promise<string> {
		await this.ensureConnected();

		return new Promise((resolve, reject) => {
			const handler = (payload: unknown) => {
				if (payload && typeof payload === "object" && "success" in payload) {
					const response = payload as SaveImportResponse;
					if (response.success) {
						resolve(response.saveId);
					} else {
						reject(new Error(response.message || "导入失败"));
					}
				}
			};

			const errorHandler = (payload: unknown) => {
				const error = payload as { code: string; message: string };
				reject(new Error(error.message || "导入失败"));
			};

			this.once("SAVE_IMPORT_RESPONSE", handler);
			this.once("ERROR", errorHandler);
			this.saveRoom!.send("SAVE_IMPORT_REQUEST", save);

			setTimeout(() => {
				this.off("SAVE_IMPORT_RESPONSE", handler);
				this.off("ERROR", errorHandler);
				reject(new Error("导入超时"));
			}, 10000);
		});
	}

	/**
	 * 断开连接
	 */
	disconnect(): void {
		if (this.saveRoom) {
			this.saveRoom.leave();
			this.saveRoom = null;
			this.messageHandlers.clear();
			console.log("[SaveService] Disconnected from SaveRoom");
		}
	}

	/**
	 * 确保已连接
	 */
	private async ensureConnected(): Promise<void> {
		if (!this.saveRoom) {
			await this.connect();
		}
	}

	/**
	 * 事件发射器辅助方法
	 */
	private emit(type: string, payload: unknown): void {
		const handlers = this.messageHandlers.get(type);
		handlers?.forEach((h) => h(payload));
	}

	private once(type: string, handler: (payload: unknown) => void): void {
		const wrapped = (payload: unknown) => {
			handler(payload);
			this.off(type, wrapped);
		};
		this.on(type, wrapped);
	}

	private on(type: string, handler: (payload: unknown) => void): void {
		if (!this.messageHandlers.has(type)) {
			this.messageHandlers.set(type, new Set());
		}
		this.messageHandlers.get(type)!.add(handler);
	}

	private off(type: string, handler: (payload: unknown) => void): void {
		this.messageHandlers.get(type)?.delete(handler);
	}
}
