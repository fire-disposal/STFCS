import type { NetworkManager } from "@/network/NetworkManager";
import type { Room } from "@colyseus/sdk";
import type { GameRoomState } from "@/sync/types";
import { useEffect, useState } from "react";

interface UseCurrentGameRoomOptions {
	networkManager: NetworkManager;
	onLeaveRoom: () => void;
}

/**
 * 获取当前游戏房间 Hook
 *
 * Colyseus 的 Room 对象是响应式的，状态变化会自动触发 React 重新渲染
 * 不需要额外的 stateVersion 来手动触发更新
 */
export function useCurrentGameRoom({
	networkManager,
	onLeaveRoom,
}: UseCurrentGameRoomOptions): Room<GameRoomState> | null {
	const [room, setRoom] = useState<Room<GameRoomState> | null>(null);

	useEffect(() => {
		const currentRoom = networkManager.getCurrentRoom();

		// 房间对象变化时更新状态
		if (currentRoom !== room) {
			setRoom(currentRoom);
		}

		if (!currentRoom) {
			return;
		}

		// 只监听房间离开事件，不需要监听状态变化
		// Colyseus Schema 的响应式会自动触发 React 更新
		const isActive = { current: true };
		const handleLeave = () => {
			if (isActive.current) onLeaveRoom();
		};

		currentRoom.onLeave(handleLeave);

		return () => {
			isActive.current = false;
			if (typeof currentRoom.onLeave?.remove === "function") {
				currentRoom.onLeave.remove(handleLeave);
			}
		};
	}, [networkManager, onLeaveRoom, room]);

	// 开发环境警告：帮助发现潜在的竞态条件
	if (import.meta.env.DEV && !room?.state) {
		console.warn(
			"[useCurrentGameRoom] Room state not ready - this may indicate a race condition. " +
				"Consider adding a loading state in the parent component."
		);
	}

	return room;
}
