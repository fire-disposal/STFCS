import type { Client } from "@colyseus/core";
import type { GameRoomState } from "../../schema/GameSchema.js";
import type { PlayerService } from "../../services/PlayerService.js";
import type { UpdateProfilePayload } from "../types.js";
import { toProfileUpdatedDto } from "../../dto/index.js";

/**
 * 处理玩家档案更新
 */
export async function handleUpdateProfile(
	state: GameRoomState,
	client: Client,
	playerService: PlayerService,
	payload: UpdateProfilePayload
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
	const player = state.players.get(client.sessionId);
	if (player) {
		player.nickname = updated.nickname;
		player.avatar = updated.avatar;
	}

	// 3. 发送确认回执给客户端
	client.send("PROFILE_UPDATED", toProfileUpdatedDto(updated.nickname, updated.avatar));
}
