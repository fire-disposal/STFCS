import type { GameSave, SaveSummary } from "@vt/types";

export const toSaveSummaryDto = (summary: SaveSummary): SaveSummary => ({
	saveId: summary.saveId,
	saveName: summary.saveName,
	roomName: summary.roomName,
	playerCount: summary.playerCount,
	shipCount: summary.shipCount,
	turnCount: summary.turnCount,
	currentPhase: summary.currentPhase,
	createdAt: summary.createdAt,
	updatedAt: summary.updatedAt,
	fileSize: summary.fileSize,
});

export const toSaveListDto = (saves: SaveSummary[]): SaveSummary[] =>
	saves.map(toSaveSummaryDto);

export const toSaveDetailDto = (save: GameSave): GameSave => ({
	saveId: save.saveId,
	saveName: save.saveName,
	createdAt: save.createdAt,
	updatedAt: save.updatedAt,
	version: save.version,
	roomId: save.roomId,
	roomName: save.roomName,
	maxPlayers: save.maxPlayers,
	isPrivate: save.isPrivate,
	currentPhase: save.currentPhase,
	turnCount: save.turnCount,
	activeFaction: save.activeFaction,
	players: save.players,
	ships: save.ships,
	chatHistory: save.chatHistory,
});