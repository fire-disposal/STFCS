/**
 * 辐能排散命令处理器
 */

import type { Client } from "@colyseus/core";
import type { GameRoomState } from "../../schema/GameSchema.js";
import { validateAuthority } from "./utils.js";

/** 处理辐能排散命令 */
export function handleVentFlux(state: GameRoomState, client: Client, payload: { shipId: string }): void {
	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error("舰船不存在");
	validateAuthority(state, client, ship);
	ship.flux.vent(1.0);
}