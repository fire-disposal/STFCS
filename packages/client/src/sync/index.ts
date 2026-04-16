/**
 * Colyseus 同步层导出
 */

// 类型导出
export * from "./types";

// 命令发送
export { GameClient } from "./GameClient";
export type {
	MovePayload,
	FireWeaponPayload,
	ToggleShieldPayload,
	UpdateProfilePayload,
} from "./GameClient";

// Hooks
export { useCurrentGameRoom } from "./useCurrentGameRoom";
export {
	useMultiplayerState,
	usePlayers,
	useShips,
	useCurrentPlayer,
	useGamePhase,
	useTurnCount,
	useActiveFaction,
} from "./useMultiplayerState";