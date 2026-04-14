/**
 * useMultiplayerState - Colyseus 状态响应式 Hook
 *
 * 利用 Colyseus Schema 的响应式特性，自动触发组件更新
 * 无需手动管理 stateVersion 或 forceUpdate
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

	const selectorRef = useRef(selector);
	selectorRef.current = selector;

	useEffect(() => {
		if (!room) return;

		const handleStateChange = () => {
			if (typeof selectorRef.current === "string") {
				setState((room.state as any)[selectorRef.current] ?? null);
			} else {
				setState(selectorRef.current(room.state) ?? null);
			}
		};

		// Colyseus 的 onStateChange 会在任何 Schema 字段变化时触发
		room.onStateChange(handleStateChange);

		return () => {
			room.onStateChange.remove(handleStateChange);
		};
	}, [room]);

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
 * 订阅舰船列表
 */
export function useShips(room: Room | null) {
	return useMultiplayerState(room, (state: any) => {
		if (!state?.ships) return [];

		const result: any[] = [];
		state.ships.forEach((ship: any) => {
			result.push(ship);
		});
		return result;
	});
}

/**
 * 订阅当前玩家
 */
export function useCurrentPlayer(room: Room | null) {
	return useMultiplayerState(room, (state: any) => {
		if (!room?.sessionId || !state?.players) return null;
		return state.players.get(room.sessionId) ?? null;
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
