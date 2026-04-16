/**
 * 玩家管理
 */

import type { Client } from "@colyseus/core";
import { matchMaker } from "@colyseus/core";
import { PlayerRole } from "@vt/data";
import { toRoleDto, toIdentityDto, toErrorDto } from "../../dto/index.js";
import { PlayerService } from "../../services/PlayerService.js";
import type { GameRoomState } from "../../schema/GameSchema.js";
import { PlayerState } from "../../schema/GameSchema.js";
import type { QosMonitor } from "./QosMonitor.js";

export class PlayerManager {
	private roomOwnerId: string | null = null;
	private playerService = new PlayerService();
	private profileStore = new Map<number, { nickname: string; avatar: string }>();

	/** 获取房主 sessionId */
	getOwnerId(): string | null {
		return this.roomOwnerId;
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
			existingPlayer.sessionId = client.sessionId; // 更新 sessionId（Colyseus 会重新分配）

			// 如果之前是房主，恢复房主身份
			if (this.roomOwnerId === existingPlayer.sessionId) {
				// 房主身份已恢复
			}

			qosMonitor.init(client.sessionId);

			// 发送消息给客户端
			client.send("role", toRoleDto(existingPlayer.role));
			client.send("identity", toIdentityDto(name, existingPlayer.shortId));

			return { success: true, player: existingPlayer };
		}

		// 房间已满检查（计算在线玩家数）
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

		if (player.role === PlayerRole.DM) {
			this.roomOwnerId = client.sessionId;
		}

		// 先添加到状态，再注册玩家档案
		state.players.set(client.sessionId, player);
		qosMonitor.init(client.sessionId);

		// 注册玩家档案
		const { profile } = this.playerService.registerPlayer(client, state, { playerName: name });
		player.shortId = profile.shortId;

		// 房主重复检查
		if (isFirstClient) {
			const existingRooms = await matchMaker.query({ name: "battle" });
			const alreadyOwnsActiveRoom = existingRooms.some((r) => {
				if (r.roomId === roomId) return false;
				const meta = (r.metadata as Record<string, unknown> | undefined) || {};
				const shortIdMatch = Number(meta.ownerShortId) === profile.shortId;
				const hasActiveClients = Number(r.clients) > 0;
				return shortIdMatch && hasActiveClients;
			});

			if (alreadyOwnsActiveRoom) {
				state.players.delete(client.sessionId);
				this.playerService.handleDisconnect(client.sessionId);
				qosMonitor.remove(client.sessionId);
				this.roomOwnerId = null;
				client.send("error", { message: "您已在其他房间担任房主" });
				setTimeout(() => client.leave(), 200);
				return { success: false };
			}
		}

		// 发送消息给客户端
		client.send("role", toRoleDto(player.role));
		client.send("identity", toIdentityDto(name, profile.shortId));

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
			// 房主离线，转移给下一个在线玩家
			this.assignOwner(state);
		}
	}

	/** 重新分配房主 */
	assignOwner(state: GameRoomState): void {
		if (!state.players.has(this.roomOwnerId ?? "")) {
			const next = Array.from(state.players.values()).find((p) => p.connected);
			this.roomOwnerId = next?.sessionId ?? null;
			state.players.forEach((p: PlayerState) => {
				p.role = p.sessionId === this.roomOwnerId ? PlayerRole.DM : PlayerRole.PLAYER;
			});
		}
	}

	/** 获取房主信息 */
	getOwnerProfile(state: GameRoomState): { sessionId: string; shortId: number } | null {
		if (!this.roomOwnerId) return null;
		const owner = state.players.get(this.roomOwnerId);
		return owner ? { sessionId: owner.sessionId, shortId: owner.shortId } : null;
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