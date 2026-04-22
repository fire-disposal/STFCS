import type { RoomArchive } from "../types.js";
import { FileBaseRepository } from "./FileBaseRepository.js";

export class FileRoomSaveRepository extends FileBaseRepository<RoomArchive> {
	constructor() {
		super("saves");
	}

	protected getFileName(entity: RoomArchive): string {
		const playerId = entity.playerIds[0] ?? "unknown";
		return `${playerId}.json`;
	}

	protected extractPlayerId(entity: RoomArchive): string {
		return entity.playerIds[0] ?? "unknown";
	}

	async findByPlayerId(playerId: string): Promise<RoomArchive[]> {
		return Array.from(this.storage.values()).filter(
			(save) => save.playerIds.includes(playerId)
		);
	}
}