/**
 * 权限检查模块
 *
 * 简化权限模型：
 * - HOST (房主/DM): 最高权限，可执行所有操作，控制所有Token
 * - PLAYER: 只能控制己方 Token
 */

import type { Socket } from "socket.io";
import type { Room } from "../rooms/Room.js";
import type { CombatToken } from "../../core/state/Token.js";
import type { TokenRuntime, Faction } from "@vt/data";

export type UserRole = "HOST" | "PLAYER";

export interface PermissionContext {
	playerId: string;
	role: UserRole;
	faction?: Faction;
}

export function getUserRole(socket: Socket, room: Room): UserRole | null {
	const playerId = socket.data.playerId;
	if (!playerId) return null;

	if (room.creatorId === playerId) return "HOST";

	const player = room.getStateManager().getPlayer(playerId);
	if (!player) return null;

	if (player.role === "HOST") return "HOST";
	return "PLAYER";
}

export function getPermissionContext(socket: Socket, room: Room): PermissionContext | null {
	const playerId = socket.data.playerId;
	if (!playerId) return null;

	const role = getUserRole(socket, room);
	if (!role) return null;

	const player = room.getStateManager().getPlayer(playerId);

	const context: PermissionContext = {
		playerId,
		role,
	};
	if (player?.faction) {
		context.faction = player.faction;
	}
	return context;
}

export function isHost(socket: Socket, room: Room): boolean {
	return getUserRole(socket, room) === "HOST";
}

export function isPlayer(socket: Socket, room: Room): boolean {
	const role = getUserRole(socket, room);
	return role === "HOST" || role === "PLAYER";
}

export function getCombatTokenRuntime(token: CombatToken): TokenRuntime | undefined {
	return token.runtime;
}

export function canControlToken(socket: Socket, room: Room, tokenId: string): boolean {
	const playerId = socket.data.playerId;
	if (!playerId) return false;

	if (isHost(socket, room)) return true;

	const token = room.getCombatToken(tokenId);
	if (!token) return false;

	const runtime = getCombatTokenRuntime(token);
	if (!runtime?.ownerId) return false;

	return runtime.ownerId === playerId;
}

export function checkPermission(socket: Socket, room: Room, action: string): boolean {
	const role = getUserRole(socket, room);
	if (!role) return false;

	const dmNamespace = "dm:";
	if (action.startsWith(dmNamespace)) {
		return role === "HOST";
	}

	if (action.startsWith("game:")) {
		return role === "HOST" || role === "PLAYER";
	}

	const roomHostActions = ["room:action:start", "room:action:kick", "room:action:transfer_host"];
	if (roomHostActions.includes(action)) {
		return role === "HOST";
	}

	return true;
}

export function getTokenFaction(token: CombatToken): Faction | undefined {
	return token.runtime?.faction;
}

export function isTokenOwnedByPlayer(token: CombatToken, playerId: string): boolean {
	return token.runtime?.ownerId === playerId;
}

export function canPlayerControlFaction(socket: Socket, room: Room, faction: Faction): boolean {
	if (isHost(socket, room)) return true;

	const playerId = socket.data.playerId;
	if (!playerId) return false;

	const player = room.getStateManager().getPlayer(playerId);
	if (!player) return false;

	return player.faction === faction;
}

export function requireHost(socket: Socket, room: Room): { success: boolean; error?: string } {
	if (!isHost(socket, room)) {
		return { success: false, error: "HOST permission required" };
	}
	return { success: true };
}

export function requirePlayer(socket: Socket, room: Room): { success: boolean; error?: string } {
	if (!isPlayer(socket, room)) {
		return { success: false, error: "PLAYER permission required" };
	}
	return { success: true };
}

export function requireTokenControl(socket: Socket, room: Room, tokenId: string): { success: boolean; error?: string } {
	if (!canControlToken(socket, room, tokenId)) {
		return { success: false, error: "Cannot control this token" };
	}
	return { success: true };
}