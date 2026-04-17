/**
 * 舰船分配命令处理器
 */

import type { Client } from "@colyseus/core";
import type { GameRoomState } from "../../schema/GameSchema.js";
import { validateDmAuthority } from "./utils.js";

/** 处理舰船分配命令 */
export function handleAssignShip(
	state: GameRoomState,
	client: Client,
	shipId: string,
	targetSessionId: string
): void {
	validateDmAuthority(state, client);
	const ship = state.ships.get(shipId);
	if (!ship) throw new Error("舰船不存在");
	ship.ownerId = targetSessionId;
}