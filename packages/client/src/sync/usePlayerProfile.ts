import type { Room } from "@colyseus/sdk";
import type { GameRoomState, PlayerStateType } from "@/sync/types";
import { useMultiplayerState } from "./useMultiplayerState";

/**
 * 订阅玩家档案信息
 * 
 * 返回包含昵称和头像的对象，自动响应服务端 Schema 变化
 */
export function usePlayerProfile(room: Room<GameRoomState> | null): { nickname: string; avatar: string } {
	const player = useMultiplayerState(room, (state: GameRoomState) => {
		if (!room?.sessionId || !state?.players) return null;
		return state.players.get(room.sessionId) || null;
	}) as PlayerStateType | null;

	return {
		nickname: player?.nickname || "",
		avatar: player?.avatar || "",
	};
}
