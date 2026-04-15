/**
 * 系统房间
 *
 * 处理系统级 WebSocket 操作：
 * - 获取房间列表（实时推送）
 * - 远程删除房间（房主可通过此房间删除自己创建的房间）
 */

import { matchMaker, Room, Client } from "@colyseus/core";
import { toMatchmakeRoomDto } from "../dto/index.js";

interface RoomDeleteRequest {
	roomId: string;
	ownerShortId: number;
}

export class SystemRoom extends Room {
	maxClients = 100;
	autoDispose = true;
	private roomListInterval: ReturnType<typeof setInterval> | null = null;
	private static readonly ROOM_LIST_INTERVAL_MS = 3000;

	async onCreate(): Promise<void> {
		console.log("[SystemRoom] Created:", this.roomId);

		// 注册消息处理器
		this.onMessage("ROOM_LIST_REQUEST", (client: Client) => {
			this.sendRoomListToClient(client);
		});

		// 远程删除房间请求
		this.onMessage("ROOM_DELETE_REQUEST", (client: Client, payload: unknown) => {
			this.handleRoomDeleteRequest(client, payload as RoomDeleteRequest);
		});

		// 定期获取房间列表并推送给所有客户端
		this.roomListInterval = setInterval(() => {
			this.broadcastRoomList();
		}, SystemRoom.ROOM_LIST_INTERVAL_MS);
	}

	onJoin(client: Client): void {
		console.log("[SystemRoom] Client joined:", client.sessionId);
		// 加入时立即发送一次房间列表
		this.sendRoomListToClient(client);
	}

	onLeave(client: Client): void {
		console.log("[SystemRoom] Client left:", client.sessionId);
	}

	onDispose(): void {
		if (this.roomListInterval) {
			clearInterval(this.roomListInterval);
			this.roomListInterval = null;
		}
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
				client.send("ROOM_DELETE_RESPONSE", {
					success: false,
					error: "无效的请求参数",
				});
				return;
			}

			// 查询房间信息，验证房主身份
			const rooms = await matchMaker.query({});
			const targetRoom = rooms.find((r) => r.roomId === roomId);

			if (!targetRoom) {
				client.send("ROOM_DELETE_RESPONSE", {
					success: false,
					error: "房间不存在",
				});
				return;
			}

			const metadata = (targetRoom.metadata as Record<string, unknown> | undefined) || {};
			const roomOwnerShortId = Number(metadata.ownerShortId);

			// 验证请求者是否是房主
			if (roomOwnerShortId !== ownerShortId) {
				client.send("ROOM_DELETE_RESPONSE", {
					success: false,
					error: "只有房主可以删除房间",
				});
				return;
			}

			// 销毁房间
			console.log(`[SystemRoom] Destroying room ${roomId} by owner ${ownerShortId}`);
			await matchMaker.remoteRoomCall(roomId, "disconnect");

			client.send("ROOM_DELETE_RESPONSE", {
				success: true,
				roomId,
			});

			// 立即广播更新后的房间列表
			this.broadcastRoomList();
		} catch (error) {
			console.error("[SystemRoom] Error handling room delete request:", error);
			client.send("ROOM_DELETE_RESPONSE", {
				success: false,
				error: "删除房间失败",
			});
		}
	}

	/**
	 * 广播房间列表给所有客户端
	 */
	private async broadcastRoomList(): Promise<void> {
		try {
			const rooms = await matchMaker.query({});
			const battleRooms = rooms
				.filter((room) => {
					const metadata = (room.metadata as Record<string, unknown> | undefined) || {};
					return metadata.roomType === "battle";
				})
				.map((room) => toMatchmakeRoomDto(room));

			this.broadcast("ROOM_LIST_RESPONSE", { rooms: battleRooms });
		} catch (error) {
			console.error("[SystemRoom] Error broadcasting room list:", error);
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
					return metadata.roomType === "battle";
				})
				.map((room) => toMatchmakeRoomDto(room));

			client.send("ROOM_LIST_RESPONSE", { rooms: battleRooms });
		} catch (error) {
			console.error("[SystemRoom] Error sending room list to client:", error);
			client.send("ERROR", {
				code: "ROOM_LIST_ERROR",
				message: "获取房间列表失败",
			});
		}
	}
}
