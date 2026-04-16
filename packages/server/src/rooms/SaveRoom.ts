/**
 * 存档管理房间
 *
 * 使用 SaveService 处理存档操作
 */

import { Room, Client } from "@colyseus/core";
import type { GameSave } from "../schema/types.js";
import { saveService } from "../services/SaveService.js";
import { toSaveDetailDto } from "../dto/saveDto.js";

export class SaveRoom extends Room {
	maxClients = 50;
	autoDispose = true;

	async onCreate(): Promise<void> {
		console.log("[SaveRoom] Created:", this.roomId);

		this.onMessage("SAVE_LIST_REQUEST", (client: Client) => {
			this.handleListSaves(client);
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
			const summary = await saveService.listSaves();
			client.send("SAVE_LIST_RESPONSE", { saves: summary.saves });
		} catch (error) {
			client.send("ERROR", {
				code: "SAVE_LIST_ERROR",
				message: error instanceof Error ? error.message : "获取存档列表失败",
			});
		}
	}

	private async handleLoadGame(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object" || !("id" in payload)) {
				throw new Error("缺少 id");
			}

			const id = (payload as { id: string }).id;
			const save = await saveService.exportSave(id);
			client.send("SAVE_LOAD_RESPONSE", { save: toSaveDetailDto(save) });
		} catch (error) {
			client.send("ERROR", {
				code: "LOAD_ERROR",
				message: error instanceof Error ? error.message : "加载失败",
			});
		}
	}

	private async handleDeleteSave(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object" || !("id" in payload)) {
				throw new Error("缺少 id");
			}

			const id = (payload as { id: string }).id;
			await saveService.deleteSave(id);
			client.send("SAVE_DELETE_RESPONSE", { success: true });
		} catch (error) {
			client.send("ERROR", {
				code: "DELETE_ERROR",
				message: error instanceof Error ? error.message : "删除失败",
			});
		}
	}

	private async handleExportSave(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object" || !("id" in payload)) {
				throw new Error("缺少 id");
			}

			const id = (payload as { id: string }).id;
			const save = await saveService.exportSave(id);
			client.send("SAVE_EXPORT_RESPONSE", { success: true, save: toSaveDetailDto(save) });
		} catch (error) {
			client.send("ERROR", {
				code: "EXPORT_ERROR",
				message: error instanceof Error ? error.message : "导出失败",
			});
		}
	}

	private async handleImportSave(client: Client, payload: unknown): Promise<void> {
		try {
			const saveData = payload as GameSave;

			if (!saveData.id || !saveData.name) {
				throw new Error("无效的存档数据");
			}

			const id = await saveService.importSave(saveData);
			client.send("SAVE_IMPORT_RESPONSE", { success: true, id });
		} catch (error) {
			client.send("ERROR", {
				code: "IMPORT_ERROR",
				message: error instanceof Error ? error.message : "导入失败",
			});
		}
	}
}