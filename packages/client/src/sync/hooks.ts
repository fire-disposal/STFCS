/**
 * React Hooks for Socket.IO game state
 */

import { useEffect, useState, useCallback, useRef } from "react";
import type { SocketNetworkManager, RoomInfo } from "../network/SocketNetworkManager";

export interface SocketRoomState {
	roomId: string | null;
	playerId: string | null;
	playerName: string | null;
	isConnected: boolean;
	currentPhase: string;
	turnCount: number;
	activeFaction: string;
	ships: Map<string, any>;
	players: Map<string, any>;
}

export interface SocketRoom {
	state: SocketRoomState;
	sessionId: string | null;
	roomId: string;
	send: (event: string, payload: unknown) => Promise<any>;
	leave: () => void;
}

export function useSocketRoom(
	networkManager: SocketNetworkManager | null | undefined,
	onLeaveRoom?: () => void
): SocketRoom | null {
	const [roomState, setRoomState] = useState<SocketRoomState | null>(null);
	const stateRef = useRef<SocketRoomState | null>(null);

	useEffect(() => {
		if (!networkManager || !networkManager.isConnected()) return;

		const handleStateFull = (state: any) => {
			const newState: SocketRoomState = {
				roomId: networkManager.getCurrentRoomId(),
				playerId: networkManager.getPlayerId(),
				playerName: networkManager.getPlayerName(),
				isConnected: true,
				currentPhase: state.currentPhase || "DEPLOYMENT",
				turnCount: state.turnCount || 1,
				activeFaction: state.activeFaction || "PLAYER",
				ships: new Map(Object.entries(state.ships || {})),
				players: new Map(Object.entries(state.players || {})),
			};
			stateRef.current = newState;
			setRoomState(newState);
		};

		const handleStateDelta = (data: { events: any[] }) => {
			if (!stateRef.current) return;
			const newState = { ...stateRef.current };
			for (const event of data.events) {
				switch (event.type) {
					case "ship_update":
						if (event.shipId && event.data) {
							newState.ships = new Map(newState.ships);
							newState.ships.set(event.shipId, event.data);
						}
						break;
					case "phase_change":
						if (event.phase) {
							newState.currentPhase = event.phase;
						}
						break;
					case "turn_change":
						if (event.turn) {
							newState.turnCount = event.turn;
						}
						break;
				}
			}
			stateRef.current = newState;
			setRoomState(newState);
		};

		const handleDisconnect = () => {
			setRoomState(null);
			stateRef.current = null;
			if (onLeaveRoom) onLeaveRoom();
		};

		networkManager.on("state:full", handleStateFull);
		networkManager.on("state:delta", handleStateDelta);
		networkManager.on("disconnect", handleDisconnect);

		const existingState = networkManager?.getGameState();
		if (existingState) {
			handleStateFull(existingState);
		}

		return () => {
			if (networkManager) {
				networkManager.off("state:full", handleStateFull);
				networkManager.off("state:delta", handleStateDelta);
				networkManager.off("disconnect", handleDisconnect);
			}
		};
	}, [networkManager, onLeaveRoom]);

	const send = useCallback(
		async (event: string, payload: unknown) => {
			if (!networkManager) {
				throw new Error("Network manager is not available");
			}
			return networkManager.send(event, payload);
		},
		[networkManager]
	);

	const leave = useCallback(() => {
		if (networkManager) {
			networkManager.leaveRoom();
		}
		if (onLeaveRoom) onLeaveRoom();
	}, [networkManager, onLeaveRoom]);

	if (!roomState || !roomState.roomId) return null;

	return {
		state: roomState,
		sessionId: roomState.playerId,
		roomId: roomState.roomId,
		send,
		leave,
	};
}

export function useShips(room: SocketRoom | null): any[] {
	const [ships, setShips] = useState<any[]>([]);

	useEffect(() => {
		if (!room?.state?.ships) {
			setShips([]);
			return;
		}

		const updateShips = () => {
			const shipArray: any[] = [];
			room.state.ships.forEach((ship: any) => {
				shipArray.push(ship);
			});
			setShips(shipArray);
		};

		updateShips();

		return () => { };
	}, [room?.state?.ships]);

	return ships;
}

export function useRoomList(
	networkManager: SocketNetworkManager | null | undefined,
	refreshKey?: number
): { rooms: RoomInfo[]; isLoading: boolean; refresh: () => void } {
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const fetchRooms = useCallback(async () => {
		if (!networkManager || !networkManager.isConnected()) return;
		setIsLoading(true);
		try {
			const list = await networkManager.getRoomList();
			setRooms(list);
		} catch (error) {
			console.error("[useRoomList] Failed to fetch rooms", error);
		} finally {
			setIsLoading(false);
		}
	}, [networkManager]);

	useEffect(() => {
		fetchRooms();
	}, [fetchRooms, refreshKey]);

	return { rooms, isLoading, refresh: fetchRooms };
}