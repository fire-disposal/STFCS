import type { NetworkManager } from "@/network/NetworkManager";
import type { Room } from "@colyseus/sdk";
import type { GameRoomState } from "@vt/contracts";
import { useEffect, useState } from "react";

interface UseCurrentGameRoomOptions {
	networkManager: NetworkManager;
	onLeaveRoom: () => void;
}

export function useCurrentGameRoom({ networkManager, onLeaveRoom }: UseCurrentGameRoomOptions) {
	const [room, setRoom] = useState<Room<GameRoomState> | null>(null);
	const [, setVersion] = useState(0);

	useEffect(() => {
		const currentRoom = networkManager.getCurrentRoom();

		if (!currentRoom) {
			setRoom(null);
			return;
		}

		setRoom(currentRoom);

		const handleStateChange = () => {
			setVersion((value) => value + 1);
		};

		const handleLeave = () => {
			onLeaveRoom();
		};

		currentRoom.onStateChange(handleStateChange);
		currentRoom.onLeave(handleLeave);

		return () => {
			currentRoom.onStateChange.remove(handleStateChange);
			currentRoom.onLeave.remove(handleLeave);
		};
	}, [networkManager, onLeaveRoom]);

	if (!room) {
		return null;
	}

	if (!room.state) {
		console.warn("[useCurrentGameRoom] Room state not ready yet");
		return null;
	}

	return room;
}
