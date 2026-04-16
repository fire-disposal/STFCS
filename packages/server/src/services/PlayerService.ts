/**
 * 玩家服务（在线档案）
 *
 * 职责：
 * - 管理玩家在线档案（shortId、nickname、avatar）
 * - shortId 由后端统一生成和分配
 * - 档案持久化和恢复
 *
 * 注意：OnlineProfile 与 PlayerProfile（schema/types.ts）不同
 * - OnlineProfile: 在线玩家的基本信息（shortId, nickname, avatar）
 * - PlayerProfile: 完整玩家档案（包含自定义变体、设置等）
 */

import type { Client } from "@colyseus/core";
import type { GameRoomState, PlayerState } from "../schema/GameSchema.js";

/** 在线玩家档案（轻量级） */
export interface OnlineProfile {
	shortId: number;
	nickname: string;
	avatar: string;
}

export class PlayerService {
	private profiles = new Map<string, OnlineProfile>();
	private shortIdToSession = new Map<number, string>();
	private usedShortIds = new Set<number>();

	/** 注册玩家（自动分配 shortId） */
	registerPlayer(
		client: Client,
		state: GameRoomState,
		options: { playerName?: string }
	): { player: PlayerState; profile: OnlineProfile } {
		const player = state.players.get(client.sessionId);
		if (!player) {
			throw new Error("玩家未在房间状态中注册");
		}

		// 后端生成 shortId
		const shortId = this.generateShortId();
		player.shortId = shortId;
		this.shortIdToSession.set(shortId, client.sessionId);
		this.usedShortIds.add(shortId);

		// 设置初始档案
		const profile: OnlineProfile = {
			shortId,
			nickname: options.playerName?.trim().slice(0, 24) || `Player_${shortId}`,
			avatar: "👤",
		};
		this.profiles.set(client.sessionId, profile);

		return { player, profile };
	}

	/** 更新玩家档案 */
	updateProfile(sessionId: string, updates: Partial<OnlineProfile>): OnlineProfile | null {
		const existing = this.profiles.get(sessionId);
		if (!existing) return null;

		const updated: OnlineProfile = {
			shortId: existing.shortId, // shortId 不可修改
			nickname: updates.nickname?.trim().slice(0, 24) || existing.nickname,
			avatar: updates.avatar?.trim().slice(0, 4) || existing.avatar,
		};

		this.profiles.set(sessionId, updated);
		return updated;
	}

	/** 获取玩家档案 */
	getProfile(sessionId: string): OnlineProfile | null {
		return this.profiles.get(sessionId) ?? null;
	}

	/** 根据 shortId 获取 sessionId */
	getSessionIdByShortId(shortId: number): string | null {
		return this.shortIdToSession.get(shortId) ?? null;
	}

	/** 玩家断开连接 */
	handleDisconnect(sessionId: string): void {
		const profile = this.profiles.get(sessionId);
		if (profile) {
			this.shortIdToSession.delete(profile.shortId);
			// 保留档案数据用于重连恢复
		}
	}

	/** 玩家重连恢复 */
	tryReconnect(sessionId: string, state: GameRoomState): OnlineProfile | null {
		// 尝试恢复之前的档案
		const existingPlayer = state.players.get(sessionId);
		if (!existingPlayer) return null;

		// 根据 sessionId 查找之前的档案
		const profile = this.profiles.get(sessionId);
		if (profile) {
			this.shortIdToSession.set(profile.shortId, sessionId);
			existingPlayer.shortId = profile.shortId;
			return profile;
		}

		return null;
	}

	/** 生成唯一 shortId */
	private generateShortId(): number {
		let id: number;
		let attempts = 0;
		const maxAttempts = 100;

		do {
			id = Math.floor(100000 + Math.random() * 900000);
			attempts++;
			if (attempts >= maxAttempts) {
				throw new Error("无法生成唯一 shortId");
			}
		} while (this.usedShortIds.has(id));

		return id;
	}
}