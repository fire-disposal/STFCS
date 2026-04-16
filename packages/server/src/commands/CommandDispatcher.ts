/**
 * 命令分发器
 *
 * 纯分发器，调用 handlers 目录中的函数式处理器
 */

import type { Client } from "@colyseus/core";
import type { GameRoomState } from "../schema/GameSchema.js";
import type { ShipState } from "../schema/ShipStateSchema.js";
import type { MoveTokenPayload } from "./types.js";
import {
	handleMove,
	handleAdvanceMovePhase,
	handleFireWeapon,
	handleToggleShield,
	handleVentFlux,
	handleAssignShip,
} from "./handlers/index.js";

export class CommandDispatcher {
	constructor(private state: GameRoomState) {}

	/** 执行移动命令 */
	dispatchMoveToken(client: Client, payload: MoveTokenPayload): void {
		handleMove(this.state, client, payload);
	}

	/** 推进移动阶段 */
	dispatchAdvanceMovePhase(client: Client, ship: ShipState): void {
		handleAdvanceMovePhase(this.state, client, ship);
	}

	/** 执行开火命令 */
	dispatchFireWeapon(
		client: Client,
		payload: { attackerId: string; weaponId: string; targetId: string }
	): void {
		handleFireWeapon(this.state, client, payload);
	}

	/** 切换护盾 */
	dispatchToggleShield(
		client: Client,
		payload: { shipId: string; isActive: boolean; orientation?: number }
	): void {
		handleToggleShield(this.state, client, payload);
	}

	/** 排散辐能 */
	dispatchVentFlux(client: Client, payload: { shipId: string }): void {
		handleVentFlux(this.state, client, payload);
	}

	/** 分配舰船 */
	dispatchAssignShip(client: Client, shipId: string, targetSessionId: string): void {
		handleAssignShip(this.state, client, shipId, targetSessionId);
	}
}