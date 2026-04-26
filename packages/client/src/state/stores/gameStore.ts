import { create } from "zustand";
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

interface SocketRoom {
	roomId: string;
	state: GameRoomState;
	send: GameActionSender["send"];
}

interface GameStore {
	room: SocketRoom | null;
	state: GameRoomState | null;
	actionSender: GameActionSender;
	
	setRoom: (room: SocketRoom | null) => void;
	clearRoom: () => void;
	updateState: (state: GameRoomState) => void;
}

const emptySender: GameActionSender = {
	send: async () => { throw new Error("Room not available"); },
	isAvailable: () => false,
};

export const useGameStore = create<GameStore>((set) => ({
	room: null,
	state: null,
	actionSender: emptySender,
	
	setRoom: (room) => {
		if (room) {
			set({
				room,
				state: room.state,
				actionSender: {
					send: room.send,
					isAvailable: () => true,
				},
			});
		} else {
			set({
				room: null,
				state: null,
				actionSender: emptySender,
			});
		}
	},
	
	clearRoom: () => set({
		room: null,
		state: null,
		actionSender: emptySender,
	}),
	
	updateState: (state) => set({ state }),
}));

export const useGameRoom = () => useGameStore((s) => s.room);
export const useGameState = () => useGameStore((s) => s.state);
export const useGameActionSender = () => useGameStore((s) => s.actionSender);
export const useGameRoomId = () => useGameStore((s) => s.room?.roomId ?? null);

export const useGameTokens = () => useGameStore((s) => s.state?.tokens ?? {});
export const useGamePlayers = () => useGameStore((s) => s.state?.players ?? {});
export const useGamePhase = () => useGameStore((s) => s.state?.phase ?? "DEPLOYMENT");
export const useGameTurnCount = () => useGameStore((s) => s.state?.turnCount ?? 0);
export const useGameActiveFaction = () => useGameStore((s) => s.state?.activeFaction);

export function useGameToken(tokenId: string | null): CombatToken | null {
	const tokens = useGameTokens();
	if (!tokenId) return null;
	return tokens[tokenId] ?? null;
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

export const getGameActionSender = () => useGameStore.getState().actionSender;
export const getGameRoom = () => useGameStore.getState().room;
export const getGameState = () => useGameStore.getState().state;