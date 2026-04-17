/**
 * useMultiplayerState - Colyseus 状态响应式 Hook
 *
 * 利用 Colyseus Schema 的响应式特性，自动触发组件更新
 * 无需手动管理 stateVersion 或 forceUpdate
 *
 * 设计原则：
 * - 使用 ref 存储 room 对象引用，避免作为 useEffect 依赖
 * - 使用 roomId 作为稳定的依赖标识
 *
 * @example
 * // 订阅整个房间状态
 * const roomState = useMultiplayerState(room, 'state');
 *
 * // 订阅玩家列表
 * const players = useMultiplayerState(room, state => state.players);
 *
 * // 订阅舰船列表
 * const ships = useMultiplayerState(room, state => state.ships);
 */

import type { Room } from "@colyseus/sdk";
import { useEffect, useRef, useState } from "react";

type StateSelector<T> = (state: any) => T;

/**
 * 基础 Hook - 订阅房间状态变化
 */
export function useMultiplayerState<T>(
	room: Room | null,
	selector: StateSelector<T> | string
): T | null {
	const [state, setState] = useState<T | null>(() => {
		if (!room?.state) return null;

		if (typeof selector === "string") {
			return (room.state as any)[selector] ?? null;
		}

		return selector(room.state) ?? null;
	});

	// ⚠️ 使用 ref 存储 room 对象和 selector，避免作为 useEffect 依赖
	const roomRef = useRef(room);
	roomRef.current = room;

	const selectorRef = useRef(selector);
	selectorRef.current = selector;

	// ⚠️ 使用 roomId 作为稳定的依赖标识
	const roomId = room?.roomId;

	useEffect(() => {
		const currentRoom = roomRef.current;
		if (!currentRoom) return;

		const handleStateChange = () => {
			if (typeof selectorRef.current === "string") {
				setState((currentRoom.state as any)[selectorRef.current] ?? null);
			} else {
				setState(selectorRef.current(currentRoom.state) ?? null);
			}
		};

		// Colyseus 的 onStateChange 会在任何 Schema 字段变化时触发
		currentRoom.onStateChange(handleStateChange);

		return () => {
			currentRoom.onStateChange.remove(handleStateChange);
		};
	}, [roomId]); // ⚠️ 仅依赖 roomId，不依赖 room 对象

	return state;
}

/**
 * 订阅玩家列表（已过滤断开的玩家）
 */
export function usePlayers(room: Room | null) {
	return useMultiplayerState(room, (state: any) => {
		if (!state?.players) return [];

		const result: any[] = [];
		state.players.forEach((player: any) => {
			if (player.connected) {
				result.push(player);
			}
		});
		return result;
	});
}

/**
 * 订阅舰船列表 - 使用 MapSchema 原生事件
 */
export function useShips(room: Room | null) {
	const [ships, setShips] = useState<any[]>([]);

	// ⚠️ 使用 ref 存储 room 对象，避免作为 useEffect 依赖
	const roomRef = useRef(room);
	roomRef.current = room;

	// ⚠️ 使用 roomId 作为稳定的依赖标识
	const roomId = room?.roomId;

	useEffect(() => {
		const currentRoom = roomRef.current;
		if (!currentRoom?.state?.ships) {
			setShips([]);
			return;
		}

		const shipsMap = currentRoom.state.ships;

		const getShipsArray = (): any[] => {
			const arr: any[] = [];
			shipsMap.forEach((ship: any) => arr.push(ship));
			return arr;
		};

		setShips(getShipsArray());

		const handleStateChange = () => {
			setShips(getShipsArray());
		};

		currentRoom.onStateChange(handleStateChange);

		return () => {
			currentRoom.onStateChange.remove(handleStateChange);
		};
	}, [roomId]); // ⚠️ 仅依赖 roomId，不依赖 room 对象

	return ships;
}

/**
 * 订阅当前玩家
 */
export function useCurrentPlayer(room: Room | null) {
	// ⚠️ sessionId 是稳定的字符串值
	const sessionId = room?.sessionId;
	return useMultiplayerState(room, (state: any) => {
		if (!sessionId || !state?.players) return null;
		return state.players.get(sessionId) ?? null;
	});
}

/**
 * 订阅游戏阶段
 */
export function useGamePhase(room: Room | null) {
	return useMultiplayerState(room, (state: any) => state?.currentPhase ?? "DEPLOYMENT");
}

/**
 * 订阅回合数
 */
export function useTurnCount(room: Room | null) {
	return useMultiplayerState(room, (state: any) => state?.turnCount ?? 1);
}

/**
 * 订阅活跃阵营
 */
export function useActiveFaction(room: Room | null) {
	return useMultiplayerState(room, (state: any) => state?.activeFaction ?? "PLAYER");
}
