/**
 * 游戏服务（游戏逻辑封装）
 *
 * 职责：
 * - 封装 CommandDispatcher 的核心逻辑
 * - 提供类型安全的游戏操作接口
 * - 协调玩家、舰船、回合管理
 */

import type { Client } from "@colyseus/core";
import { CommandDispatcher } from "../commands/CommandDispatcher.js";
import { ObjectFactory } from "../rooms/battle/ObjectFactory.js";
import type { GameRoomState } from "../schema/GameSchema.js";
import type { ShipState } from "../schema/ShipStateSchema.js";
import { advancePhase } from "../phase/PhaseManager.js";
import { PlayerRole } from "@vt/data";
import type { CreateObjectPayload, MoveTokenPayload } from "../commands/types.js";

export class GameService {
	private dispatcher: CommandDispatcher;
	private objectFactory = new ObjectFactory();

	constructor(state: GameRoomState) {
		this.dispatcher = new CommandDispatcher(state);
	}

	// ==================== 移动 ====================

	/** 执行移动命令 */
	executeMove(client: Client, payload: MoveTokenPayload): void {
		this.dispatcher.dispatchMoveToken(client, payload);
	}

	/** 推进移动阶段 */
	advanceMovePhase(client: Client, ship: ShipState): void {
		this.dispatcher.dispatchAdvanceMovePhase(client, ship);
	}

	// ==================== 武器 ====================

	/** 执行开火 */
	executeFireWeapon(client: Client, payload: { attackerId: string; weaponId: string; targetId: string }): void {
		this.dispatcher.dispatchFireWeapon(client, payload);
	}

	// ==================== 护盾 ====================

	/** 切换护盾 */
	executeToggleShield(client: Client, payload: { shipId: string; isActive: boolean; orientation?: number }): void {
		this.dispatcher.dispatchToggleShield(client, payload);
	}

	// ==================== 辐能 ====================

	/** 排散辐能 */
	executeVentFlux(client: Client, payload: { shipId: string }): void {
		this.dispatcher.dispatchVentFlux(client, payload);
	}

	// ==================== 回合 ====================

	/** 结束回合 */
	endTurn(state: GameRoomState, broadcast: (type: string, data: unknown) => void): void {
		advancePhase(state, broadcast);
	}

	/** 玩家切换准备状态 */
	toggleReady(state: GameRoomState, sessionId: string): void {
		const player = state.players.get(sessionId);
		if (player) {
			player.isReady = !player.isReady;
		}
	}

	// ==================== 对象创建 ====================

	/** 创建对象（舰船、小行星、空间站） */
	createObject(state: GameRoomState, payload: CreateObjectPayload): ShipState | null {
		return this.objectFactory.create(state, payload);
	}

	/** 分配舰船给玩家 */
	assignShip(client: Client, shipId: string, targetSessionId: string): void {
		this.dispatcher.dispatchAssignShip(client, shipId, targetSessionId);
	}

	// ==================== 权限检查 ====================

	/** 检查是否可以控制舰船 */
	canControlShip(state: GameRoomState, sessionId: string, ship: ShipState): boolean {
		const player = state.players.get(sessionId);
		if (!player) return false;
		if (player.role === PlayerRole.DM) return true;
		return ship.ownerId === sessionId;
	}

	/** 检查是否是玩家回合 */
	isPlayerTurn(state: GameRoomState): boolean {
		return state.currentPhase === "PLAYER_TURN";
	}

	/** 检查舰船是否可操作 */
	canOperateShip(state: GameRoomState, ship: ShipState): boolean {
		return !ship.isDestroyed && !ship.isOverloaded;
	}

	// ==================== 状态查询 ====================

	/** 获取玩家控制的舰船 */
	getPlayerShips(state: GameRoomState, sessionId: string): ShipState[] {
		const result: ShipState[] = [];
		state.ships.forEach((ship) => {
			if (ship.ownerId === sessionId) {
				result.push(ship);
			}
		});
		return result;
	}

	/** 获取活跃舰船（未摧毁） */
	getActiveShips(state: GameRoomState): ShipState[] {
		const result: ShipState[] = [];
		state.ships.forEach((ship) => {
			if (!ship.isDestroyed) {
				result.push(ship);
			}
		});
		return result;
	}
}