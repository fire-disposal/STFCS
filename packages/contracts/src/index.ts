export { PROTOCOL_VERSION } from "./core-types.js";
export * from "./types/index.js";
export * from "./protocol/index.js";
export * from "./constants/index.js";
export * from "./config/index.js";

export enum ClientCommand {
	CMD_MOVE_TOKEN = "CMD_MOVE_TOKEN",
	CMD_TOGGLE_SHIELD = "CMD_TOGGLE_SHIELD",
	CMD_FIRE_WEAPON = "CMD_FIRE_WEAPON",
	CMD_VENT_FLUX = "CMD_VENT_FLUX",
	CMD_ASSIGN_SHIP = "CMD_ASSIGN_SHIP",
	CMD_TOGGLE_READY = "CMD_TOGGLE_READY",
	CMD_NEXT_PHASE = "CMD_NEXT_PHASE",
}

export type {
ConnectionQuality,
	ServerGamePhase as GamePhase,
GameRoomState,
PlayerState,
ShipState,
Transform,
WeaponSlot,
} from "./runtime-state.js";

export { combatLog } from "./combatLog.js";
export type { CombatLogEntry, LogFilter, LogLevel, LogType } from "./combatLog.js";
