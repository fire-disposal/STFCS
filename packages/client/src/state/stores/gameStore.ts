import { create } from "zustand";
import { useMemo } from "react";
import type { GameRoomState, CombatToken, RoomPlayerState, WsEventName, WsPayload, WsResponseData, MovementPhase } from "@vt/data";

export type MovementPhaseValue = MovementPhase | undefined;

export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	viewRotation?: number;
	followingShipId?: string | null;
}

export interface PlayerCamera extends CameraState {
	playerId: string;
}

export const DEFAULT_CAMERA: CameraState = {
	x: 0,
	y: 0,
	zoom: 1,
	viewRotation: 0,
};

interface GameActionSender {
	send: <E extends WsEventName>(event: E, payload: WsPayload<E>) => Promise<WsResponseData<E>>;
	isAvailable: () => boolean;
}

interface GameStore {
	state: GameRoomState | null;
	actionSender: GameActionSender;
	playerId: string | null;

	setRoom: (state: GameRoomState, send: GameActionSender["send"], playerId?: string | null) => void;
	clearRoom: () => void;
	updateState: (state: GameRoomState) => void;
	setPlayerId: (playerId: string | null) => void;
}

const emptySender: GameActionSender = {
	send: async () => { throw new Error("Room not available"); },
	isAvailable: () => false,
};

export const useGameStore = create<GameStore>((set) => ({
	state: null,
	actionSender: emptySender,
	playerId: null,

	setRoom: (state, send, playerId) => set({
		state,
		playerId: playerId ?? null,
		actionSender: {
			send,
			isAvailable: () => true,
		},
	}),

	clearRoom: () => set({
		state: null,
		actionSender: emptySender,
	}),

	updateState: (state) => set({ state }),

	setPlayerId: (playerId) => set({ playerId }),
}));

// ===================== 选择器 =====================

/** 用于 ?? 回退的空对象常量，确保引用稳定（避免 React useSyncExternalStore getSnapshot 缓存警告） */
const EMPTY_TOKENS: Record<string, CombatToken> = {};
const EMPTY_PLAYERS: Record<string, RoomPlayerState> = {};

// 基础数据
export const useGameState = () => useGameStore((s) => s.state);
export const useGameActionSender = () => useGameStore((s) => s.actionSender);
export const useGamePlayerId = () => useGameStore((s) => s.playerId);

// 派生数据（使用模块级常量避免 ?? 创建新引用）
export const useGameRoomId = () => useGameStore((s) => s.state?.roomId ?? null);
export const useGameTokens = () => useGameStore((s) => s.state?.tokens ?? EMPTY_TOKENS);
export const useGamePlayers = () => useGameStore((s) => s.state?.players ?? EMPTY_PLAYERS);
export const useGamePhase = () => useGameStore((s) => s.state?.phase ?? "DEPLOYMENT");
export const useGameTurnCount = () => useGameStore((s) => s.state?.turnCount ?? 0);
export const useGameActiveFaction = () => useGameStore((s) => s.state?.activeFaction);

// 便捷 hooks
export function useGameToken(tokenId: string | null): CombatToken | null {
	const tokens = useGameTokens();
	if (!tokenId) return null;
	return tokens[tokenId] ?? null;
}

export function useGameCurrentPlayer(): RoomPlayerState | undefined {
	const playerId = useGamePlayerId();
	const players = useGamePlayers();
	if (!playerId) return undefined;
	return players[playerId];
}

export function useGamePlayer(playerId: string | null): RoomPlayerState | null {
	const players = useGamePlayers();
	if (!playerId) return null;
	return players[playerId] ?? null;
}

export function useAllTokens(): CombatToken[] {
	const tokens = useGameTokens();
	return Object.values(tokens);
}

export function useConnectedPlayers(): RoomPlayerState[] {
	const players = useGamePlayers();
	return Object.values(players).filter((p) => p.connected);
}

// 非 hooks 访问器（用于回调/事件处理器）
export const getGameActionSender = () => useGameStore.getState().actionSender;
export const getGameState = () => useGameStore.getState().state;
export const getGamePlayerId = () => useGameStore.getState().playerId;

/**
 * 兼容层：为仍使用 room.send 的旧代码提供过渡接口
 * 新代码应直接使用 useGameActionSender
 */
export const useGameRoom = () => {
	const state = useGameStore((s) => s.state);
	const sender = useGameStore((s) => s.actionSender);
	const value = useMemo(() => {
		if (!state) return null;
		return {
			roomId: state.roomId,
			state,
			send: sender.send,
		};
	}, [state, sender]);
	return value;
};
