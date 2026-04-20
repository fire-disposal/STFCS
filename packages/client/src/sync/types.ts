/**
 * 客户端类型定义（Socket.IO 版）
 */

export {
	DamageType,
	WeaponState,
	WeaponSlotSize,
	ArmorQuadrant,
	HullSize,
	ShipClass,
	Faction,
	PlayerRole,
	GamePhase,
	MovementPhase,
	FluxState,
	ShieldType,
	WeaponTag,
} from "@vt/data";

export type {
	Point,
	WeaponSpec,
	ShipJSON,
	ShipSpec,
	ShipRuntime,
	ShieldSpec,
	MountSpec,
	WeaponJSON,
	Metadata,
	GamePhaseValue,
	FactionValue,
	PlayerRoleValue,
	MovementState,
	ShipModifier,
	RoomPlayerState,
	GameRoomState,
	SocketIOActionEvent,
	MoveActionPayload,
	RotateActionPayload,
	AttackActionPayload,
	ToggleShieldPayload,
	VentFluxPayload,
} from "@vt/data";

export { SocketIOActionMap, validateActionPayload } from "@vt/data";

export interface CameraState {
	x: number;
	y: number;
	zoom: number;
	viewRotation?: number;
	followingShipId?: string | null;
}

export const ClientCommand = {
	CMD_CREATE_OBJECT: "room:create_object",
	CMD_MOVE_TOKEN: "game:move",
	CMD_ROTATE_TOKEN: "game:rotate",
	CMD_TOGGLE_SHIELD: "game:toggle_shield",
	CMD_VENT_FLUX: "game:vent_flux",
	CMD_ATTACK: "game:attack",
	CMD_END_TURN: "game:end_turn",
	CMD_ADVANCE_PHASE: "game:advance_phase",
	CMD_NEXT_PHASE: "room:next_phase",
	CMD_TOGGLE_READY: "room:ready",
	CMD_KICK_PLAYER: "room:kick",
	CMD_ASSIGN_SHIP: "room:assign_ship",
	CMD_SET_ARMOR: "room:set_armor",
	CMD_CLEAR_OVERLOAD: "room:clear_overload",
	CMD_ADVANCE_MOVE_PHASE: "room:advance_move_phase",
} as const;

export type ClientCommandValue = (typeof ClientCommand)[keyof typeof ClientCommand];