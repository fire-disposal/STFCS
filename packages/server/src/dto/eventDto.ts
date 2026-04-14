import type {
	ErrorDTO,
	GameLoadedDTO,
	GameSavedDTO,
	IdentityDTO,
	NetPongPayload,
	PhaseChangeDTO,
	PlayerRoleValue,
	RoleDTO,
	RoomKickedDTO,
	ShipCreatedDTO,
} from "@vt/types";
import type { ConnectionQualityValue, GamePhaseValue } from "@vt/types";

export const toErrorDto = (message: string): ErrorDTO => ({ message });

export const toRoleDto = (role: PlayerRoleValue): RoleDTO => ({ role });

export const toIdentityDto = (userName: string, shortId: number): IdentityDTO => ({
	userName,
	shortId,
});

export const toGameSavedDto = (saveId: string, saveName: string): GameSavedDTO => ({
	saveId,
	saveName,
});

export const toGameLoadedDto = (saveId: string, saveName: string): GameLoadedDTO => ({
	saveId,
	saveName,
});

export const toShipCreatedDto = (
	shipId: string,
	hullType: string,
	x: number,
	y: number
): ShipCreatedDTO => ({
	shipId,
	hullType,
	x,
	y,
});

export const toPhaseChangeDto = (
	phase: GamePhaseValue,
	turnCount: number
): PhaseChangeDTO => ({
	phase,
	turnCount,
});

export const toRoomKickedDto = (reason: string): RoomKickedDTO => ({ reason });

export const toNetPongDto = (
	seq: number,
	serverTime: number,
	pingMs: number,
	jitterMs: number,
	quality: ConnectionQualityValue
): NetPongPayload => ({
	seq,
	serverTime,
	pingMs,
	jitterMs,
	quality,
});