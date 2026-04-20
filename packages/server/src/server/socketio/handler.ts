/**
 * Socket.IO 事件处理器（最薄的一层）
 *
 * 只做：认证、房间管理事件路由、游戏 Action 转发
 * 业务逻辑全部交给 Room / ActionHandler / Engine
 */

import { Server as IOServer, Socket } from "socket.io";
import { createLogger } from "../../infra/simple-logger.js";
import { RoomManager } from "../rooms/RoomManager.js";
import { PlayerAvatarStorageService } from "../../services/PlayerAvatarStorageService.js";
import { actionHandler } from "../handlers/actionHandler.js";
import {
	validateActionPayload,
	SocketIOActionMap,
} from "@vt/data";
import type { SocketIOActionEvent } from "@vt/data";

const logger = createLogger("socketio");
const playerAvatarStorage = new PlayerAvatarStorageService();

export function setupSocketIO(io: IOServer, roomManager: RoomManager) {
	io.on("connection", (socket: Socket) => {
		logger.info("Client connected", { socketId: socket.id });

		// 认证
		socket.on("auth", async (data: { playerName: string }) => {
			if (!data.playerName) {
				socket.emit("error", { code: "AUTH_FAILED", message: "playerName required" });
				return;
			}

			const playerName = data.playerName.trim();
			if (!playerName) {
				socket.emit("error", { code: "AUTH_FAILED", message: "playerName required" });
				return;
			}

			socket.data.playerId = `player_${socket.id}`;
			socket.data.playerName = playerName;

			const profile = await playerAvatarStorage.getClientProfile(playerName);
			socket.emit("auth:success", {
				playerId: socket.data.playerId,
				playerName,
				profile,
			});
		});

		socket.on("profile:get", async (callback?: (result: any) => void) => {
			if (!socket.data.playerName) {
				const result = { success: false, error: "Not authenticated" };
				callback ? callback(result) : socket.emit("error", result);
				return;
			}

			const profile = await playerAvatarStorage.getClientProfile(socket.data.playerName);
			const result = { success: true, profile };
			if (callback) callback(result);
			else socket.emit("profile:updated", profile);
		});

		socket.on(
			"profile:update",
			async (
				data: { nickname?: string; avatar?: string },
				callback?: (result: { success: boolean; error?: string; profile?: { nickname: string; avatar: string } }) => void
			) => {
				if (!socket.data.playerName) {
					const result = { success: false, error: "Not authenticated" };
					callback ? callback(result) : socket.emit("error", result);
					return;
				}

				try {
					const profile = await playerAvatarStorage.upsertProfile(socket.data.playerName, data ?? {});
					const result = { success: true, profile };
					callback?.(result);
					socket.emit("profile:updated", profile);
				} catch (error: unknown) {
					const message = error instanceof Error ? error.message : "Failed to update profile";
					const result = { success: false, error: message };
					callback ? callback(result) : socket.emit("error", result);
				}
			}
		);

		// 房间：创建
		socket.on("room:create", (options: { roomName: string; maxPlayers?: number }) => {
			if (!socket.data.playerId) return;

			const room = roomManager.createRoom({
				roomName: options.roomName,
				maxPlayers: options.maxPlayers ?? 4,
				creatorSessionId: socket.data.playerId,
			});

			if (!room) {
				socket.emit("error", { code: "ROOM_CREATE_FAILED", message: "Failed to create room" });
				return;
			}

			// 注入 Socket.IO 传输回调（关键！）
			injectRoomCallbacks(room, io, roomManager);

			// 创建者自动加入
			joinRoomInternal(socket, io, roomManager, room.id);
			socket.emit("room:created", { roomId: room.id, roomName: room.name });
		});

		// 房间：加入
		socket.on("room:join", (data: { roomId: string }) => {
			if (!socket.data.playerId) {
				socket.emit("error", { code: "NOT_AUTHED", message: "Please auth first" });
				return;
			}
			joinRoomInternal(socket, io, roomManager, data.roomId);
		});

		// 房间：离开
		socket.on("room:leave", () => {
			if (socket.data.roomId && socket.data.playerId) {
				leaveRoomInternal(socket, io, roomManager);
			}
		});

		// 房间：准备
		socket.on("room:ready", () => {
			if (socket.data.roomId && socket.data.playerId) {
				roomManager.getRoom(socket.data.roomId)?.togglePlayerReady(socket.data.playerId);
			}
		});

		// 房间：开始游戏
		socket.on("room:start", () => {
			if (socket.data.roomId && socket.data.playerId) {
				roomManager.getRoom(socket.data.roomId)?.startGame();
			}
		});

		// 游戏 Action（核心路径：socket → Zod → ActionHandler → Engine → 广播）
		for (const eventName of Object.keys(SocketIOActionMap)) {
			socket.on(eventName, async (payload: unknown, callback?: (result: any) => void) => {
				if (!socket.data.roomId || !socket.data.playerId) {
					const err = { success: false, error: "Not in room or not authed" };
					callback ? callback(err) : socket.emit("error", err);
					return;
				}

				// Zod 验证
				const validation = validateActionPayload(eventName as SocketIOActionEvent, payload);
				if (!validation.success) {
					const err = { success: false, error: validation.error };
					callback ? callback(err) : socket.emit("error", err);
					return;
				}

				// 处理 Action
				const result = await actionHandler.handleAction(
					socket.data.roomId,
					socket.data.playerId,
					eventName as SocketIOActionEvent,
					payload
				);

				// 通知调用者
				if (callback) callback(result);
				else if (!result.success) socket.emit("error", result);

				// 广播状态变化
				if (result.success && result.events) {
					io.to(socket.data.roomId).emit("state:delta", {
						events: result.events,
						timestamp: Date.now(),
					});
				}
			});
		}

		// 断开
		socket.on("disconnect", () => {
			logger.info("Client disconnected", { socketId: socket.id });
			if (socket.data.roomId && socket.data.playerId) {
				leaveRoomInternal(socket, io, roomManager);
			}
		});
	});
}

/** 为 Room 注入 Socket.IO 传输回调 */
function injectRoomCallbacks(room: any, io: IOServer, _roomManager: RoomManager) {
	const roomId = room.id;
	room.callbacks = {
		sendToPlayer: (playerId: string, message: any) => {
			// 从 roomManager 获取 player -> socket 映射
			// 简化：广播到房间，由客户端过滤
			io.to(roomId).emit("event", { targetPlayer: playerId, ...message });
		},
		broadcast: (message: any) => {
			io.to(roomId).emit("event", message);
		},
		broadcastToFaction: (faction: string, message: any) => {
			io.to(roomId).emit("event", { targetFaction: faction, ...message });
		},
		broadcastExcept: (excludePlayerId: string, message: any) => {
			io.to(roomId).emit("event", { excludePlayer: excludePlayerId, ...message });
		},
		broadcastToSpectators: (message: any) => {
			io.to(roomId).emit("event", { targetRole: "SPECTATOR", ...message });
		},
		broadcastToPlayers: (message: any) => {
			io.to(roomId).emit("event", { targetRole: "PLAYER", ...message });
		},
	};
}

function joinRoomInternal(socket: Socket, io: IOServer, roomManager: RoomManager, roomId: string) {
	const playerId = socket.data.playerId;
	const playerName = socket.data.playerName;
	if (!playerId || !playerName) return;

	// 如果房间是新创建的，先注入回调
	const room = roomManager.getRoom(roomId);
	if (room && !room.callbacks?.broadcast) {
		injectRoomCallbacks(room, io, roomManager);
	}

	const success = roomManager.joinRoom(roomId, socket.id, playerId, playerName);
	if (!success) {
		socket.emit("error", { code: "JOIN_FAILED", message: "Failed to join room" });
		return;
	}

	socket.join(roomId);
	socket.data.roomId = roomId;

	if (room) {
		socket.emit("state:full", room.getGameState());
		io.to(roomId).emit("player:joined", {
			playerId,
			playerName,
			totalPlayers: room.getPlayerCount(),
		});
	}
}

function leaveRoomInternal(socket: Socket, io: IOServer, roomManager: RoomManager) {
	const roomId = socket.data.roomId;
	const playerId = socket.data.playerId;
	if (!roomId || !playerId) return;

	roomManager.leaveRoom(roomId, playerId);
	socket.leave(roomId);

	const room = roomManager.getRoom(roomId);
	if (room) {
		io.to(roomId).emit("player:left", {
			playerId,
			totalPlayers: room.getPlayerCount(),
		});
	}

	delete socket.data.roomId;
}
