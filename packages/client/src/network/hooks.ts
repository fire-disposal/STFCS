/**
 * React Hooks for network operations
 */

import { useEffect, useState, useCallback, useRef } from "react";
import type { RoomInfo, CombatToken, StatePatch, WsEventName, WsPayload, WsResponseData } from "@vt/data";
import { GamePhase, Faction } from "@vt/data";
import type { SocketNetworkManager } from "./SocketNetworkManager";
import { setGameRoomRef } from "@/state/stores/uiStore";

export interface RoomState {
	roomId: string | null;
	playerId: string | null;
	playerName: string | null;
	isConnected: boolean;
	currentPhase: string;
	turnCount: number;
	activeFaction: string;
	tokens: Record<string, CombatToken>;
	players: Record<string, { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean }>;
}

export interface SocketRoom {
	state: RoomState;
	sessionId: string | null;
	roomId: string;
	send: <E extends WsEventName>(event: E, payload: WsPayload<E>) => Promise<WsResponseData<E>>;
	leave: () => void;
}

export function useRoomList(
	networkManager: SocketNetworkManager | null,
	refreshKey?: number
): { rooms: RoomInfo[]; isLoading: boolean; refresh: () => void } {
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const networkManagerRef = useRef(networkManager);
	networkManagerRef.current = networkManager;

	const fetchRooms = useCallback(async () => {
		const nm = networkManagerRef.current;
		if (!nm?.isConnected()) return;
		setIsLoading(true);
		try {
			const list = await nm.getRoomList();
			setRooms(list);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		fetchRooms();
	}, [fetchRooms, refreshKey]);

	useEffect(() => {
		const nm = networkManagerRef.current;
		if (!nm?.isConnected()) return;

		const handleRoomUpdate = (data: unknown) => {
			const update = data as { action: string; room?: RoomInfo; roomId?: string };
			if (update.action === "created" && update.room) {
				setRooms((prev) => [...prev, update.room!]);
			} else if (update.action === "removed" && update.roomId) {
				setRooms((prev) => prev.filter((r) => r.roomId !== update.roomId));
			} else if (update.action === "updated" && update.room) {
				setRooms((prev) => prev.map((r) => r.roomId === update.room!.roomId ? update.room! : r));
			} else {
				fetchRooms();
			}
		};

		nm.on("room:list_updated", handleRoomUpdate);
		return () => {
			nm.off("room:list_updated", handleRoomUpdate);
		};
	}, [fetchRooms]);

	return { rooms, isLoading, refresh: fetchRooms };
}

export function useSocketRoom(
	networkManager: SocketNetworkManager | null,
	onLeaveRoom?: () => void
): SocketRoom | null {
	const [roomState, setRoomState] = useState<RoomState | null>(null);
	const stateRef = useRef<RoomState | null>(null);
	const socketRoomRef = useRef<SocketRoom | null>(null);
	const networkManagerRef = useRef(networkManager);
	networkManagerRef.current = networkManager;
	const onLeaveRoomRef = useRef(onLeaveRoom);
	onLeaveRoomRef.current = onLeaveRoom;

	useEffect(() => {
		const nm = networkManagerRef.current;
		if (!nm?.isConnected()) return;

		const handleStateFull = (state: unknown) => {
			const s = state as Record<string, unknown>;
			const roomId = (s.roomId as string) || nm.getCurrentRoomId();
			if (!roomId) return;
			
			const newState: RoomState = {
				roomId,
				playerId: nm.getPlayerId(),
				playerName: nm.getPlayerName(),
				isConnected: true,
				currentPhase: (s.phase as string) || GamePhase.DEPLOYMENT,
				turnCount: (s.turnCount as number) || 1,
				activeFaction: (s.activeFaction as string) || Faction.PLAYER,
				tokens: (s.tokens as Record<string, CombatToken>) || {},
				players: (s.players as Record<string, { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean }>) || {},
			};
			stateRef.current = newState;
			setRoomState(newState);
		};

		const handleStatePatch = (data: unknown) => {
			if (!stateRef.current) return;
			const patchData = data as { patches: StatePatch[]; timestamp: number };
			const newState = { ...stateRef.current };
			
			for (const patch of patchData.patches) {
				const path = patch.path;
				if (path.length === 0) continue;

				const [rootKey, ...restPath] = path;

				if (rootKey === "tokens") {
					newState.tokens = { ...newState.tokens };
					if (restPath.length === 0) {
						if (patch.op === "add" && patch.value) {
							const token = patch.value as CombatToken;
							newState.tokens[token.$id] = token;
						}
					} else {
						const tokenId = String(restPath[0]);
						if (patch.op === "remove") {
							delete newState.tokens[tokenId];
						} else {
							const existing = newState.tokens[tokenId];
							if (existing) {
								const updated = applyPatchToToken(existing, restPath.slice(1), patch);
								newState.tokens[tokenId] = updated;
							} else if (patch.op === "add" && patch.value) {
								newState.tokens[tokenId] = patch.value as CombatToken;
							}
						}
					}
				} else if (rootKey === "players") {
					newState.players = { ...newState.players };
					if (restPath.length === 0) {
						if (patch.op === "add" && patch.value) {
							const player = patch.value as { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean };
							newState.players[player.sessionId] = player;
						}
					} else {
						const playerId = String(restPath[0]);
						if (patch.op === "remove") {
							delete newState.players[playerId];
						} else {
							const existing = newState.players[playerId];
							if (existing) {
								const updated = applyPatchToPlayer(existing, restPath.slice(1), patch);
								newState.players[playerId] = updated;
							}
						}
					}
				} else if (rootKey === "phase" && patch.op === "replace") {
					newState.currentPhase = patch.value as string;
				} else if (rootKey === "turnCount" && patch.op === "replace") {
					newState.turnCount = patch.value as number;
				} else if (rootKey === "activeFaction" && patch.op === "replace") {
					newState.activeFaction = patch.value as string;
				}
			}

			stateRef.current = newState;
			setRoomState(newState);
		};

		const handleDisconnect = () => {
			setRoomState(null);
			stateRef.current = null;
			if (onLeaveRoomRef.current) onLeaveRoomRef.current();
		};

		nm.on("sync:full", handleStateFull);
		nm.on("state:patch", handleStatePatch);
		nm.on("disconnect", handleDisconnect);

		const existing = nm.getGameState();
		if (existing) handleStateFull(existing);

		return () => {
			nm.off("sync:full", handleStateFull);
			nm.off("state:patch", handleStatePatch);
			nm.off("disconnect", handleDisconnect);
		};
	}, []);

	const send = useCallback(
		async <E extends WsEventName>(event: E, payload: WsPayload<E>): Promise<WsResponseData<E>> => {
			const nm = networkManagerRef.current;
			if (!nm) throw new Error("Network manager unavailable");
			return nm.request(event, payload);
		},
		[]
	);

	const leave = useCallback(() => {
		const nm = networkManagerRef.current;
		if (nm) nm.leaveRoom();
		if (onLeaveRoomRef.current) onLeaveRoomRef.current();
	}, []);

	if (!roomState?.roomId) return null;

	if (!socketRoomRef.current || socketRoomRef.current.roomId !== roomState.roomId) {
		socketRoomRef.current = {
			state: roomState,
			sessionId: roomState.playerId,
			roomId: roomState.roomId,
			send,
			leave,
		};
		setGameRoomRef(socketRoomRef.current);
	} else {
		socketRoomRef.current.state = roomState;
	}

	return socketRoomRef.current;
}

function applyPatchToToken(token: CombatToken, path: (string | number)[], patch: StatePatch): CombatToken {
	const result = { ...token };
	let current: unknown = result;

	for (let i = 0; i < path.length - 1; i++) {
		const key = path[i];
		if (current && typeof current === "object") {
			const obj = current as Record<string | number, unknown>;
			if (!obj[key]) obj[key] = typeof path[i + 1] === "number" ? [] : {};
			current = obj[key];
		}
	}

	if (current && typeof current === "object") {
		const obj = current as Record<string | number, unknown>;
		const finalKey = path[path.length - 1];
		if (patch.op === "remove") {
			delete obj[finalKey];
		} else {
			obj[finalKey] = patch.value;
		}
	}

	return result;
}

function applyPatchToPlayer(
	player: { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean },
	path: (string | number)[],
	patch: StatePatch
): { sessionId: string; nickname: string; role: string; isReady: boolean; connected: boolean } {
	const result = { ...player };
	const finalKey = path[path.length - 1] as string;

	if (patch.op === "remove") {
		delete (result as Record<string, unknown>)[finalKey];
	} else if (finalKey in result) {
		(result as Record<string, unknown>)[finalKey] = patch.value;
	}

	return result;
}

export function useTokens(room: SocketRoom | null): Array<CombatToken & { id: string }> {
	const [tokens, setTokens] = useState<Array<CombatToken & { id: string }>>([]);

	useEffect(() => {
		if (!room?.state?.tokens) {
			setTokens([]);
			return;
		}

		const tokenArray: Array<CombatToken & { id: string }> = [];
		for (const [tokenId, token] of Object.entries(room.state.tokens)) {
			tokenArray.push({ ...token, id: token.$id ?? tokenId });
		}
		setTokens(tokenArray);
	}, [room?.state?.tokens]);

	return tokens;
}

export { useTokens as useShips };