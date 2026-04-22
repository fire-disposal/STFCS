/**
 * React Hooks for network operations
 */

import { useEffect, useState, useCallback, useRef } from "react";
import type { RoomInfo, TokenJSON, DeltaChange, WsEventName, WsPayload, WsResponseData } from "@vt/data";
import { GamePhase, Faction } from "@vt/data";
import type { SocketNetworkManager } from "./SocketNetworkManager";

export interface RoomState {
	roomId: string | null;
	playerId: string | null;
	playerName: string | null;
	isConnected: boolean;
	currentPhase: string;
	turnCount: number;
	activeFaction: string;
	tokens: Map<string, TokenJSON>;
	players: Map<string, { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean }>;
}

export interface SocketRoom {
	state: RoomState;
	sessionId: string | null;
	roomId: string;
	send: <E extends WsEventName>(event: E, payload: WsPayload<E>) => Promise<WsResponseData<E>>;
	leave: () => void;
}

function toMap(value: unknown): Map<string, unknown> {
	if (value instanceof Map) return value;
	if (value && typeof value === "object") return new Map(Object.entries(value as Record<string, unknown>));
	return new Map();
}

export function useRoomList(
	networkManager: SocketNetworkManager | null,
	refreshKey?: number
): { rooms: RoomInfo[]; isLoading: boolean; refresh: () => void } {
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [isLoading, setIsLoading] = useState(false);

	const fetchRooms = useCallback(async () => {
		if (!networkManager?.isConnected()) return;
		setIsLoading(true);
		try {
			const list = await networkManager.getRoomList();
			setRooms(list);
		} finally {
			setIsLoading(false);
		}
	}, [networkManager]);

	useEffect(() => {
		fetchRooms();
	}, [fetchRooms, refreshKey]);

	return { rooms, isLoading, refresh: fetchRooms };
}

export function useSocketRoom(
	networkManager: SocketNetworkManager | null,
	onLeaveRoom?: () => void
): SocketRoom | null {
	const [roomState, setRoomState] = useState<RoomState | null>(null);
	const stateRef = useRef<RoomState | null>(null);

	useEffect(() => {
		if (!networkManager?.isConnected()) return;

		const handleStateFull = (state: unknown) => {
			const s = state as Record<string, unknown>;
			const newState: RoomState = {
				roomId: networkManager.getCurrentRoomId(),
				playerId: networkManager.getPlayerId(),
				playerName: networkManager.getPlayerName(),
				isConnected: true,
				currentPhase: (s.phase as string) || (s.currentPhase as string) || GamePhase.DEPLOYMENT,
				turnCount: (s.turn as number) || (s.turnCount as number) || 1,
				activeFaction: (s.activeFaction as string) || Faction.PLAYER,
				tokens: toMap(s.tokens ?? s.ships) as Map<string, TokenJSON>,
				players: toMap(s.players) as Map<string, { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean }>,
			};
			stateRef.current = newState;
			setRoomState(newState);
		};

		const handleStateDelta = (data: unknown) => {
			if (!stateRef.current) return;
			const delta = data as { changes: DeltaChange[] };
			const newState = { ...stateRef.current };
			for (const change of delta.changes ?? []) {
				switch (change.type) {
					case "token_add":
					case "token_update":
						if (change.id) {
							newState.tokens = new Map(newState.tokens);
							if (change.value) newState.tokens.set(change.id, change.value as TokenJSON);
						}
						break;
					case "token_remove":
					case "token_destroyed":
						if (change.id) {
							newState.tokens = new Map(newState.tokens);
							newState.tokens.delete(change.id);
						}
						break;
					case "phase_change":
						if (change.value) newState.currentPhase = change.value as string;
						break;
					case "turn_change":
						if (typeof change.value === "number") newState.turnCount = change.value;
						break;
					case "faction_turn":
						if (change.value) newState.activeFaction = change.value as string;
						break;
					case "player_join":
					case "player_update":
						if (change.id && change.value) {
							newState.players = new Map(newState.players);
							newState.players.set(change.id, change.value as { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean });
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

		const existing = networkManager.getGameState();
		if (existing) handleStateFull(existing);

		return () => {
			networkManager.off("sync:full", handleStateFull);
			networkManager.off("sync:delta", handleStateDelta);
			networkManager.off("disconnect", handleDisconnect);
		};
	}, [networkManager, onLeaveRoom]);

	const send = useCallback(
		async <E extends WsEventName>(event: E, payload: WsPayload<E>): Promise<WsResponseData<E>> => {
			if (!networkManager) throw new Error("Network manager unavailable");
			return networkManager.request(event, payload);
		},
		[networkManager]
	);

	const leave = useCallback(() => {
		if (networkManager) networkManager.leaveRoom();
		if (onLeaveRoom) onLeaveRoom();
	}, [networkManager, onLeaveRoom]);

	if (!roomState?.roomId) return null;

	return { state: roomState, sessionId: roomState.playerId, roomId: roomState.roomId, send, leave };
}

export function useShips(room: SocketRoom | null): Array<TokenJSON & { id: string }> {
	const [ships, setShips] = useState<Array<TokenJSON & { id: string }>>([]);

	useEffect(() => {
		if (!room?.state?.tokens) {
			setShips([]);
			return;
		}

		const shipArray: Array<TokenJSON & { id: string }> = [];
		room.state.tokens.forEach((token, tokenId) => {
			shipArray.push({ ...token, id: token.$id ?? tokenId });
		});
		setShips(shipArray);
	}, [room?.state?.tokens]);

	return ships;
}