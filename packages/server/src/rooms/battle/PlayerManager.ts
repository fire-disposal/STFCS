/**
 * 玩家管理
 *
 * 设计原则：
 * - DM权限固定属于房间创建者，不可转移
 * - 房主离开后启动5分钟计时器，等待重新加入
 * - 房主重新加入时恢复DM身份
 */

import type { Client } from "@colyseus/core";
import { PlayerRole } from "@vt/data";
import { toRoleDto, toIdentityDto } from "../../dto/index.js";
import { PlayerService } from "../../services/PlayerService.js";
import { roomOwnerRegistry } from "../../services/RoomOwnerRegistry.js";
import type { GameRoomState } from "../../schema/GameSchema.js";
import { PlayerState } from "../../schema/GameSchema.js";
import type { QosMonitor } from "./QosMonitor.js";

export class PlayerManager {
	private roomOwnerId: string | null = null;
	private roomOwnerShortId: number | null = null;
	private roomId: string | null = null;
	private playerService = new PlayerService();

	/** 获取 PlayerService 实例 */
	getPlayerService(): PlayerService {
		return this.playerService;
	}

	/** 设置房间 ID（由 BattleRoom 调用） */
	setRoomId(roomId: string): void {
		this.roomId = roomId;
	}

	/** 获取房主 sessionId */
	getOwnerId(): string | null {
		return this.roomOwnerId;
	}

	/** 设置房主 sessionId（由 BattleRoom 调用，用于房主重新加入） */
	setOwnerId(sessionId: string): void {
		this.roomOwnerId = sessionId;
	}

	/** 获取房主 shortId */
	getOwnerShortId(): number | null {
		return this.roomOwnerShortId;
	}

	/** 处理玩家加入 */
	async handleJoin(
		client: Client,
		options: { playerName?: string },
		state: GameRoomState,
		clients: Client[],
		maxClients: number,
		roomId: string,
		qosMonitor: QosMonitor,
		ownerName?: string | null // 房主名称（用于恢复DM身份）
	): Promise<{ success: boolean; player?: PlayerState; isNew?: boolean }> {
		const name = options.playerName?.trim() || `Player-${client.sessionId.substring(0, 4)}`;

		// 检查是否是房主重新加入
		const isOwnerRejoining = ownerName && name === ownerName;
		const isFirstClient = clients.length === 1;

		// 房间已满检查（房主重新加入不受限制）
		const onlineCount = Array.from(state.players.values()).filter(p => p.connected).length;
		if (!isFirstClient && !isOwnerRejoining && onlineCount >= maxClients) {
			client.send("error", { message: "房间已满，无法加入" });
			setTimeout(() => client.leave(), 200);
			return { success: false };
		}

		// 创建新玩家状态
		const player = new PlayerState();
		player.sessionId = client.sessionId;
		player.name = name;
		player.connected = true;

		// DM权限：
		// 1. 第一个加入的玩家是创建者（DM）
		// 2. 房主重新加入时恢复DM身份
		if (isFirstClient) {
			player.role = PlayerRole.DM;
			state.creatorSessionId = client.sessionId;
		} else if (isOwnerRejoining) {
			player.role = PlayerRole.DM;
		} else {
			player.role = PlayerRole.PLAYER;
		}

		// 先添加到状态，再注册玩家档案
		state.players.set(client.sessionId, player);
		qosMonitor.init(client.sessionId);

		// 注册玩家档案（分配 shortId）
		const { profile } = await this.playerService.registerPlayer(client, state, { playerName: name });
		player.shortId = profile.shortId;

		// 房主检查和注册（仅第一个玩家或房主重新加入）
		if ((isFirstClient || isOwnerRejoining) && this.roomId) {
			// 检查全局 registry
			const ownedRoom = roomOwnerRegistry.getOwnedRoom(profile.shortId);
			if (ownedRoom && ownedRoom !== this.roomId) {
				state.players.delete(client.sessionId);
				this.playerService.handleDisconnect(client.sessionId);
				qosMonitor.remove(client.sessionId);
				client.send("error", { message: "您已在其他房间担任房主" });
				setTimeout(() => client.leave(), 200);
				return { success: false };
			}

			// 注册为房主（首次创建或重新加入都更新）
			if (isFirstClient) {
				const registered = roomOwnerRegistry.register(this.roomId, profile.shortId);
				if (!registered) {
					state.players.delete(client.sessionId);
					this.playerService.handleDisconnect(client.sessionId);
					qosMonitor.remove(client.sessionId);
					client.send("error", { message: "您已在其他房间担任房主" });
					setTimeout(() => client.leave(), 200);
					return { success: false };
				}
			}

			this.roomOwnerId = client.sessionId;
			this.roomOwnerShortId = profile.shortId;
		}

		client.send("role", toRoleDto(player.role));
		client.send("identity", toIdentityDto(name, profile.shortId));

		// 发送玩家头像（通过消息，不通过 Schema 同步）
		if (profile.avatar) {
			player.avatar = profile.avatar; // 存储到服务端内存
			client.send("PLAYER_AVATAR", {
				shortId: profile.shortId,
				avatar: profile.avatar,
			});
		}

		return { success: true, player, isNew: true };
	}

	/** 获取房主信息 */
	getOwnerProfile(state: GameRoomState): { sessionId: string; shortId: number } | null {
		if (!this.roomOwnerId) return null;
		const owner = state.players.get(this.roomOwnerId);
		return owner ? { sessionId: owner.sessionId, shortId: owner.shortId } : null;
	}

	/**
	 * DM权限固定化：禁用转移功能
	 * 此方法始终返回失败
	 */
	transferOwnership(_targetSessionId: string, _state: GameRoomState): { success: boolean; error?: string } {
		return { success: false, error: "DM权限固定，不支持转移" };
	}

	/** 检查是否是房主（创建者） */
	isOwner(sessionId: string, state: GameRoomState): boolean {
		return sessionId === state.creatorSessionId;
	}
}