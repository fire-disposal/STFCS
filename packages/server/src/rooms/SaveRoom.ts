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

	private handleRoomError(client: Client, code: string, error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		client.send("ERROR", { code, message });
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
			this.handleRoomError(client, "SAVE_LIST_ERROR", error);
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
			this.handleRoomError(client, "LOAD_ERROR", error);
		}
	}

	private async handleDeleteSave(client: Client, payload: unknown): Promise<void> {
		try {
			if (!payload || typeof payload !== "object" || !("id" in payload)) {
				throw new Error("缺少 id");
			}

			const id = (payload as { id: string }).id;
			await saveService.deleteSave(id);
			client.send("SAVE_DELETE_RESPONSE", { success: true, id });
		} catch (error) {
			this.handleRoomError(client, "DELETE_ERROR", error);
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
			this.handleRoomError(client, "EXPORT_ERROR", error);
		}
	}

	private async handleImportSave(client: Client, payload: unknown): Promise<void> {
		try {
			const saveData = payload as GameSave;

			if (!saveData || !saveData.id || !saveData.name) {
				throw new Error("无效的存档数据");
			}

			const id = await saveService.importSave(saveData);
			client.send("SAVE_IMPORT_RESPONSE", { success: true, id });
		} catch (error) {
			this.handleRoomError(client, "IMPORT_ERROR", error);
		}
	}
}