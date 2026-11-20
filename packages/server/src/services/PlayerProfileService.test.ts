import { describe, expect, it } from "vitest";
import type { GameRoomState, RoomArchive } from "@vt/data";
import type { PlayerInfoService } from "./PlayerInfoService.js";
import { PlayerProfileService } from "./PlayerProfileService.js";

// 旧存档：saveJson 直接是房间状态，没有 GameSave 包装
const legacySaveJson = {
	roomId: "room_legacy",
	phase: "FACTION_ACTION",
	turnCount: 3,
	players: {},
	tokens: { "ship:1": {} },
	createdAt: 1_700_000_000_000,
} as unknown as GameRoomState;

const legacyArchive = {
	$id: "save_room_legacy_123",
	name: "旧档",
	saveJson: legacySaveJson as unknown,
	metadata: {
		roomId: "room_legacy",
		roomName: "旧档",
		mapWidth: 2000,
		mapHeight: 2000,
		maxPlayers: 4,
		playerCount: 1,
		totalTurns: 3,
		gameDuration: 1000,
	},
	playerIds: ["#001"],
	isAutoSave: true,
	tags: [],
	createdAt: 1_700_000_000_000,
	updatedAt: 1_700_000_000_000,
} as unknown as RoomArchive;

const stubPlayerInfoService = {
	getRoomSaves: async () => [legacyArchive],
} as unknown as PlayerInfoService;

describe("PlayerProfileService.listSaves", () => {
	it("把旧格式 saveJson 归一化成可载入的 GameSave", async () => {
		const service = new PlayerProfileService(stubPlayerInfoService);

		const saves = await service.listSaves("#001");

		expect(saves).toHaveLength(1);
		expect(saves[0]?.$id).toBe("save_room_legacy_123");
		expect(saves[0]?.metadata.name).toBe("旧档");
		expect(saves[0]?.snapshot.turnCount).toBe(3);
	});
});
