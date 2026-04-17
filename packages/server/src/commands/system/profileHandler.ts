import type { Client } from "@colyseus/core";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { PlayerService } from "../../services/PlayerService.js";
import type { UpdateProfilePayload } from "../types.js";

/**
 * 处理玩家档案更新
 */
export async function handleUpdateProfile(
	state: GameRoomState,
	client: Client,
	playerService: PlayerService,
	payload: UpdateProfilePayload,
	broadcast: (type: string, data: unknown) => void
): Promise<void> {
	console.log(`[ProfileHandler] Updating profile for ${client.sessionId}`, {
		nickname: payload.nickname,
		avatarLength: payload.avatar?.length || 0
	});

	// 1. 持久化到 PlayerService
	const updated = await playerService.updateProfile(client.sessionId, {
		nickname: payload.nickname,
		avatar: payload.avatar,
	});

	if (!updated) {
		throw new Error("更新档案失败：玩家服务未找到会话");
	}

	// 2. 同步到 GameRoomState 中的当前玩家实例（Schema）
	// 注意：nickname 通过 Schema 同步，avatar 不通过 Schema（大数据）
	const player = state.players.get(client.sessionId);
	if (player) {
		player.nickname = updated.nickname;
		player.avatar = updated.avatar; // 服务端内存存储，不通过 @type 同步
	}

	// 3. 发送确认回执给客户端（不含头像数据，避免大消息）
	client.send("PROFILE_UPDATED", { success: true, nickname: updated.nickname });

	// 4. 如果有头像更新，广播 PLAYER_AVATAR 消息给房间内所有客户端
	if (updated.avatar) {
		broadcast("PLAYER_AVATAR", {
			shortId: updated.shortId,
			avatar: updated.avatar,
		});
	}
}
