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

function toMap(value: unknown): Map<string, any> {
	if (value instanceof Map) {
		return value;
	}
	if (value && typeof value === "object") {
		return new Map(Object.entries(value as Record<string, any>));
	}
	return new Map();
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
				currentPhase: state.phase || state.currentPhase || "DEPLOYMENT",
				turnCount: state.turn || state.turnCount || 1,
				activeFaction: state.activeFaction || "PLAYER",
				ships: toMap(state.tokens ?? state.ships),
				players: toMap(state.players),
			};
			stateRef.current = newState;
			setRoomState(newState);
		};

		const handleStateDelta = (data: { changes: any[] }) => {
			if (!stateRef.current) return;
			const newState = { ...stateRef.current };
			for (const change of data.changes ?? []) {
				switch (change.type) {
					case "token_add":
					case "token_update":
						if (change.id) {
							newState.ships = new Map(newState.ships);
							if (change.field === "runtime") {
								const current = newState.ships.get(change.id);
								if (current?.tokenJson) {
									newState.ships.set(change.id, {
										...current,
										tokenJson: {
											...current.tokenJson,
											runtime: {
												...current.tokenJson.runtime,
												...change.value,
											},
										},
									});
								} else if (change.value) {
									newState.ships.set(change.id, change.value);
								}
							} else if (change.value) {
								newState.ships.set(change.id, change.value);
							}
						}
						break;
					case "token_remove":
					case "token_destroyed":
						if (change.id) {
							newState.ships = new Map(newState.ships);
							newState.ships.delete(change.id);
						}
						break;
					case "phase_change":
						if (change.value) {
							newState.currentPhase = change.value;
						}
						break;
					case "turn_change":
						if (typeof change.value === "number") {
							newState.turnCount = change.value;
						}
						break;
					case "faction_turn":
						if (change.value) {
							newState.activeFaction = change.value;
						}
						break;
					case "player_update":
					case "player_join":
						if (change.id) {
							newState.players = new Map(newState.players);
							newState.players.set(change.id, change.value);
						}
						break;
					case "player_leave":
						if (change.id) {
							newState.players = new Map(newState.players);
							newState.players.delete(change.id);
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

		networkManager.on("sync:full", handleStateFull);
		networkManager.on("sync:delta", handleStateDelta);
		networkManager.on("disconnect", handleDisconnect);

		const existingState = networkManager?.getGameState();
		if (existingState) {
			handleStateFull(existingState);
		}

		return () => {
			if (networkManager) {
				networkManager.off("sync:full", handleStateFull);
				networkManager.off("sync:delta", handleStateDelta);
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
			room.state.ships.forEach((token: any, tokenId: string) => {
				if (token?.tokenJson?.runtime && token?.tokenJson?.token) {
					shipArray.push({
						id: token.id ?? tokenId,
						name: token.tokenJson.metadata?.name,
						...token.tokenJson.runtime,
						width: token.tokenJson.token.width,
						length: token.tokenJson.token.length,
						hullMax: token.tokenJson.token.maxHitPoints,
						fluxCapacity: token.tokenJson.token.fluxCapacity,
						maxSpeed: token.tokenJson.token.maxSpeed,
						maxTurnRate: token.tokenJson.token.maxTurnRate,
					});
				} else {
					shipArray.push(token);
				}
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