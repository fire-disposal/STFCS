/**
 * 玩家管理
 */

import type { Client } from "@colyseus/core";
import { PlayerRole } from "@vt/data";
import { toRoleDto, toIdentityDto, toErrorDto } from "../../dto/index.js";
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
	private profileStore = new Map<number, { nickname: string; avatar: string }>();

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
		qosMonitor: QosMonitor
	): Promise<{ success: boolean; player?: PlayerState }> {
		const name = options.playerName?.trim() || `Player-${client.sessionId.substring(0, 4)}`;
		const isFirstClient = clients.length === 1;

		// 检查是否是之前断开的玩家重新加入（恢复状态）
		const existingPlayer = this.findOfflinePlayerByName(state, name);
		if (existingPlayer) {
			// 恢复之前的玩家状态
			existingPlayer.connected = true;
			existingPlayer.sessionId = client.sessionId;

			// 如果之前是房主，恢复房主身份（重新注册）
			if (existingPlayer.role === PlayerRole.DM && this.roomId) {
				roomOwnerRegistry.register(this.roomId, existingPlayer.shortId);
				this.roomOwnerId = client.sessionId;
				this.roomOwnerShortId = existingPlayer.shortId;
			}

			qosMonitor.init(client.sessionId);

			client.send("role", toRoleDto(existingPlayer.role));
			client.send("identity", toIdentityDto(name, existingPlayer.shortId));

			// 发送玩家头像（恢复时也需要）
			if (existingPlayer.avatar) {
				client.send("PLAYER_AVATAR", {
					shortId: existingPlayer.shortId,
					avatar: existingPlayer.avatar,
				});
			}

			return { success: true, player: existingPlayer };
		}

		// 房间已满检查
		const onlineCount = Array.from(state.players.values()).filter(p => p.connected).length;
		if (!isFirstClient && onlineCount >= maxClients) {
			client.send("error", { message: "房间已满，无法加入" });
			setTimeout(() => client.leave(), 200);
			return { success: false };
		}

		// 创建新玩家状态
		const player = new PlayerState();
		player.sessionId = client.sessionId;
		player.name = name;
		player.connected = true;
		player.role = isFirstClient ? PlayerRole.DM : PlayerRole.PLAYER;

		// 先添加到状态，再注册玩家档案
		state.players.set(client.sessionId, player);
		qosMonitor.init(client.sessionId);

		// 注册玩家档案（分配 shortId）
		const { profile } = await this.playerService.registerPlayer(client, state, { playerName: name });
		player.shortId = profile.shortId;

		// 房主检查和注册
		if (isFirstClient && this.roomId) {
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

			// 注册为房主
			const registered = roomOwnerRegistry.register(this.roomId, profile.shortId);
			if (!registered) {
				state.players.delete(client.sessionId);
				this.playerService.handleDisconnect(client.sessionId);
				qosMonitor.remove(client.sessionId);
				client.send("error", { message: "您已在其他房间担任房主" });
				setTimeout(() => client.leave(), 200);
				return { success: false };
			}

			this.roomOwnerId = client.sessionId;
			this.roomOwnerShortId = profile.shortId;
		}

		client.send("role", toRoleDto(player.role));
		client.send("identity", toIdentityDto(name, profile.shortId));

		// 发送玩家头像（通过消息，不通过 Schema 同步）
		if (profile.avatar) {
			client.send("PLAYER_AVATAR", {
				shortId: profile.shortId,
				avatar: profile.avatar,
			});
		}

		return { success: true, player };
	}

	/** 查找离线玩家（用于恢复） */
	private findOfflinePlayerByName(state: GameRoomState, name: string): PlayerState | null {
		for (const player of state.players.values()) {
			if (!player.connected && player.name === name) {
				return player;
			}
		}
		return null;
	}

	/** 清理离线房主 */
	clearOwnerIfOffline(sessionId: string, state: GameRoomState): void {
		if (this.roomOwnerId === sessionId) {
			// 房主离线，从 registry 移除
			if (this.roomOwnerShortId !== null) {
				roomOwnerRegistry.unregisterByOwner(this.roomOwnerShortId);
			}
			// 转移给下一个在线玩家
			this.assignOwner(state);
		}
	}

	/** 重新分配房主 */
	assignOwner(state: GameRoomState): void {
		const oldOwnerShortId = this.roomOwnerShortId;

		// 找下一个在线玩家作为新房主
		const next = Array.from(state.players.values()).find((p) => p.connected);

		if (next && this.roomId) {
			this.roomOwnerId = next.sessionId;
			this.roomOwnerShortId = next.shortId;

			// 更新所有玩家的角色
			state.players.forEach((p: PlayerState) => {
				p.role = p.sessionId === this.roomOwnerId ? PlayerRole.DM : PlayerRole.PLAYER;
			});

			// 更新 registry
			if (oldOwnerShortId !== null && next.shortId !== oldOwnerShortId) {
				roomOwnerRegistry.transferOwnership(this.roomId, next.shortId, oldOwnerShortId);
			}
		} else {
			// 没有在线玩家，清空房主信息
			this.roomOwnerId = null;
			this.roomOwnerShortId = null;
		}
	}

	/** 获取房主信息 */
	getOwnerProfile(state: GameRoomState): { sessionId: string; shortId: number } | null {
		if (!this.roomOwnerId) return null;
		const owner = state.players.get(this.roomOwnerId);
		return owner ? { sessionId: owner.sessionId, shortId: owner.shortId } : null;
	}

	/**
	 * 手动转移房主身份
	 *
	 * @param targetSessionId 目标玩家的 sessionId
	 * @param state 游戏状态
	 * @returns 成功返回 true，失败返回错误消息
	 */
	transferOwnership(targetSessionId: string, state: GameRoomState): { success: boolean; error?: string } {
		const targetPlayer = state.players.get(targetSessionId);
		if (!targetPlayer) {
			return { success: false, error: "目标玩家不存在" };
		}

		if (!targetPlayer.connected) {
			return { success: false, error: "目标玩家已离线" };
		}

		if (targetPlayer.sessionId === this.roomOwnerId) {
			return { success: false, error: "目标玩家已经是房主" };
		}

		// 检查目标玩家是否已拥有其他房间
		if (this.roomId) {
			const ownedRoom = roomOwnerRegistry.getOwnedRoom(targetPlayer.shortId);
			if (ownedRoom && ownedRoom !== this.roomId) {
				return { success: false, error: "目标玩家已在其他房间担任房主" };
			}
		}

		const oldOwnerShortId = this.roomOwnerShortId;

		// 更新房主信息
		this.roomOwnerId = targetPlayer.sessionId;
		this.roomOwnerShortId = targetPlayer.shortId;

		// 更新所有玩家的角色
		state.players.forEach((p: PlayerState) => {
			p.role = p.sessionId === this.roomOwnerId ? PlayerRole.DM : PlayerRole.PLAYER;
		});

		// 更新 registry
		if (this.roomId && oldOwnerShortId !== null && targetPlayer.shortId !== oldOwnerShortId) {
			roomOwnerRegistry.transferOwnership(this.roomId, targetPlayer.shortId, oldOwnerShortId);
		}

		console.log(`[PlayerManager] Ownership transferred: from=${oldOwnerShortId}, to=${targetPlayer.shortId}`);
		return { success: true };
	}

	/** 获取玩家档案 */
	getProfile(shortId: number): { nickname: string; avatar: string } | undefined {
		return this.profileStore.get(shortId);
	}

	/** 设置玩家档案 */
	setProfile(shortId: number, profile: { nickname: string; avatar: string }): void {
		this.profileStore.set(shortId, profile);
	}
}