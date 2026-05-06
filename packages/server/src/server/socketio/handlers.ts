/**
 * RPC Handlers — 薄组合层，各个 namespace handler 分散到 handlers/ 目录
 */
import { createRpcRegistry } from "./RpcServer.js";
import { err } from "./handlers/err.js";
import { editHandlers } from "./handlers/edit.js";
import { deployHandlers } from "./handlers/deploy.js";
import { roomHandlers } from "./handlers/room.js";
import { customizeHandlers } from "./handlers/customize.js";
import { gameHandlers } from "./handlers/game.js";
import {
	playerInfoService,
	playerProfileService,
	presetService,
	assetService,
} from "./handlers/services.js";
import { PlayerRole, ErrorCodes, createBattleLogEvent } from "@vt/data";
import type { WsPayload, PlayerInfo } from "@vt/data";
import { generateShortId } from "../utils/shortId.js";

export const rpc = createRpcRegistry();

// ===== 导入的大 namespace =====
rpc.namespace("edit", editHandlers);
rpc.namespace("deploy", deployHandlers);
rpc.namespace("room", roomHandlers);
rpc.namespace("customize", customizeHandlers);
rpc.namespace("game", gameHandlers);

// ===== auth =====
rpc.namespace("auth", {
	login: async (payload: unknown, ctx) => {
		const p = payload as WsPayload<"auth:login">;
		let result = await playerInfoService.findByUsername(p.playerName);
		let playerId: string;

		if (result) {
			playerId = result.file.info.playerId;
			await playerInfoService.updateInfo(playerId, { lastLogin: Date.now() });
		} else {
			// 读取所有已存在的 ID，确保新生成的短数字 ID 不重复
			const existingIds = await playerInfoService.getAllPlayerIds();
			playerId = generateShortId(existingIds);
			await playerInfoService.create(p.playerName, playerId);
		}

		ctx.socket.data.playerId = playerId;
		ctx.socket.data.playerName = p.playerName;
		await playerProfileService.createAccount(playerId, p.playerName);
		return { playerId, playerName: p.playerName, isHost: false, role: PlayerRole.PLAYER };
	},
	logout: async (_, ctx) => {
		if (ctx.roomId) {
			ctx.state.removePlayer(ctx.playerId);
			ctx.roomManager.leaveRoom(ctx.roomId, ctx.playerId);
		}
		ctx.socket.data.playerId = undefined;
		ctx.socket.data.playerName = undefined;
	},
});

// ===== profile =====
rpc.namespace("profile", {
	get: async (_, ctx) => {
		ctx.requireAuth();
		const result = await playerInfoService.findByPlayerId(ctx.playerId);
		if (!result) throw err("玩家信息不存在", ErrorCodes.PROFILE_NOT_FOUND);
		const info = result.file.info;
		return {
			profile: { playerId: info.playerId, nickname: info.displayName, avatar: info.avatar },
		};
	},
	update: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"profile:update">;
		const patch: Partial<PlayerInfo> = {};
		if (p.nickname !== undefined) patch.displayName = p.nickname;
		if (p.avatar !== undefined) patch.avatar = p.avatar;
		const updated = await playerInfoService.updateInfo(ctx.playerId, patch);
		if (!updated) throw err("更新失败", ErrorCodes.UPDATE_FAILED);

		if (ctx.roomId) {
			const room = ctx.roomManager.getRoom(ctx.roomId);
			if (room) {
				const stateUpdates: { nickname?: string; avatar?: string; avatarAssetId?: string } = {};
				if (p.nickname !== undefined) stateUpdates.nickname = p.nickname;
				if (p.avatar !== undefined) stateUpdates.avatar = p.avatar;
				if (p.avatarAssetId !== undefined) stateUpdates.avatarAssetId = p.avatarAssetId;
				room.getStateManager().updatePlayer(ctx.playerId, stateUpdates);
			}
		}

		return {
			profile: {
				playerId: updated.playerId,
				nickname: updated.displayName,
				avatar: updated.avatar,
			},
		};
	},
});

// ===== save =====
rpc.namespace("save", {
	action: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"save:action">;

		switch (p.action) {
			case "list": {
				const saves = await playerProfileService.listSaves(ctx.playerId);
				return { saves };
			}
			case "create": {
				if (!p.name) throw err("需要 name", ErrorCodes.NAME_REQUIRED);
				ctx.requireRoom();
				const snapshot = ctx.room!.getGameState();
				const save = await playerProfileService.createSave(ctx.playerId, p.name, snapshot);
				return { save };
			}
			case "load": {
				ctx.requireRoom();
				ctx.requireHost();
				if (!p.saveId) throw err("需要 saveId", ErrorCodes.SAVE_ID_REQUIRED);
				const saves = await playerProfileService.listSaves(ctx.playerId);
				const save = saves.find((s) => s.$id === p.saveId);
				if (!save) throw err("存档不存在", ErrorCodes.SAVE_NOT_FOUND);
				const snapshot = save.snapshot;
				const currentState = ctx.state.getState();
				ctx.state.loadSnapshot({
					...snapshot,
					players: {},
					roomId: currentState.roomId,
					ownerId: currentState.ownerId,
					createdAt: currentState.createdAt,
				});
				ctx.state.appendLog(
					createBattleLogEvent("game_reload", {
						playerId: ctx.playerId,
						playerName: ctx.playerName,
						saveId: p.saveId,
						saveName: save.metadata?.name ?? p.saveId,
					})
				);
				return;
			}
			case "delete": {
				if (!p.saveId) throw err("需要 saveId", ErrorCodes.SAVE_ID_REQUIRED);
				const success = await playerInfoService.deleteRoomSave(ctx.playerId, p.saveId);
				if (!success) throw err("存档不存在", ErrorCodes.SAVE_NOT_FOUND);
				return;
			}
			default:
				throw err("未知操作", ErrorCodes.UNKNOWN_ACTION);
		}
	},
});

// ===== asset =====
rpc.namespace("asset", {
	upload: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"asset:upload">;
		const options: { name?: string; description?: string; tags?: string[] } = {};
		if (p.name !== undefined) options.name = p.name;
		if (p.description !== undefined) options.description = p.description;
		const asset = await assetService.uploadAsset(
			ctx.playerId,
			p.type,
			p.filename,
			p.mimeType,
			Buffer.from(p.data, "base64"),
			options
		);
		return { assetId: asset.$id };
	},
	action: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"asset:action">;
		switch (p.action) {
			case "list": {
				const assets = await assetService.listAssets(p.type, p.ownerId ?? ctx.playerId);
				return { assets };
			}
			case "batch_get": {
				if (!p.assetIds || p.assetIds.length === 0)
					throw err("需要 assetIds", ErrorCodes.ASSET_IDS_REQUIRED);
				const results = await assetService.batchGetAssets(p.assetIds, p.includeData);
				return { results };
			}
			case "delete": {
				if (!p.assetId) throw err("需要 assetId", ErrorCodes.ASSET_ID_REQUIRED);
				const success = await assetService.deleteAsset(p.assetId);
				if (!success) throw err("删除失败", ErrorCodes.ASSET_DELETE_FAILED);
				return;
			}
			default:
				throw err("未知操作", ErrorCodes.UNKNOWN_ACTION);
		}
	},
});

// ===== preset =====
rpc.namespace("preset", {
	list_tokens: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"preset:list_tokens">;
		let presets;
		if (p.size) presets = await presetService.getShipPresetsBySize(p.size);
		else if (p.class) presets = await presetService.getShipPresetsByClass(p.class);
		else presets = await presetService.getShipPresets();
		return { presets };
	},
	list_weapons: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"preset:list_weapons">;
		let presets;
		if (p.size) presets = await presetService.getWeaponPresetsBySize(p.size);
		else if (p.damageType) presets = await presetService.getWeaponPresetsByDamageType(p.damageType);
		else presets = await presetService.getWeaponPresets();
		return { presets };
	},
	get_token: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"preset:get_token">;
		const preset = await presetService.getShipPresetById(p.presetId);
		if (!preset) throw err("预设舰船不存在", ErrorCodes.PRESET_NOT_FOUND);
		return { preset };
	},
	get_weapon: async (payload: unknown, ctx) => {
		ctx.requireAuth();
		const p = payload as WsPayload<"preset:get_weapon">;
		const preset = await presetService.getWeaponPresetById(p.presetId);
		if (!preset) throw err("预设武器不存在", ErrorCodes.PRESET_NOT_FOUND);
		return { preset };
	},
});

// ===== sync =====
rpc.on("sync:request_full", async (_, ctx) => {
	ctx.requireRoom();
	if (!ctx.room) throw err("房间不存在", ErrorCodes.ROOM_NOT_FOUND);
	return ctx.room.getGameState();
});

// ===== setup =====
export function setupSocketIO(io: any, roomManager: any): void {
	const services = {
		playerProfile: playerProfileService,
		playerInfo: playerInfoService,
		shipBuild: null as any,
		weapon: null as any,
		preset: presetService,
		asset: assetService,
	};
	const middleware = rpc.createMiddleware();

	roomManager.setOnRoomRemove(async (room: any, roomId: string) => {
		const gameState = room.getGameState();
		const creatorId = room.creatorId;
		const tokenCount = Object.keys(gameState?.tokens ?? {}).length;

		if (gameState && creatorId && tokenCount > 0) {
			const archiveId = `save_${roomId}_${Date.now()}`;
			const archive = {
				id: archiveId,
				name: room.name,
				saveJson: gameState,
				metadata: {
					roomId,
					roomName: room.name,
					mapWidth: gameState.map?.size?.width ?? 2000,
					mapHeight: gameState.map?.size?.height ?? 2000,
					maxPlayers: room.maxPlayers,
					playerCount: Object.keys(gameState.players ?? {}).length,
					totalTurns: gameState.turnCount ?? 0,
					gameDuration: Date.now() - room.createdAt,
				},
				playerIds: Object.keys(gameState.players ?? {}),
				isAutoSave: true,
				tags:
					gameState.turnCount > 0
						? ["auto_cleanup", "game_played"]
						: ["auto_cleanup", "deployment"],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			await playerInfoService.addRoomSave(creatorId, archive);
			console.log(
				`[RoomManager] Auto-saved room ${roomId} (tokens: ${tokenCount}, turns: ${gameState.turnCount}) to creator ${creatorId}`
			);
		}

		io.emit("room:list_updated", { action: "removed", roomId });
	});

	io.on("connection", (socket: any) => {
		middleware(socket, io, roomManager, services);

		socket.on("disconnect", () => {
			const sd = socket.data as { playerId?: string; roomId?: string; role?: string };
			if (sd.roomId && sd.playerId) {
				roomManager.disconnectPlayer(sd.roomId, sd.playerId);
			}
			socket.data.roomId = undefined;
			socket.data.role = undefined;
		});
	});
}
