/**
 * 网络层 React Hooks
 * 
 * 设计原则：
 * 1. 使用 subscribeState 直接订阅 gameState
 * 2. React 状态变化自动触发重新渲染
 * 3. 简化逻辑，减少中间层
 */

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import type { SocketNetworkManager } from "./SocketNetworkManager";
import type { CombatToken } from "@vt/data";
import { Faction as FactionEnum } from "@vt/data";
import { setGameRoomRef } from "@/state/stores/uiStore";

const log = (...args: unknown[]) => console.log("[useSocketRoom]", ...args);

export interface RoomInfo {
	roomId: string;
	name: string;
	ownerId: string;
	ownerName: string;
	playerCount: number;
	maxPlayers: number;
	phase: string;
	turnCount: number;
	createdAt: number;
}

export interface RoomState {
	roomId: string;
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
	send: <E extends keyof any>(event: E, payload: any) => Promise<any>;
	leave: () => void;
}

export function useRoomList(
	networkManager: SocketNetworkManager | null,
	refreshKey?: number
): { rooms: RoomInfo[]; isLoading: boolean; refresh: () => void } {
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const nmRef = useRef(networkManager);
	nmRef.current = networkManager;

	const fetchRooms = useCallback(async () => {
		const nm = nmRef.current;
		if (!nm?.isConnected()) return;
		setIsLoading(true);
		try {
			const list = await nm.getRoomList();
			setRooms(list as RoomInfo[]);
		} finally {
			setIsLoading(false);
		}
	}, []);

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
	const nmRef = useRef(networkManager);
	nmRef.current = networkManager;
	const onLeaveRef = useRef(onLeaveRoom);
	onLeaveRef.current = onLeaveRoom;
	const hadStateRef = useRef(false);

	useEffect(() => {
		const nm = nmRef.current;
		if (!nm?.isConnected()) {
			log("not connected, skipping");
			setRoomState(null);
			return;
		}

		log("subscribing to state changes");

		const unsubscribe = nm.subscribeState((gameState) => {
			log("state update received", { hasState: !!gameState, roomId: gameState?.roomId, hadState: hadStateRef.current });

			if (!gameState) {
				if (hadStateRef.current && onLeaveRef.current) {
					log("state lost, triggering onLeaveRoom");
					hadStateRef.current = false;
					onLeaveRef.current();
				}
				setRoomState(null);
				return;
			}

			hadStateRef.current = true;
			log("setting roomState", { roomId: gameState.roomId });
			setRoomState({
				roomId: gameState.roomId,
				playerId: nm.getPlayerId(),
				playerName: nm.getPlayerName(),
				isConnected: true,
				currentPhase: gameState.phase,
				turnCount: gameState.turnCount,
				activeFaction: gameState.activeFaction ?? FactionEnum.PLAYER,
				tokens: gameState.tokens,
				players: gameState.players as any,
			});
		});

		const existingState = nm.getGameState();
		if (existingState) {
			log("found existing state", { roomId: existingState.roomId });
			hadStateRef.current = true;
			setRoomState({
				roomId: existingState.roomId,
				playerId: nm.getPlayerId(),
				playerName: nm.getPlayerName(),
				isConnected: true,
				currentPhase: existingState.phase,
				turnCount: existingState.turnCount,
				activeFaction: existingState.activeFaction ?? FactionEnum.PLAYER,
				tokens: existingState.tokens,
				players: existingState.players as any,
			});
		} else {
			log("no existing state, waiting for sync:full");
		}

		return () => {
			log("unsubscribing");
			unsubscribe();
		};
	}, [networkManager, onLeaveRoom]);

	const send = useCallback(
		async <E extends keyof any>(event: E, payload: any): Promise<any> => {
			const nm = nmRef.current;
			if (!nm) throw new Error("Network unavailable");
			return nm.request(event as any, payload);
		},
		[]
	);

	const leave = useCallback(() => {
		const nm = nmRef.current;
		if (nm) nm.leaveRoom();
		if (onLeaveRef.current) onLeaveRef.current();
	}, []);

	if (!roomState?.roomId) return null;

	const socketRoom = useMemo(() => ({
		state: roomState,
		sessionId: roomState.playerId,
		roomId: roomState.roomId,
		send,
		leave,
	}), [roomState, send, leave]);

	setGameRoomRef(socketRoom);

	return socketRoom;
}

export function useTokens(room: SocketRoom | null): Array<CombatToken & { id: string }> {
	const [tokens, setTokens] = useState<Array<CombatToken & { id: string }>>([]);

	useEffect(() => {
		if (!room?.state?.tokens) {
			setTokens([]);
			return;
		}

		const arr: Array<CombatToken & { id: string }> = [];
		for (const [id, token] of Object.entries(room.state.tokens)) {
			arr.push({ ...token, id });
		}
		setTokens(arr);
	}, [room?.state?.tokens]);

	return tokens;
}

export { useTokens as useShips };