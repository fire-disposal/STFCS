/**
 * 系统房间
 *
 * 处理系统级 WebSocket 操作：
 * - 获取房间列表（实时推送）
 * - 远程删除房间（房主可通过此房间删除自己创建的房间）
 * - 玩家档案更新（全局功能，与房间无关）
 */

import { matchMaker, Room, Client } from "@colyseus/core";
import { toMatchmakeRoomDto, toRoomListDto, toRoomDeleteDto, toErrorDto, toProfileUpdatedDto } from "../dto/index.js";
import { profileService } from "../services/index.js";

interface RoomDeleteRequest {
	roomId: string;
	ownerShortId: number;
}

interface ProfileUpdateRequest {
	playerId: string;
	nickname?: string;
	avatar?: string;
}

interface ProfileGetRequest {
	playerId: string;
}

export class SystemRoom extends Room {
	maxClients = 100;
	autoDispose = true;

	async onCreate(): Promise<void> {
		console.log("[SystemRoom] Created:", this.roomId);

		// 注册消息处理器：手动请求房间列表
		this.onMessage("ROOM_LIST_REQUEST", (client: Client) => {
			this.sendRoomListToClient(client);
		});

		// 远程删除房间请求
		this.onMessage("ROOM_DELETE_REQUEST", (client: Client, payload: unknown) => {
			this.handleRoomDeleteRequest(client, payload as RoomDeleteRequest);
		});

		// 玩家档案更新请求（全局功能）
		this.onMessage("PROFILE_UPDATE_REQUEST", (client: Client, payload: unknown) => {
			this.handleProfileUpdateRequest(client, payload as ProfileUpdateRequest);
		});

		// 玩家档案获取请求
		this.onMessage("PROFILE_GET_REQUEST", (client: Client, payload: unknown) => {
			this.handleProfileGetRequest(client, payload as ProfileGetRequest);
		});
	}

	onJoin(client: Client): void {
		console.log("[SystemRoom] Client joined:", client.sessionId);
		// 加入时立即发送一次房间列表（页面加载时刷新）
		this.sendRoomListToClient(client);
	}

	onLeave(client: Client): void {
		console.log("[SystemRoom] Client left:", client.sessionId);
	}

	onDispose(): void {
		// 无需清理定时器
	}

	/**
	 * 处理远程删除房间请求
	 *
	 * 验证请求者是否是房间的房主，然后销毁房间
	 */
	private async handleRoomDeleteRequest(client: Client, payload: RoomDeleteRequest): Promise<void> {
		try {
			const { roomId, ownerShortId } = payload;

			if (!roomId || !Number.isInteger(ownerShortId)) {
				client.send("ROOM_DELETE_RESPONSE", toRoomDeleteDto(false, undefined, "无效的请求参数"));
				return;
			}

			// 查询房间信息，验证房主身份
			const rooms = await matchMaker.query({});
			const targetRoom = rooms.find((r) => r.roomId === roomId);

			if (!targetRoom) {
				client.send("ROOM_DELETE_RESPONSE", toRoomDeleteDto(false, roomId, "房间不存在"));
				return;
			}

			const metadata = (targetRoom.metadata as Record<string, unknown> | undefined) || {};
			const roomOwnerShortId = Number(metadata.ownerShortId);

			// 验证请求者是否是房主
			if (roomOwnerShortId !== ownerShortId) {
				client.send("ROOM_DELETE_RESPONSE", toRoomDeleteDto(false, roomId, "只有房主可以删除房间"));
				return;
			}

			// 销毁房间
			console.log(`[SystemRoom] Destroying room ${roomId} by owner ${ownerShortId}`);
			await matchMaker.remoteRoomCall(roomId, "disconnect");

			client.send("ROOM_DELETE_RESPONSE", toRoomDeleteDto(true, roomId));

			// 向删除者发送更新后的房间列表
			this.sendRoomListToClient(client);
		} catch (error) {
			console.error("[SystemRoom] Error handling room delete request:", error);
			client.send("ROOM_DELETE_RESPONSE", toRoomDeleteDto(false, undefined, "删除房间失败"));
		}
	}

	/**
	 * 发送房间列表给指定客户端
	 */
	private async sendRoomListToClient(client: Client): Promise<void> {
		try {
			const rooms = await matchMaker.query({});
			const battleRooms = rooms
				.filter((room) => {
					const metadata = (room.metadata as Record<string, unknown> | undefined) || {};
					// 过滤条件：必须是 battle 类型，且有活跃客户端
					// 空房间不应出现在大厅列表（避免 "room not found" 错误）
					return metadata.roomType === "battle" && room.clients > 0;
				})
				.map((room) => toMatchmakeRoomDto(room));

			client.send("ROOM_LIST_RESPONSE", toRoomListDto(battleRooms));
		} catch (error) {
			console.error("[SystemRoom] Error sending room list to client:", error);
			client.send("ERROR", toErrorDto("获取房间列表失败"));
		}
	}

	/**
	 * 处理玩家档案更新请求（全局功能，与房间无关）
	 */
	private async handleProfileUpdateRequest(client: Client, payload: ProfileUpdateRequest): Promise<void> {
		try {
			const { playerId, nickname, avatar } = payload;

			if (!playerId) {
				client.send("PROFILE_UPDATE_RESPONSE", { success: false, error: "缺少玩家标识" });
				return;
			}

			console.log(`[SystemRoom] Profile update request for ${playerId}`, {
				nickname,
				avatarLength: avatar?.length || 0
			});

			const result = await profileService.updateBasicProfile(playerId, { nickname, avatar });

			client.send("PROFILE_UPDATE_RESPONSE", {
				success: result.success,
				nickname: result.nickname,
				avatar: result.avatar,
			});

			// 同时发送 Colyseus 标准事件格式（兼容 BattleRoom 的 PROFILE_UPDATED）
			client.send("PROFILE_UPDATED", toProfileUpdatedDto(result.nickname, result.avatar));
		} catch (error) {
			console.error("[SystemRoom] Error handling profile update request:", error);
			const message = error instanceof Error ? error.message : "更新档案失败";
			client.send("PROFILE_UPDATE_RESPONSE", { success: false, error: message });
			client.send("ERROR", toErrorDto(message));
		}
	}

	/**
	 * 处理玩家档案获取请求
	 */
	private async handleProfileGetRequest(client: Client, payload: ProfileGetRequest): Promise<void> {
		try {
			const { playerId } = payload;

			if (!playerId) {
				client.send("PROFILE_GET_RESPONSE", { success: false, error: "缺少玩家标识" });
				return;
			}

			const profile = await profileService.getBasicProfile(playerId);

			client.send("PROFILE_GET_RESPONSE", {
				success: true,
				nickname: profile.nickname,
				avatar: profile.avatar,
			});
		} catch (error) {
			console.error("[SystemRoom] Error handling profile get request:", error);
			client.send("PROFILE_GET_RESPONSE", { success: false, error: "获取档案失败" });
		}
	}
}
