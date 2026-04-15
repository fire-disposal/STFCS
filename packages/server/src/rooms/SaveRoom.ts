/**
 * 存档管理房间
 *
 * 处理所有存档相关的 WebSocket 操作：
 * - 获取存档列表
 * - 保存游戏
 * - 加载游戏
 * - 删除存档
 * - 导入/导出存档
 */

import { Room, Client } from "@colyseus/core";
import type { GameSave, SaveSummary } from "@vt/types";
import { saveStore } from "../services/SaveStore.js";
import { toSaveDetailDto, toSaveListDto } from "../dto/saveDto.js";

export class SaveRoom extends Room {
	maxClients = 50;
	autoDispose = true;

	async onCreate(): Promise<void> {
		console.log("[SaveRoom] Created:", this.roomId);

		// 注册消息处理器
		this.onMessage("SAVE_LIST_REQUEST", (client: Client) => {
			this.handleListSaves(client);
		});

		this.onMessage("SAVE_GAME_REQUEST", (client: Client, payload: unknown) => {
			this.handleSaveGame(client, payload);
		});

		this.onMessage("SAVE_LOAD_REQUEST", (client: Client, payload: unknown) => {
			this.handleLoadGame(client, payload);
		});

		this.onMessage("SAVE_DELETE_REQUEST", (client: Client, payload: unknown) => {
			this.handleDeleteSave(client, payload);
		});

		this.onMessage("SAVE_EXPORT_REQUEST", (client: Client, payload: unknown) => {
			this.handleExportSave(client, payload);
		});

		this.onMessage("SAVE_IMPORT_REQUEST", (client: Client, payload: unknown) => {
			this.handleImportSave(client, payload);
		});
	}

	onJoin(client: Client): void {
		console.log("[SaveRoom] Client joined:", client.sessionId);
	}

	onLeave(client: Client): void {
		console.log("[SaveRoom] Client left:", client.sessionId);
	}

	private async handleListSaves(client: Client): Promise<void> {
		try {
			const saves = await saveStore.list();
			client.send("SAVE_LIST_RESPONSE", { saves: toSaveListDto(saves) });
		} catch (error) {
			console.error("[SaveRoom] List saves error:", error);
			client.send("ERROR", {
				code: "SAVE_LIST_ERROR",
				message: error instanceof Error ? error.message : "获取存档列表失败",
			});
		}
	}

	private async handleSaveGame(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object") {
				throw new Error("无效的存档数据");
			}

			const saveData = payload as Record<string, unknown>;
			if (!saveData.saveId || !saveData.saveName || !saveData.roomId) {
				throw new Error("无效的存档数据：缺少必要字段");
			}

			await saveStore.save(saveData as GameSave);
			client.send("SAVE_GAME_RESPONSE", {
				success: true,
				saveId: saveData.saveId as string,
			});
		} catch (error) {
			console.error("[SaveRoom] Save game error:", error);
			client.send("ERROR", {
				code: "SAVE_ERROR",
				message: error instanceof Error ? error.message : "保存失败",
			});
		}
	}

	private async handleLoadGame(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object" || !("saveId" in payload)) {
				throw new Error("缺少 saveId");
			}

			const saveId = (payload as { saveId: string }).saveId;
			const save = await saveStore.load(saveId);
			client.send("SAVE_LOAD_RESPONSE", { save: toSaveDetailDto(save) });
		} catch (error) {
			console.error("[SaveRoom] Load game error:", error);
			client.send("ERROR", {
				code: "LOAD_ERROR",
				message: error instanceof Error ? error.message : "加载失败",
			});
		}
	}

	private async handleDeleteSave(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object" || !("saveId" in payload)) {
				throw new Error("缺少 saveId");
			}

			const saveId = (payload as { saveId: string }).saveId;
			await saveStore.delete(saveId);
			client.send("SAVE_DELETE_RESPONSE", { success: true });
		} catch (error) {
			console.error("[SaveRoom] Delete save error:", error);
			client.send("ERROR", {
				code: "DELETE_ERROR",
				message: error instanceof Error ? error.message : "删除失败",
			});
		}
	}

	private async handleExportSave(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object" || !("saveId" in payload)) {
				throw new Error("缺少 saveId");
			}

			const saveId = (payload as { saveId: string }).saveId;
			const save = await saveStore.load(saveId);
			client.send("SAVE_EXPORT_RESPONSE", {
				success: true,
				save: toSaveDetailDto(save),
			});
		} catch (error) {
			console.error("[SaveRoom] Export save error:", error);
			client.send("ERROR", {
				code: "EXPORT_ERROR",
				message: error instanceof Error ? error.message : "导出失败",
			});
		}
	}

	private async handleImportSave(client: Client, payload: unknown): Promise<void> {
		try {
			const saveData = payload as Record<string, unknown>;

			// 验证基本字段
			if (!saveData.saveId || !saveData.saveName || !saveData.roomId) {
				throw new Error("无效的存档数据：缺少必要字段");
			}

			// 保存
			await saveStore.save(saveData as GameSave);

			client.send("SAVE_IMPORT_RESPONSE", {
				success: true,
				saveId: saveData.saveId as string,
			});
		} catch (error) {
			console.error("[SaveRoom] Import save error:", error);
			client.send("ERROR", {
				code: "IMPORT_ERROR",
				message: error instanceof Error ? error.message : "导入失败",
			});
		}
	}
}
