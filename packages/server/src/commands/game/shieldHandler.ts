/**
 * 护盾切换命令处理器
 */

import type { Client } from "@colyseus/core";
import { GAME_CONFIG } from "@vt/data";
import type { GameRoomState } from "../../schema/GameSchema.js";
import { validateAuthority } from "./utils.js";

/** 处理护盾切换命令 */
export function handleToggleShield(
	state: GameRoomState,
	client: Client,
	payload: { shipId: string; isActive: boolean; orientation?: number }
): void {
	const ship = state.ships.get(payload.shipId);
	if (!ship) throw new Error(`舰船不存在: ${payload.shipId}`);
	validateAuthority(state, client, ship);
	if (ship.isOverloaded && payload.isActive) throw new Error("过载状态无法开启护盾");

	if (payload.isActive && !ship.shield.active) {
		if (ship.flux.total + GAME_CONFIG.SHIELD_UP_FLUX_COST > ship.flux.max)
			throw new Error("辐能容量不足");
		ship.flux.addSoft(GAME_CONFIG.SHIELD_UP_FLUX_COST);
	}

	payload.isActive ? ship.shield.activate() : ship.shield.deactivate();
	ship.shield.orientation = payload.orientation ?? ship.transform.heading;
}