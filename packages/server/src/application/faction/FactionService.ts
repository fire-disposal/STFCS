import type { FactionId, PlayerFactionInfo } from "@vt/shared/types";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import type { IWSServer } from "@vt/shared/ws";
import type { RoomManager } from "../../infrastructure/ws/RoomManager";
import { BaseService } from "../common/BaseService";

/**
 * 阵营服务 - 管理房间内的阵营分配
 *
 * 功能：
 * - 设置/获取玩家阵营
 * - 获取阵营内所有玩家
 * - 获取房间内阵营分布
 * - 移除玩家
 */
export interface IFactionService {
	// 设置玩家阵营
	setPlayerFaction(roomId: string, playerId: string, playerName: string, faction: FactionId): boolean;
	// 获取玩家阵营
	getPlayerFaction(roomId: string, playerId: string): FactionId | undefined;
	// 获取阵营内所有玩家
	getFactionPlayers(roomId: string, faction: FactionId): PlayerFactionInfo[];
	// 获取房间内所有阵营的玩家分布
	getRoomFactionDistribution(roomId: string): Record<FactionId, PlayerFactionInfo[]>;
	// 移除玩家
	removePlayer(roomId: string, playerId: string): void;
	// 获取房间内所有已分配阵营的玩家
	getAllPlayersWithFaction(roomId: string): PlayerFactionInfo[];
	// 检查玩家是否有阵营
	hasPlayerFaction(roomId: string, playerId: string): boolean;
}

export class FactionService extends BaseService implements IFactionService {
	// 房间 -> 玩家 -> 阵营信息
	private _playerFactions: Map<string, Map<string, PlayerFactionInfo>>;

	constructor() {
		super();
		this._playerFactions = new Map();
	}

	/**
	 * 设置玩家阵营
	 */
	setPlayerFaction(roomId: string, playerId: string, playerName: string, faction: FactionId): boolean {
		if (!roomId || !playerId || !faction) {
			return false;
		}

		// 获取或创建房间的阵营映射
		let roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			roomFactions = new Map();
			this._playerFactions.set(roomId, roomFactions);
		}

		// 创建或更新玩家阵营信息
		const existingInfo = roomFactions.get(playerId);
		const playerFactionInfo: PlayerFactionInfo = {
			playerId,
			playerName,
			faction,
			hasEndedTurn: existingInfo?.hasEndedTurn ?? false,
			endedAt: existingInfo?.endedAt,
		};

		roomFactions.set(playerId, playerFactionInfo);

		// 广播阵营选择消息
		this._broadcastFactionSelected(roomId, playerId, playerName, faction);

		return true;
	}

	/**
	 * 获取玩家阵营
	 */
	getPlayerFaction(roomId: string, playerId: string): FactionId | undefined {
		const roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			return undefined;
		}

		return roomFactions.get(playerId)?.faction;
	}

	/**
	 * 获取玩家阵营信息
	 */
	getPlayerFactionInfo(roomId: string, playerId: string): PlayerFactionInfo | undefined {
		const roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			return undefined;
		}

		return roomFactions.get(playerId);
	}

	/**
	 * 获取阵营内所有玩家
	 */
	getFactionPlayers(roomId: string, faction: FactionId): PlayerFactionInfo[] {
		const roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			return [];
		}

		return Array.from(roomFactions.values()).filter(info => info.faction === faction);
	}

	/**
	 * 获取房间内所有阵营的玩家分布
	 */
	getRoomFactionDistribution(roomId: string): Record<FactionId, PlayerFactionInfo[]> {
		const distribution: Record<FactionId, PlayerFactionInfo[]> = {} as Record<FactionId, PlayerFactionInfo[]>;
		const roomFactions = this._playerFactions.get(roomId);

		if (!roomFactions) {
			return distribution;
		}

		for (const info of roomFactions.values()) {
			if (!distribution[info.faction]) {
				distribution[info.faction] = [];
			}
			distribution[info.faction].push(info);
		}

		return distribution;
	}

	/**
	 * 移除玩家
	 */
	removePlayer(roomId: string, playerId: string): void {
		const roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			return;
		}

		roomFactions.delete(playerId);

		// 如果房间内没有玩家了，清理房间数据
		if (roomFactions.size === 0) {
			this._playerFactions.delete(roomId);
		}
	}

	/**
	 * 获取房间内所有已分配阵营的玩家
	 */
	getAllPlayersWithFaction(roomId: string): PlayerFactionInfo[] {
		const roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			return [];
		}

		return Array.from(roomFactions.values());
	}

	/**
	 * 检查玩家是否有阵营
	 */
	hasPlayerFaction(roomId: string, playerId: string): boolean {
		return this.getPlayerFaction(roomId, playerId) !== undefined;
	}

	/**
	 * 更新玩家结束回合状态
	 */
	updatePlayerEndStatus(roomId: string, playerId: string, hasEndedTurn: boolean): PlayerFactionInfo | undefined {
		const roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			return undefined;
		}

		const playerInfo = roomFactions.get(playerId);
		if (!playerInfo) {
			return undefined;
		}

		playerInfo.hasEndedTurn = hasEndedTurn;
		playerInfo.endedAt = hasEndedTurn ? Date.now() : undefined;

		return playerInfo;
	}

	/**
	 * 重置房间内所有玩家的结束状态
	 */
	resetAllPlayersEndStatus(roomId: string): void {
		const roomFactions = this._playerFactions.get(roomId);
		if (!roomFactions) {
			return;
		}

		for (const info of roomFactions.values()) {
			info.hasEndedTurn = false;
			info.endedAt = undefined;
		}
	}

	/**
	 * 清理房间数据
	 */
	clearRoom(roomId: string): void {
		this._playerFactions.delete(roomId);
	}

	/**
	 * 广播阵营选择消息
	 */
	private _broadcastFactionSelected(
		roomId: string,
		playerId: string,
		playerName: string,
		faction: FactionId
	): void {
		if (!this._roomManager) return;

		this._roomManager.broadcastToRoom(roomId, {
			type: WS_MESSAGE_TYPES.FACTION_SELECTED,
			payload: {
				playerId,
				playerName,
				faction,
				timestamp: Date.now(),
			},
		});
	}
}

export default FactionService;