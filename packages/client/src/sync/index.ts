/**
 * Colyseus 同步层导出
 */

// 类型导出
export * from "./types";

// 命令发送
export { GameClient } from "./GameClient";

// Payload 类型从 @vt/server/commands/types 导入（与后端 100% 同步）
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
} from "@vt/server/commands/types";

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
export { usePlayerProfile, getAvatar, getAvatarByPlayerId, updateAvatar, hasValidCache } from "./usePlayerProfile";

// 火控系统 Hooks（服务端权威，Schema 同步）
export {
	useShipFireControl,
	useWeaponAttackableTargets,
	useWeaponFireStatus,
	refreshFireControlData,
} from "./useFireControl";
export type {
	TargetAttackability,
	WeaponTargetsData,
	ShipFireControlData,
} from "./useFireControl";