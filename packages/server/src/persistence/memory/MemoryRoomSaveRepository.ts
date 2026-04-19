/**
 * 内存存储 - 房间战局存档 Repository
 */

import { MemoryBaseRepository } from "./MemoryBaseRepository.js";
import type { RoomArchive } from "../types.js";

/**
 * 房间战局存档 Repository（内存实现）
 */
export class MemoryRoomSaveRepository extends MemoryBaseRepository<RoomArchive> {
	/**
	 * 根据房间 ID 查找存档
	 */
	async findByRoomId(roomId: string): Promise<RoomArchive[]> {
		return Array.from(this.storage.values()).filter(
			(r) => r.metadata.roomId === roomId
		);
	}

	/**
	 * 查找参与者的存档
	 */
	async findByPlayerId(playerId: string): Promise<RoomArchive[]> {
		return Array.from(this.storage.values()).filter((r) =>
			r.playerIds.includes(playerId)
		);
	}

	/**
	 * 查找自动存档
	 */
	async findAutoSaves(roomId: string): Promise<RoomArchive[]> {
		return Array.from(this.storage.values()).filter(
			(r) => r.metadata.roomId === roomId && r.isAutoSave
		);
	}

	/**
	 * 查找手动存档
	 */
	async findManualSaves(roomId: string): Promise<RoomArchive[]> {
		return Array.from(this.storage.values()).filter(
			(r) => r.metadata.roomId === roomId && !r.isAutoSave
		);
	}

	/**
	 * 获取最新的存档
	 */
	async findLatest(roomId: string): Promise<RoomArchive | null> {
		const saves = await this.findByRoomId(roomId);
		if (saves.length === 0) return null;

		return saves.reduce((latest, current) =>
			current.createdAt > latest.createdAt ? current : latest
		);
	}

	/**
	 * 按名称搜索存档
	 */
	async searchByName(name: string): Promise<RoomArchive[]> {
		const lower = name.toLowerCase();
		return Array.from(this.storage.values()).filter((r) =>
			r.name.toLowerCase().includes(lower)
		);
	}
}
