/**
 * 统一 Socket Handler
 *
 * 全 WebSocket 方案：
 * - 所有请求带 requestId，所有响应匹配 requestId
 * - 响应格式: { requestId, success, data?, error? }
 * - 命名空间格式: {namespace}:{action}
 * - 简化权限: HOST(房主/DM) vs PLAYER
 */

import { Server as IOServer, Socket } from "socket.io";
import { createLogger } from "../../infra/simple-logger.js";
import { RoomManager } from "../rooms/RoomManager.js";
import { Room } from "../rooms/Room.js";
import { actionHandler } from "../handlers/actionHandler.js";
import { PlayerAvatarStorageService } from "../../services/PlayerAvatarStorageService.js";
import { PlayerProfileService } from "../../services/PlayerProfileService.js";
import { ShipBuildService } from "../../services/ship/ShipBuildService.js";
import { PresetService } from "../../services/preset/PresetService.js";
import { AssetService } from "../../services/AssetService.js";
import { calculateShipWeaponTargets } from "../../core/engine/rules/targeting.js";
import { persistence } from "../../persistence/PersistenceManager.js";
import {
	validateWsPayload,
	createWsResponse,
	createSyncDelta,
	deltaTokenUpdate,
	deltaTokenAdd,
	deltaTokenRemove,
	deltaPlayerLeave,
	deltaPhaseChange,
	deltaFactionTurn,
	deltaHostChange,
	deltaModifierAdd,
	deltaTurnChange,
} from "@vt/data";
import type {
	WsEventName,
	DeltaChange,
	AuthLoginPayload,
	RoomCreatePayload,
	RoomJoinPayload,
	RoomActionPayload,
	GameActionPayload,
	GameQueryPayload,
	DmSpawnPayload,
	DmModifyPayload,
	DmSetModifierPayload,
	TokenJSON,
	TokenGetPayload,
	TokenCreatePayload,
	TokenUpdatePayload,
	TokenDeletePayload,
	TokenCopyPresetPayload,
	TokenMountPayload,
	WeaponGetPayload,
	WeaponCreatePayload,
	WeaponUpdatePayload,
	WeaponDeletePayload,
	WeaponCopyPresetPayload,
	SaveCreatePayload,
	SaveLoadPayload,
	SaveDeletePayload,
	PresetListTokensPayload,
	PresetListWeaponsPayload,
	PresetGetPayload,
	WeaponJSON,
	AssetUploadPayload,
	AssetListPayload,
	AssetBatchGetPayload,
	AssetDeletePayload,
	RoomGetAssetsPayload,
} from "@vt/data";
import {
	isHost,
	isPlayer,
	requireHost,
	requireTokenControl,
	getUserRole,
} from "./permission.js";
import type { WeaponBuild } from "../../persistence/memory/MemoryWeaponRepository.js";

const logger = createLogger("unified-handler");
const playerAvatarStorage = new PlayerAvatarStorageService();
const assetService = new AssetService();

interface SocketData {
	playerId?: string;
	playerName?: string;
	roomId?: string;
	role?: "HOST" | "PLAYER";
}

function getSocketData(socket: Socket): SocketData {
	return socket.data as SocketData;
}

function sendResponse(socket: Socket, requestId: string, success: boolean, data?: unknown, error?: { code: string; message: string }): void {
	socket.emit("response", createWsResponse(requestId, success, data, error));
}

function broadcastSyncFull(io: IOServer, roomId: string, room: Room): void {
	io.to(roomId).emit("sync:full", room.getGameState());
}

function broadcastSyncDelta(io: IOServer, roomId: string, changes: DeltaChange[]): void {
	io.to(roomId).emit("sync:delta", createSyncDelta(changes));
}

function broadcastSyncEvent(io: IOServer, roomId: string, type: string, payload: unknown): void {
	io.to(roomId).emit("sync:event", { type, timestamp: Date.now(), payload });
}

export function setupUnifiedSocketIO(io: IOServer, roomManager: RoomManager): void {
	io.on("connection", (socket: Socket) => {
		logger.info("Client connected", { socketId: socket.id });

		socket.on("request", async (data: { event: WsEventName; requestId: string; payload: unknown }) => {
			const { event, requestId, payload } = data;
			const sd = getSocketData(socket);

			try {
				await handleUnifiedEvent(io, socket, roomManager, event, requestId, payload, sd);
			} catch (error) {
				logger.error("Error handling event", error, { event, requestId });
				sendResponse(socket, requestId, false, undefined, { code: "INTERNAL_ERROR", message: "Internal server error" });
			}
		});

		socket.on("disconnect", () => {
			logger.info("Client disconnected", { socketId: socket.id });
			const sd = getSocketData(socket);
			if (sd.roomId && sd.playerId) {
				leaveRoomInternal(socket, io, roomManager);
			}
		});
	});
}

async function handleUnifiedEvent(
	io: IOServer,
	socket: Socket,
	roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	const validation = validateWsPayload(event, payload);
	if (!validation.success) {
		sendResponse(socket, requestId, false, undefined, { code: "VALIDATION_ERROR", message: validation.error });
		return;
	}

	const validatedPayload = validation.data as unknown;

	if (event.startsWith("auth:")) {
		await handleAuthNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("room:")) {
		await handleRoomNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("game:")) {
		await handleGameNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("dm:")) {
		await handleDmNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("sync:")) {
		await handleSyncNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("token:")) {
		await handleTokenNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("weapon:")) {
		await handleWeaponNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("save:")) {
		await handleSaveNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("preset:")) {
		await handlePresetNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("profile:")) {
		await handleProfileNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else if (event.startsWith("asset:")) {
		await handleAssetNamespace(io, socket, roomManager, event, requestId, validatedPayload, sd);
	} else {
		sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_EVENT", message: `Unknown event: ${event}` });
	}
}

async function handleAuthNamespace(
	_io: IOServer,
	socket: Socket,
	_roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	switch (event) {
		case "auth:login":
			await handleAuthLogin(socket, requestId, payload as AuthLoginPayload);
			break;
		case "auth:logout":
			handleAuthLogout(socket, requestId, sd);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_AUTH_EVENT", message: `Unknown auth event: ${event}` });
	}
}

async function handleAuthLogin(socket: Socket, requestId: string, payload: AuthLoginPayload): Promise<void> {
	const playerName = payload.playerName.trim();
	if (!playerName) {
		sendResponse(socket, requestId, false, undefined, { code: "AUTH_FAILED", message: "playerName required" });
		return;
	}

	const playerId = `player_${socket.id}`;
	socket.data.playerId = playerId;
	socket.data.playerName = playerName;

	const profile = await playerAvatarStorage.getClientProfile(playerName);

	sendResponse(socket, requestId, true, {
		playerId,
		playerName,
		isHost: false,
		role: "PLAYER",
		profile,
	});
}

function handleAuthLogout(socket: Socket, requestId: string, sd: SocketData): void {
	if (sd.roomId && sd.playerId) {
	}

	socket.data.playerId = undefined;
	socket.data.playerName = undefined;
	socket.data.role = undefined;

	sendResponse(socket, requestId, true);
}

async function handleRoomNamespace(
	io: IOServer,
	socket: Socket,
	roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	switch (event) {
		case "room:create":
			await handleRoomCreate(socket, io, roomManager, requestId, payload as RoomCreatePayload, sd);
			break;
		case "room:list":
			handleRoomList(socket, roomManager, requestId);
			break;
		case "room:join":
			await handleRoomJoin(socket, io, roomManager, requestId, payload as RoomJoinPayload, sd);
			break;
		case "room:leave":
			handleRoomLeave(socket, io, roomManager, requestId, sd);
			break;
		case "room:action":
			await handleRoomAction(socket, io, roomManager, requestId, payload as RoomActionPayload, sd);
			break;
		case "room:get_assets":
			await handleRoomGetAssets(socket, io, roomManager, requestId, payload as RoomGetAssetsPayload, sd);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_ROOM_EVENT", message: `Unknown room event: ${event}` });
	}
}

async function handleRoomCreate(socket: Socket, io: IOServer, roomManager: RoomManager, requestId: string, payload: RoomCreatePayload, sd: SocketData): Promise<void> {
	if (!sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	const room = roomManager.createRoom({
		roomName: payload.name,
		maxPlayers: payload.maxPlayers ?? 4,
		mapWidth: payload.mapWidth ?? 2000,
		mapHeight: payload.mapHeight ?? 2000,
		creatorSessionId: sd.playerId,
	});

	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_CREATE_FAILED", message: "Failed to create room" });
		return;
	}

	injectRoomCallbacks(room, io);
	joinRoomInternal(socket, io, roomManager, room.id);

	socket.data.role = "HOST";

	sendResponse(socket, requestId, true, {
		roomId: room.id,
		roomName: room.name,
		isHost: true,
	});
}

function handleRoomList(socket: Socket, roomManager: RoomManager, requestId: string): void {
	const rooms = roomManager.getAllRooms().map((r) => ({
		roomId: r.id,
		name: r.name,
		playerCount: r.playerCount,
		maxPlayers: r.maxPlayers,
		phase: r.phase,
		turnCount: r.gameState?.turn ?? 0,
		ownerId: r.creatorId,
		createdAt: r.createdAt,
	}));

	sendResponse(socket, requestId, true, { rooms });
}

async function handleRoomJoin(socket: Socket, io: IOServer, roomManager: RoomManager, requestId: string, payload: RoomJoinPayload, sd: SocketData): Promise<void> {
	if (!sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	const room = roomManager.getRoom(payload.roomId);
	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_NOT_FOUND", message: "Room not found" });
		return;
	}

	joinRoomInternal(socket, io, roomManager, payload.roomId);

	const role = getUserRole(socket, room);
	socket.data.role = role;

	sendResponse(socket, requestId, true, {
		roomId: payload.roomId,
		roomName: room.name,
		isHost: role === "HOST",
		role,
	});
}

function handleRoomLeave(socket: Socket, io: IOServer, roomManager: RoomManager, requestId: string, sd: SocketData): void {
	if (!sd.roomId || !sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_IN_ROOM", message: "Not in a room" });
		return;
	}

	leaveRoomInternal(socket, io, roomManager);
	socket.data.roomId = undefined;
	socket.data.role = undefined;

	sendResponse(socket, requestId, true);
}

async function handleRoomGetAssets(socket: Socket, _io: IOServer, roomManager: RoomManager, requestId: string, payload: RoomGetAssetsPayload, sd: SocketData): Promise<void> {
	if (!sd.roomId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_IN_ROOM", message: "Not in a room" });
		return;
	}

	const room = roomManager.getRoom(sd.roomId);
	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_NOT_FOUND", message: "Room not found" });
		return;
	}

	const assetIds: string[] = [];
	const tokens = room.getShipTokens();

	for (const token of tokens) {
		const texture = token.tokenJson.token.texture;
		if (texture?.assetId) assetIds.push(texture.assetId);

		for (const mount of token.tokenJson.token.mounts ?? []) {
			if (typeof mount.weapon !== "string" && mount.weapon?.weapon?.texture?.assetId) {
				assetIds.push(mount.weapon.weapon.texture.assetId);
			}
		}
	}

	const uniqueIds = [...new Set(assetIds)];
	const results = await assetService.batchGetAssets(uniqueIds, payload.includeData);

	sendResponse(socket, requestId, true, { assets: results });
}

async function handleRoomAction(socket: Socket, io: IOServer, roomManager: RoomManager, requestId: string, payload: RoomActionPayload, sd: SocketData): Promise<void> {
	if (!sd.roomId || !sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_IN_ROOM", message: "Not in a room" });
		return;
	}

	const room = roomManager.getRoom(sd.roomId);
	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_NOT_FOUND", message: "Room not found" });
		return;
	}

	switch (payload.action) {
		case "ready":
			room.togglePlayerReady(sd.playerId);
			sendResponse(socket, requestId, true);
			break;
		case "start":
			if (!isHost(socket, room)) {
				sendResponse(socket, requestId, false, undefined, { code: "NOT_HOST", message: "Only HOST can start game" });
				return;
			}
			room.startGame();
			broadcastSyncDelta(io, sd.roomId, [deltaPhaseChange("PLAYER_ACTION")]);
			sendResponse(socket, requestId, true);
			break;
		case "kick":
			if (!isHost(socket, room)) {
				sendResponse(socket, requestId, false, undefined, { code: "NOT_HOST", message: "Only HOST can kick players" });
				return;
			}
			if (!payload.targetId) {
				sendResponse(socket, requestId, false, undefined, { code: "TARGET_REQUIRED", message: "targetId required for kick" });
				return;
			}
			room.leavePlayer(payload.targetId);
			broadcastSyncDelta(io, sd.roomId, [deltaPlayerLeave(payload.targetId)]);
			sendResponse(socket, requestId, true);
			break;
		case "transfer_host":
			if (!isHost(socket, room)) {
				sendResponse(socket, requestId, false, undefined, { code: "NOT_HOST", message: "Only HOST can transfer host" });
				return;
			}
			if (!payload.targetId) {
				sendResponse(socket, requestId, false, undefined, { code: "TARGET_REQUIRED", message: "targetId required for transfer_host" });
				return;
			}
			room.creatorId = payload.targetId;
			socket.data.role = "PLAYER";
			broadcastSyncDelta(io, sd.roomId, [deltaHostChange(payload.targetId)]);
			sendResponse(socket, requestId, true);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_ACTION", message: `Unknown action: ${payload.action}` });
	}
}

async function handleGameNamespace(
	io: IOServer,
	socket: Socket,
	roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	if (!sd.roomId || !sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_IN_ROOM", message: "Not in a room" });
		return;
	}

	const room = roomManager.getRoom(sd.roomId);
	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_NOT_FOUND", message: "Room not found" });
		return;
	}

	if (!isPlayer(socket, room)) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_PLAYER", message: "PLAYER permission required" });
		return;
	}

	switch (event) {
		case "game:action":
			await handleGameAction(socket, io, roomManager, room, requestId, payload as GameActionPayload, sd);
			break;
		case "game:query":
			handleGameQuery(socket, room, requestId, payload as GameQueryPayload);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_GAME_EVENT", message: `Unknown game event: ${event}` });
	}
}

async function handleGameAction(socket: Socket, io: IOServer, _roomManager: RoomManager, room: Room, requestId: string, payload: GameActionPayload, sd: SocketData): Promise<void> {
	const tokenId = payload.tokenId;

	if (!isHost(socket, room)) {
		const check = requireTokenControl(socket, room, tokenId);
		if (!check.success) {
			sendResponse(socket, requestId, false, undefined, { code: "TOKEN_CONTROL_DENIED", message: check.error! });
			return;
		}
	}

	const actionToEvent: Record<string, string> = {
		"move": "game:move",
		"rotate": "game:rotate",
		"attack": "game:attack",
		"shield": "game:toggle_shield",
		"vent": "game:vent_flux",
		"end_turn": "game:end_turn",
		"advance_phase": "game:advance_phase",
	};
	const event = actionToEvent[payload.action] || "game:move";

	const result = await actionHandler.handleAction(
		sd.roomId!,
		sd.playerId!,
		event as "game:move" | "game:rotate" | "game:attack" | "game:toggle_shield" | "game:vent_flux" | "game:end_turn" | "game:advance_phase",
		payload
	);

	if (result.success) {
		const changes: DeltaChange[] = [];
		if (payload.action === "move" || payload.action === "rotate") {
			changes.push(deltaTokenUpdate(tokenId, payload.action, payload));
		}

		if (changes.length > 0) {
			broadcastSyncDelta(io, sd.roomId!, changes);
		}

		sendResponse(socket, requestId, true);
	} else {
		sendResponse(socket, requestId, false, undefined, { code: "ACTION_FAILED", message: result.error! });
	}
}

function handleGameQuery(socket: Socket, room: Room, requestId: string, payload: GameQueryPayload): void {
	const tokenId = payload.tokenId;
	const token = room.getShipToken(tokenId);

	if (!token) {
		sendResponse(socket, requestId, false, undefined, { code: "TOKEN_NOT_FOUND", message: "Token not found" });
		return;
	}

	switch (payload.type) {
		case "targets":
			const allTokens = room.getShipTokens();
			const targetingResult = calculateShipWeaponTargets(token, allTokens);
			sendResponse(socket, requestId, true, { targetingResult });
			break;
		case "movement":
			const runtime = token.tokenJson.runtime;
			sendResponse(socket, requestId, true, {
				movement: runtime?.movement ?? { phaseAUsed: 0, phaseCUsed: 0, turnAngleUsed: 0 },
			});
			break;
		case "ownership":
			sendResponse(socket, requestId, true, {
				ownerId: token.tokenJson.runtime?.ownerId,
				faction: token.tokenJson.runtime?.faction,
			});
			break;
		case "combat_state":
			sendResponse(socket, requestId, true, {
				hull: token.tokenJson.runtime?.hull,
				flux: (token.tokenJson.runtime?.fluxSoft ?? 0) + (token.tokenJson.runtime?.fluxHard ?? 0),
				overloaded: token.tokenJson.runtime?.overloaded,
			});
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_QUERY_TYPE", message: `Unknown query type: ${payload.type}` });
	}
}

async function handleDmNamespace(
	io: IOServer,
	socket: Socket,
	roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	if (!sd.roomId || !sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_IN_ROOM", message: "Not in a room" });
		return;
	}

	const room = roomManager.getRoom(sd.roomId);
	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_NOT_FOUND", message: "Room not found" });
		return;
	}

	const hostCheck = requireHost(socket, room);
	if (!hostCheck.success) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_HOST", message: hostCheck.error! });
		return;
	}

	switch (event) {
		case "dm:spawn":
			await handleDmSpawn(socket, io, room, requestId, payload as DmSpawnPayload);
			break;
		case "dm:modify":
			await handleDmModify(socket, io, room, requestId, payload as DmModifyPayload);
			break;
		case "dm:remove":
			await handleDmRemove(socket, io, room, requestId, payload as { tokenId: string });
			break;
		case "dm:force_end_turn":
			await handleDmForceEndTurn(socket, io, room, requestId, payload as { faction?: string });
			break;
		case "dm:set_modifier":
			await handleDmSetModifier(socket, io, room, requestId, payload as DmSetModifierPayload, sd);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_DM_EVENT", message: `Unknown dm event: ${event}` });
	}
}

async function handleDmSpawn(socket: Socket, io: IOServer, room: Room, requestId: string, payload: DmSpawnPayload): Promise<void> {
	const tokenJson = payload.token;
	const position = payload.position ?? { x: 0, y: 0 };

	const stateManager = room.getStateManager();
	const tokenId = `token_${Date.now()}`;

	stateManager.createCombatTokenFromJson(
		tokenJson,
		position,
		0,
		payload.faction,
		undefined
	);

	broadcastSyncDelta(io, room.id, [deltaTokenAdd(tokenId, tokenJson)]);
	sendResponse(socket, requestId, true, { tokenId });
}

async function handleDmModify(socket: Socket, io: IOServer, room: Room, requestId: string, payload: DmModifyPayload): Promise<void> {
	const token = room.getShipToken(payload.tokenId);
	if (!token) {
		sendResponse(socket, requestId, false, undefined, { code: "TOKEN_NOT_FOUND", message: "Token not found" });
		return;
	}

	const oldValue = token.tokenJson.runtime?.[payload.field as keyof TokenJSON["runtime"]];
	room.updateShipTokenRuntime(payload.tokenId, { [payload.field]: payload.value });

	broadcastSyncDelta(io, room.id, [deltaTokenUpdate(payload.tokenId, payload.field, payload.value, oldValue)]);
	sendResponse(socket, requestId, true);
}

async function handleDmRemove(socket: Socket, io: IOServer, room: Room, requestId: string, payload: { tokenId: string }): Promise<void> {
	const token = room.getShipToken(payload.tokenId);
	if (!token) {
		sendResponse(socket, requestId, false, undefined, { code: "TOKEN_NOT_FOUND", message: "Token not found" });
		return;
	}

	room.getStateManager().removeToken(payload.tokenId);
	broadcastSyncDelta(io, room.id, [deltaTokenRemove(payload.tokenId)]);
	sendResponse(socket, requestId, true);
}

async function handleDmForceEndTurn(socket: Socket, io: IOServer, room: Room, requestId: string, payload: { faction?: string }): Promise<void> {
	room.nextTurn();
	const state = room.getStateManager().getState();

	const changes: DeltaChange[] = [
		deltaTurnChange(state.turn),
	];

	if (payload.faction) {
		changes.push(deltaFactionTurn(payload.faction));
	}

	broadcastSyncDelta(io, room.id, changes);
	sendResponse(socket, requestId, true);
}

async function handleSyncNamespace(
	_io: IOServer,
	socket: Socket,
	roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	_payload: unknown,
	sd: SocketData
): Promise<void> {
	switch (event) {
		case "sync:request_full":
			await handleSyncRequestFull(socket, roomManager, requestId, sd);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_SYNC_EVENT", message: `Unknown sync event: ${event}` });
	}
}

async function handleSyncRequestFull(socket: Socket, roomManager: RoomManager, requestId: string, sd: SocketData): Promise<void> {
	if (!sd.roomId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_IN_ROOM", message: "Not in a room" });
		return;
	}

	const room = roomManager.getRoom(sd.roomId);
	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_NOT_FOUND", message: "Room not found" });
		return;
	}

	sendResponse(socket, requestId, true, room.getGameState());
}

function injectRoomCallbacks(room: Room, io: IOServer): void {
	const roomId = room.id;
	room.callbacks = {
		sendToPlayer: (playerId: string, message: unknown) => {
			const msgObj = message as Record<string, unknown>;
			io.to(roomId).emit("event", { targetPlayer: playerId, ...msgObj });
		},
		broadcast: (message: unknown) => {
			io.to(roomId).emit("event", message);
		},
		broadcastToFaction: (faction: string, message: unknown) => {
			const msgObj = message as Record<string, unknown>;
			io.to(roomId).emit("event", { targetFaction: faction, ...msgObj });
		},
		broadcastExcept: (excludePlayerId: string, message: unknown) => {
			const msgObj = message as Record<string, unknown>;
			io.to(roomId).emit("event", { excludePlayer: excludePlayerId, ...msgObj });
		},
		broadcastToSpectators: (_message: unknown) => {
			// OBSERVER 已移除，此方法不再使用
		},
		broadcastToPlayers: (message: unknown) => {
			const msgObj = message as Record<string, unknown>;
			io.to(roomId).emit("event", msgObj);
		},
	};
}

function joinRoomInternal(socket: Socket, io: IOServer, roomManager: RoomManager, roomId: string): void {
	const sd = getSocketData(socket);
	const playerId = sd.playerId;
	const playerName = sd.playerName;
	if (!playerId || !playerName) return;

	const room = roomManager.getRoom(roomId);
	if (room && !room.callbacks?.broadcast) {
		injectRoomCallbacks(room, io);
	}

	const success = roomManager.joinRoom(roomId, socket.id, playerId, playerName);
	if (!success) return;

	socket.join(roomId);
	socket.data.roomId = roomId;

	if (room) {
		broadcastSyncFull(io, roomId, room);
		io.to(roomId).emit("player:joined", {
			playerId,
			playerName,
			totalPlayers: room.getPlayerCount(),
		});
	}
}

function leaveRoomInternal(socket: Socket, io: IOServer, roomManager: RoomManager): void {
	const sd = getSocketData(socket);
	const roomId = sd.roomId;
	const playerId = sd.playerId;
	if (!roomId || !playerId) return;

	roomManager.leaveRoom(roomId, playerId);
	socket.leave(roomId);

	const room = roomManager.getRoom(roomId);
	if (room) {
		broadcastSyncDelta(io, roomId, [deltaPlayerLeave(playerId)]);
		io.to(roomId).emit("player:left", {
			playerId,
			totalPlayers: room.getPlayerCount(),
		});
	}

	socket.data.roomId = undefined;
}

async function handleDmSetModifier(socket: Socket, io: IOServer, room: Room, requestId: string, payload: DmSetModifierPayload, sd: SocketData): Promise<void> {
	const { key, value } = payload;
	room.getStateManager().setGlobalModifier(key, value);
	broadcastSyncDelta(io, sd.roomId!, [deltaModifierAdd(key, value)]);
	sendResponse(socket, requestId, true);
}

const playerProfileService = new PlayerProfileService(persistence);
const shipBuildService = new ShipBuildService(persistence);
const presetService = new PresetService(persistence);

async function handleTokenNamespace(
	_io: IOServer,
	socket: Socket,
	_roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	if (!sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	const userId = sd.playerId;

	switch (event) {
		case "token:list":
			await handleTokenList(socket, requestId, userId);
			break;
		case "token:get":
			await handleTokenGet(socket, requestId, userId, payload as TokenGetPayload);
			break;
		case "token:create":
			await handleTokenCreate(socket, requestId, userId, payload as TokenCreatePayload);
			break;
		case "token:update":
			await handleTokenUpdate(socket, requestId, userId, payload as TokenUpdatePayload);
			break;
		case "token:delete":
			await handleTokenDelete(socket, requestId, userId, payload as TokenDeletePayload);
			break;
		case "token:copy_preset":
			await handleTokenCopyPreset(socket, requestId, userId, payload as TokenCopyPresetPayload);
			break;
		case "token:mount":
			await handleTokenMount(socket, requestId, userId, payload as TokenMountPayload);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_TOKEN_EVENT", message: `Unknown token event: ${event}` });
	}
}

async function handleTokenList(socket: Socket, requestId: string, userId: string): Promise<void> {
	const ships = await playerProfileService.getPlayerShips(userId);
	sendResponse(socket, requestId, true, { ships });
}

async function handleTokenGet(socket: Socket, requestId: string, userId: string, payload: TokenGetPayload): Promise<void> {
	const ship = await playerProfileService.getPlayerShip(userId, payload.tokenId);
	if (!ship) {
		sendResponse(socket, requestId, false, undefined, { code: "TOKEN_NOT_FOUND", message: "Token not found" });
		return;
	}
	sendResponse(socket, requestId, true, { ship });
}

async function handleTokenCreate(socket: Socket, requestId: string, userId: string, payload: TokenCreatePayload): Promise<void> {
	const ship = await shipBuildService.createShipBuild(userId, payload.token);
	sendResponse(socket, requestId, true, { ship });
}

async function handleTokenUpdate(socket: Socket, requestId: string, userId: string, payload: TokenUpdatePayload): Promise<void> {
	const existing = await playerProfileService.getPlayerShip(userId, payload.tokenId);
	if (!existing) {
		sendResponse(socket, requestId, false, undefined, { code: "TOKEN_NOT_FOUND", message: "Token not found or not owned by user" });
		return;
	}
	const ship = await shipBuildService.updateShipBuild(payload.tokenId, payload.updates);
	sendResponse(socket, requestId, true, { ship });
}

async function handleTokenDelete(socket: Socket, requestId: string, userId: string, payload: TokenDeletePayload): Promise<void> {
	const success = await playerProfileService.deletePlayerShip(userId, payload.tokenId);
	if (!success) {
		sendResponse(socket, requestId, false, undefined, { code: "TOKEN_DELETE_FAILED", message: "Failed to delete token" });
		return;
	}
	sendResponse(socket, requestId, true);
}

async function handleTokenCopyPreset(socket: Socket, requestId: string, userId: string, payload: TokenCopyPresetPayload): Promise<void> {
	const ship = await shipBuildService.createFromPreset(userId, payload.presetId);
	sendResponse(socket, requestId, true, { ship });
}

async function handleTokenMount(socket: Socket, requestId: string, userId: string, payload: TokenMountPayload): Promise<void> {
	const ship = await playerProfileService.getPlayerShip(userId, payload.tokenId);
	if (!ship) {
		sendResponse(socket, requestId, false, undefined, { code: "TOKEN_NOT_FOUND", message: "Token not found or not owned by user" });
		return;
	}
	const shipJson = ship.shipJson;
	const mountIndex = shipJson.token.mounts?.findIndex((m: { id: string }) => m.id === payload.mountId);
	if (mountIndex === undefined || mountIndex < 0) {
		sendResponse(socket, requestId, false, undefined, { code: "MOUNT_NOT_FOUND", message: "Mount not found" });
		return;
	}
	if (shipJson.token.mounts && shipJson.token.mounts[mountIndex]) {
		if (payload.weaponId === null) {
			shipJson.token.mounts[mountIndex].weapon = undefined;
		} else {
			const weapon = await playerProfileService.getPlayerWeapon(userId, payload.weaponId);
			if (!weapon) {
				sendResponse(socket, requestId, false, undefined, { code: "WEAPON_NOT_FOUND", message: "Weapon not found or not owned by user" });
				return;
			}
			shipJson.token.mounts[mountIndex].weapon = weapon.weaponJson;
		}
	}
	const updated = await shipBuildService.updateShipBuild(payload.tokenId, { shipJson });
	sendResponse(socket, requestId, true, { ship: updated });
}

async function handleWeaponNamespace(
	_io: IOServer,
	socket: Socket,
	_roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	if (!sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	const userId = sd.playerId;

	switch (event) {
		case "weapon:list":
			await handleWeaponList(socket, requestId, userId);
			break;
		case "weapon:get":
			await handleWeaponGet(socket, requestId, userId, payload as WeaponGetPayload);
			break;
		case "weapon:create":
			await handleWeaponCreate(socket, requestId, userId, payload as WeaponCreatePayload);
			break;
		case "weapon:update":
			await handleWeaponUpdate(socket, requestId, userId, payload as WeaponUpdatePayload);
			break;
		case "weapon:delete":
			await handleWeaponDelete(socket, requestId, userId, payload as WeaponDeletePayload);
			break;
		case "weapon:copy_preset":
			await handleWeaponCopyPreset(socket, requestId, userId, payload as WeaponCopyPresetPayload);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_WEAPON_EVENT", message: `Unknown weapon event: ${event}` });
	}
}

async function handleWeaponList(socket: Socket, requestId: string, userId: string): Promise<void> {
	const weapons = await playerProfileService.getPlayerWeapons(userId);
	sendResponse(socket, requestId, true, { weapons });
}

async function handleWeaponGet(socket: Socket, requestId: string, userId: string, payload: WeaponGetPayload): Promise<void> {
	const weapon = await playerProfileService.getPlayerWeapon(userId, payload.weaponId);
	if (!weapon) {
		sendResponse(socket, requestId, false, undefined, { code: "WEAPON_NOT_FOUND", message: "Weapon not found" });
		return;
	}
	sendResponse(socket, requestId, true, { weapon });
}

async function handleWeaponCreate(socket: Socket, requestId: string, userId: string, payload: WeaponCreatePayload): Promise<void> {
	const weaponBuild: WeaponBuild = {
		id: payload.weapon.$id,
		weaponJson: payload.weapon,
		ownerId: userId,
		isPreset: false,
		isPublic: false,
		tags: [],
		usageCount: 0,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	const weapon = await persistence.weapons.create(weaponBuild);
	sendResponse(socket, requestId, true, { weapon });
}

async function handleWeaponUpdate(socket: Socket, requestId: string, userId: string, payload: WeaponUpdatePayload): Promise<void> {
	const existing = await playerProfileService.getPlayerWeapon(userId, payload.weaponId);
	if (!existing) {
		sendResponse(socket, requestId, false, undefined, { code: "WEAPON_NOT_FOUND", message: "Weapon not found or not owned by user" });
		return;
	}
	const weapon = await persistence.weapons.update(payload.weaponId, payload.updates);
	sendResponse(socket, requestId, true, { weapon });
}

async function handleWeaponDelete(socket: Socket, requestId: string, userId: string, payload: WeaponDeletePayload): Promise<void> {
	const success = await playerProfileService.deletePlayerWeapon(userId, payload.weaponId);
	if (!success) {
		sendResponse(socket, requestId, false, undefined, { code: "WEAPON_DELETE_FAILED", message: "Failed to delete weapon" });
		return;
	}
	sendResponse(socket, requestId, true);
}

async function handleWeaponCopyPreset(socket: Socket, requestId: string, userId: string, payload: WeaponCopyPresetPayload): Promise<void> {
	const preset = await presetService.getWeaponPresetById(payload.presetId);
	if (!preset) {
		sendResponse(socket, requestId, false, undefined, { code: "PRESET_NOT_FOUND", message: "Preset weapon not found" });
		return;
	}
	const weaponJson = JSON.parse(JSON.stringify(preset)) as WeaponJSON;
	const idCounter = Date.now().toString(36);
	weaponJson.$id = `weapon:${userId}_${idCounter}`;
	const weaponBuild: WeaponBuild = {
		id: weaponJson.$id,
		weaponJson,
		ownerId: userId,
		isPreset: false,
		isPublic: false,
		tags: ["preset-copy"],
		usageCount: 0,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};
	const weapon = await persistence.weapons.create(weaponBuild);
	sendResponse(socket, requestId, true, { weapon });
}

async function handleSaveNamespace(
	io: IOServer,
	socket: Socket,
	roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	if (!sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	const userId = sd.playerId;

	switch (event) {
		case "save:list":
			await handleSaveList(socket, requestId, userId);
			break;
		case "save:create":
			await handleSaveCreate(socket, requestId, userId, payload as SaveCreatePayload);
			break;
		case "save:load":
			await handleSaveLoad(socket, io, roomManager, requestId, userId, payload as SaveLoadPayload, sd);
			break;
		case "save:delete":
			await handleSaveDelete(socket, requestId, userId, payload as SaveDeletePayload);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_SAVE_EVENT", message: `Unknown save event: ${event}` });
	}
}

async function handleSaveList(socket: Socket, requestId: string, userId: string): Promise<void> {
	const saves = await playerProfileService.listSaves(userId);
	sendResponse(socket, requestId, true, { saves });
}

async function handleSaveCreate(socket: Socket, requestId: string, userId: string, payload: SaveCreatePayload): Promise<void> {
	const ships = await playerProfileService.getPlayerShips(userId);
	const tokens = ships.map((s) => s.shipJson);
	const save = await playerProfileService.createSave(userId, payload.name, tokens);
	sendResponse(socket, requestId, true, { save });
}

async function handleSaveLoad(socket: Socket, io: IOServer, roomManager: RoomManager, requestId: string, userId: string, payload: SaveLoadPayload, sd: SocketData): Promise<void> {
	if (!sd.roomId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_IN_ROOM", message: "Not in a room" });
		return;
	}

	const room = roomManager.getRoom(sd.roomId);
	if (!room) {
		sendResponse(socket, requestId, false, undefined, { code: "ROOM_NOT_FOUND", message: "Room not found" });
		return;
	}

	if (!isHost(socket, room)) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_HOST", message: "Only HOST can load save" });
		return;
	}

	const saves = await playerProfileService.listSaves(userId);
	const save = saves.find((s) => s.$id === payload.saveId);
	if (!save) {
		sendResponse(socket, requestId, false, undefined, { code: "SAVE_NOT_FOUND", message: "Save not found" });
		return;
	}

	const stateManager = room.getStateManager();
	stateManager.clearTokens();

	for (const token of save.tokens) {
		stateManager.createCombatTokenFromJson(token, token.runtime?.position ?? { x: 0, y: 0 }, token.runtime?.heading ?? 0, token.runtime?.faction, userId);
	}

	broadcastSyncFull(io, sd.roomId, room);
	sendResponse(socket, requestId, true);
}

async function handleSaveDelete(socket: Socket, requestId: string, userId: string, payload: SaveDeletePayload): Promise<void> {
	const saves = await playerProfileService.listSaves(userId);
	const save = saves.find((s) => s.$id === payload.saveId);
	if (!save) {
		sendResponse(socket, requestId, false, undefined, { code: "SAVE_NOT_FOUND", message: "Save not found" });
		return;
	}
	await persistence.roomSaves.delete(payload.saveId);
	sendResponse(socket, requestId, true);
}

async function handlePresetNamespace(
	_io: IOServer,
	socket: Socket,
	_roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	_sd: SocketData
): Promise<void> {
	switch (event) {
		case "preset:list_tokens":
			await handlePresetListTokens(socket, requestId, payload as PresetListTokensPayload);
			break;
		case "preset:list_weapons":
			await handlePresetListWeapons(socket, requestId, payload as PresetListWeaponsPayload);
			break;
		case "preset:get_token":
			await handlePresetGetToken(socket, requestId, payload as PresetGetPayload);
			break;
		case "preset:get_weapon":
			await handlePresetGetWeapon(socket, requestId, payload as PresetGetPayload);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_PRESET_EVENT", message: `Unknown preset event: ${event}` });
	}
}

async function handlePresetListTokens(socket: Socket, requestId: string, payload: PresetListTokensPayload): Promise<void> {
	let presets: TokenJSON[];
	if (payload.size) {
		presets = await presetService.getShipPresetsBySize(payload.size);
	} else if (payload.class) {
		presets = await presetService.getShipPresetsByClass(payload.class);
	} else {
		presets = await presetService.getShipPresets();
	}
	sendResponse(socket, requestId, true, { presets });
}

async function handlePresetListWeapons(socket: Socket, requestId: string, payload: PresetListWeaponsPayload): Promise<void> {
	let presets: WeaponJSON[];
	if (payload.size) {
		presets = await presetService.getWeaponPresetsBySize(payload.size);
	} else if (payload.damageType) {
		presets = await presetService.getWeaponPresetsByDamageType(payload.damageType);
	} else {
		presets = await presetService.getWeaponPresets();
	}
	sendResponse(socket, requestId, true, { presets });
}

async function handlePresetGetToken(socket: Socket, requestId: string, payload: PresetGetPayload): Promise<void> {
	const preset = await presetService.getShipPresetById(payload.presetId);
	if (!preset) {
		sendResponse(socket, requestId, false, undefined, { code: "PRESET_NOT_FOUND", message: "Preset token not found" });
		return;
	}
	sendResponse(socket, requestId, true, { preset });
}

async function handlePresetGetWeapon(socket: Socket, requestId: string, payload: PresetGetPayload): Promise<void> {
	const preset = await presetService.getWeaponPresetById(payload.presetId);
	if (!preset) {
		sendResponse(socket, requestId, false, undefined, { code: "PRESET_NOT_FOUND", message: "Preset weapon not found" });
		return;
	}
	sendResponse(socket, requestId, true, { preset });
}

// ==================== profile namespace ====================

async function handleProfileNamespace(
	_io: IOServer,
	socket: Socket,
	_roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	switch (event) {
		case "profile:get":
			await handleProfileGet(socket, requestId, sd);
			break;
		case "profile:update":
			await handleProfileUpdate(socket, requestId, payload as { nickname?: string; avatar?: string }, sd);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_PROFILE_EVENT", message: `Unknown profile event: ${event}` });
	}
}

async function handleProfileGet(socket: Socket, requestId: string, sd: SocketData): Promise<void> {
	if (!sd.playerName) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	const profile = await playerAvatarStorage.getClientProfile(sd.playerName);
	sendResponse(socket, requestId, true, { profile });
}

async function handleProfileUpdate(socket: Socket, requestId: string, payload: { nickname?: string; avatar?: string }, sd: SocketData): Promise<void> {
	if (!sd.playerName) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	try {
		const profile = await playerAvatarStorage.upsertProfile(sd.playerName, payload);
		sendResponse(socket, requestId, true, { profile });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to update profile";
		sendResponse(socket, requestId, false, undefined, { code: "PROFILE_UPDATE_FAILED", message });
	}
}

// ==================== asset namespace ====================

async function handleAssetNamespace(
	_io: IOServer,
	socket: Socket,
	_roomManager: RoomManager,
	event: WsEventName,
	requestId: string,
	payload: unknown,
	sd: SocketData
): Promise<void> {
	switch (event) {
		case "asset:upload":
			await handleAssetUpload(socket, requestId, payload as AssetUploadPayload, sd);
			break;
		case "asset:list":
			await handleAssetList(socket, requestId, payload as AssetListPayload);
			break;
		case "asset:batch_get":
			await handleAssetBatchGet(socket, requestId, payload as AssetBatchGetPayload);
			break;
		case "asset:delete":
			await handleAssetDelete(socket, requestId, payload as AssetDeletePayload, sd);
			break;
		default:
			sendResponse(socket, requestId, false, undefined, { code: "UNKNOWN_ASSET_EVENT", message: `Unknown asset event: ${event}` });
	}
}

async function handleAssetUpload(socket: Socket, requestId: string, payload: AssetUploadPayload, sd: SocketData): Promise<void> {
	if (!sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	try {
		const buffer = Buffer.from(payload.data, "base64");

		let assetId: string;
		switch (payload.type) {
			case "avatar":
				assetId = await assetService.uploadAvatar(sd.playerId, buffer, payload.filename, payload.mimeType);
				break;
			case "ship_texture":
				assetId = await assetService.uploadShipTexture(sd.playerId, buffer, payload.filename, payload.mimeType);
				break;
			case "weapon_texture":
				assetId = await assetService.uploadWeaponTexture(sd.playerId, buffer, payload.filename, payload.mimeType);
				break;
			default:
				sendResponse(socket, requestId, false, undefined, { code: "INVALID_TYPE", message: "Invalid asset type" });
				return;
		}

		sendResponse(socket, requestId, true, { assetId });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Failed to upload asset";
		sendResponse(socket, requestId, false, undefined, { code: "ASSET_UPLOAD_FAILED", message });
	}
}

async function handleAssetList(socket: Socket, requestId: string, payload: AssetListPayload): Promise<void> {
	const assets = await assetService.listAssets(payload.type, payload.ownerId);
	sendResponse(socket, requestId, true, { assets });
}

async function handleAssetBatchGet(socket: Socket, requestId: string, payload: AssetBatchGetPayload): Promise<void> {
	const results = await assetService.batchGetAssets(payload.assetIds, payload.includeData);
	sendResponse(socket, requestId, true, { results });
}

async function handleAssetDelete(socket: Socket, requestId: string, payload: AssetDeletePayload, sd: SocketData): Promise<void> {
	if (!sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_AUTHED", message: "Please auth first" });
		return;
	}

	// 验证所有权
	const asset = await assetService.getAsset(payload.assetId);
	if (!asset) {
		sendResponse(socket, requestId, false, undefined, { code: "ASSET_NOT_FOUND", message: "Asset not found" });
		return;
	}

	if (asset.ownerId !== sd.playerId) {
		sendResponse(socket, requestId, false, undefined, { code: "NOT_OWNER", message: "Only owner can delete asset" });
		return;
	}

	const success = await assetService.deleteAsset(payload.assetId);
	if (!success) {
		sendResponse(socket, requestId, false, undefined, { code: "ASSET_DELETE_FAILED", message: "Failed to delete asset" });
		return;
	}

	sendResponse(socket, requestId, true);
}

export { broadcastSyncEvent };