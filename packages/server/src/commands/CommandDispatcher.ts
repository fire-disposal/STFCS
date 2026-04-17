/**
 * 命令分发器
 *
 * 纯分发器，调用 handlers 目录中的函数式处理器
 */

import type { Client } from "@colyseus/core";
import { PlayerRole } from "@vt/data";
import type { GameRoomState } from "../schema/GameSchema.js";
import type { ShipState } from "../schema/ShipStateSchema.js";
import type { PlayerService } from "../services/PlayerService.js";
import type { MoveTokenPayload, UpdateProfilePayload, CreateObjectPayload } from "./types.js";
import {
	handleMove,
	handleAdvanceMovePhase,
	handleFireWeapon,
	handleToggleShield,
	handleVentFlux,
	handleAssignShip,
	handleAdvancePhase,
	handleGetAttackableTargets,
	handleGetAllAttackableTargets,
} from "./game/index.js";
import { handleUpdateProfile } from "./system/index.js";

export class CommandDispatcher {
	constructor(private state: GameRoomState) {}

	/** 检查是否为 DM 权限 */
	private assertDM(client: Client): void {
		const player = this.state.players.get(client.sessionId);
		if (!player || player.role !== PlayerRole.DM) {
			throw new Error("无权限：仅 DM 可执行此操作");
		}
	}

	/** 查询可攻击目标 */
	dispatchQueryTargets(client: Client, payload: { shipId: string; weaponInstanceId: string }): void {
		handleGetAttackableTargets(this.state, client, payload);
	}

	/** 批量查询所有武器可攻击目标 */
	dispatchQueryAllTargets(client: Client, payload: { shipId: string }): void {
		handleGetAllAttackableTargets(this.state, client, payload);
	}

	/** 推进游戏阶段 */
	dispatchAdvancePhase(client: Client, broadcast: (type: string, data: unknown) => void): void {
		this.assertDM(client);
		handleAdvancePhase(this.state, broadcast);
	}

	/** 创建游戏对象 */
	dispatchCreateObject(client: Client, payload: CreateObjectPayload, createFn: (p: CreateObjectPayload) => void): void {
		this.assertDM(client);
		createFn(payload);
	}

	/** 设置护甲（DM专用） */
	dispatchSetArmor(client: Client, shipId: string, quadrant: number, value: number): void {
		this.assertDM(client);
		const ship = this.state.ships.get(shipId);
		if (!ship) throw new Error("舰船不存在");
		ship.armor.setQuadrant(quadrant, value);
	}

	/** 清除过载（DM专用） */
	dispatchClearOverload(client: Client, shipId: string): void {
		this.assertDM(client);
		const ship = this.state.ships.get(shipId);
		if (!ship) throw new Error("舰船不存在");
		ship.isOverloaded = false;
		ship.overloadTime = 0;
		ship.flux.hard = 0;
		ship.flux.soft = 0;
		ship.shield.deactivate();
	}

	/** 更新玩家档案 */
	async dispatchUpdateProfile(
		client: Client,
		playerService: PlayerService,
		payload: UpdateProfilePayload
	): Promise<void> {
		await handleUpdateProfile(this.state, client, playerService, payload);
	}

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