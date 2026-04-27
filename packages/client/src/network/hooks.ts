/**
 * 网络层 React Hooks
 * 
 * 设计原则：
 * 1. 使用 subscribeState 直接订阅 gameState
 * 2. React 状态变化自动触发重新渲染
 * 3. 简化逻辑，减少中间层
 * 4. 直接使用 @vt/data 的 GameRoomState 权威类型
 */

import { useEffect, useRef, useState, useCallback } from "react";
import type { SocketNetworkManager } from "./SocketNetworkManager";
import type { GameRoomState } from "@vt/data";
import { useGameStore } from "@/state/stores/gameStore";

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

/**
 * useSocketRoom - 连接到房间的 hook
 * 
 * 订阅 SocketNetworkManager 的状态变更，
 * 直接将权威 GameRoomState 写入 Zustand store。
 * 不再经过本地 RoomState/SocketRoom 中间类型转换。
 */
export function useSocketRoom(
	networkManager: SocketNetworkManager | null,
	onLeaveRoom?: () => void
): void {
	const nmRef = useRef(networkManager);
	nmRef.current = networkManager;
	const onLeaveRef = useRef(onLeaveRoom);
	onLeaveRef.current = onLeaveRoom;
	const hadStateRef = useRef(false);

	useEffect(() => {
		const nm = nmRef.current;
		if (!nm?.isConnected()) {
			log("not connected, skipping");
			useGameStore.getState().clearRoom();
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
				useGameStore.getState().clearRoom();
				return;
			}

			hadStateRef.current = true;
			log("setting GameRoomState to store", { roomId: gameState.roomId, tokenCount: Object.keys(gameState.tokens).length });
			// 直接写入权威 GameRoomState + playerId 到 Zustand
			useGameStore.getState().setRoom(gameState, nm.request.bind(nm), nm.getPlayerId());
		});

		const existingState = nm.getGameState();
		if (existingState) {
			log("found existing state", { roomId: existingState.roomId });
			hadStateRef.current = true;
			useGameStore.getState().setRoom(existingState, nm.request.bind(nm), nm.getPlayerId());
		} else {
			log("no existing state, waiting for sync:full");

			const roomId = nm.getCurrentRoomId();
			if (roomId) {
				void nm.requestFullState()
					.then((state) => {
						log("sync:request_full resolved", { roomId: (state as any)?.roomId ?? roomId });
					})
					.catch((error) => {
						log("sync:request_full failed", { roomId, error: error instanceof Error ? error.message : error });
					});
			}
		}

		return () => {
			log("unsubscribing");
			unsubscribe();
		};
	}, [networkManager, onLeaveRoom]);
}
