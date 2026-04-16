/**
 * 存档 DTO 转换器
 */

import type { GameSave, SaveMetadata, SaveSummary } from "../schema/types.js";

export const toSaveMetadataDto = (save: GameSave): SaveMetadata => ({
	id: save.id,
	name: save.name,
	createdAt: save.createdAt,
	updatedAt: save.updatedAt,
	turnCount: save.turnCount,
});

export const toSaveListDto = (saves: GameSave[]): SaveSummary => ({
	saves: saves.map(toSaveMetadataDto),
	total: saves.length,
});

export const toSaveDetailDto = (save: GameSave): GameSave => ({
	id: save.id,
	name: save.name,
	createdAt: save.createdAt,
	updatedAt: save.updatedAt,
	turnCount: save.turnCount,
	currentPhase: save.currentPhase,
	activeFaction: save.activeFaction,
	ships: save.ships,
	mapWidth: save.mapWidth,
	mapHeight: save.mapHeight,
});