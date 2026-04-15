/**
 * 房间 DTO 转换器
 */

import { GamePhase } from "../schema/types.js";
import type { RoomListItemDTO, RoomMetadata } from "../schema/types.js";

interface MatchmakeRoomRecord {
	roomId?: unknown;
	name?: unknown;
	clients?: unknown;
	maxClients?: unknown;
	metadata?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	Boolean(value) && typeof value === "object";

const toStringValue = (value: unknown, fallback: string): string =>
	typeof value === "string" && value.trim().length > 0 ? value : fallback;

const toNumberValue = (value: unknown, fallback: number): number =>
	Number.isFinite(Number(value)) ? Number(value) : fallback;

const toBooleanValue = (value: unknown, fallback: boolean): boolean =>
	typeof value === "boolean" ? value : fallback;

const normalizeMetadata = (
	value: unknown,
	roomId: string,
	fallbackMaxPlayers: number
): RoomMetadata => {
	const record = isRecord(value) ? value : {};
	const name = toStringValue(record.name, `Room ${roomId.substring(0, 6)}`);
	const roomType = toStringValue(record.roomType, "battle");
	const phase = toStringValue(record.phase, GamePhase.DEPLOYMENT);
	const ownerId = toStringValue(record.ownerId, "");
	const ownerShortId = toNumberValue(record.ownerShortId, 0);

	return {
		roomType,
		name,
		phase,
		ownerId: ownerId.length > 0 ? ownerId : null,
		ownerShortId: Number.isInteger(ownerShortId) && ownerShortId > 0 ? ownerShortId : null,
		maxPlayers: toNumberValue(record.maxPlayers, fallbackMaxPlayers),
		isPrivate: toBooleanValue(record.isPrivate, false),
		createdAt: toNumberValue(record.createdAt, 0),
	};
};

export const toMatchmakeRoomDto = (room: MatchmakeRoomRecord): RoomListItemDTO => {
	const roomId = toStringValue(room.roomId, "");
	const clients = toNumberValue(room.clients, 0);
	const maxClients = toNumberValue(room.maxClients, 0);
	const metadata = normalizeMetadata(room.metadata, roomId, maxClients);

	return {
		roomId,
		name: metadata.name,
		clients,
		maxClients,
		roomType: metadata.roomType,
		metadata,
	};
};