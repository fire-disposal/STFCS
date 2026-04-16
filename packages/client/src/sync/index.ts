/**
 * Colyseus 同步层导出
 */

// 类型导出
export * from "./types";

// 命令发送
export { GameClient } from "./GameClient";

// Payload 类型从 @vt/schema-types 导入（与后端 100% 同步）
export type {
	MoveTokenPayload,
	ToggleShieldPayload,
	FireWeaponPayload,
	VentFluxPayload,
	ClearOverloadPayload,
	SetArmorPayload,
	AdvanceMovePhasePayload,
	AssignShipPayload,
	ToggleReadyPayload,
	NextPhasePayload,
	CreateObjectPayload,
	SaveGamePayload,
	LoadGamePayload,
	KickPlayerPayload,
	UpdateProfilePayload,
	NetPingPayload,
} from "@vt/schema-types";

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