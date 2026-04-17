import type { Room } from "@colyseus/sdk";
import type { GameRoomState, PlayerStateType } from "@/sync/types";
import { useMultiplayerState } from "./useMultiplayerState";
import { useState, useEffect } from "react";

/**
 * 全局头像缓存
 *
 * 结构：playerId/name → { avatar, timestamp }
 * shortId → playerId 映射
 * 缓存有效期：5分钟
 */
interface CacheEntry {
	avatar: string;
	timestamp: number;
}

const avatarCache = new Map<string, CacheEntry>();
const shortIdCache = new Map<number, string>(); // shortId → name 映射
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 更新缓存
export function updateAvatar(name: string, shortId: number, avatar: string): void {
	if (!avatar || !name) return;

	avatarCache.set(name, { avatar, timestamp: Date.now() });
	if (shortId > 0) {
		shortIdCache.set(shortId, name);
	}

	// 触发全局更新事件（让所有使用Avatar组件的地方更新）
	window.dispatchEvent(new CustomEvent("stfcs-avatar-cache-updated", {
		detail: { name, shortId, avatar }
	}));
}

// 从缓存获取头像（按 name）
export function getAvatarByPlayerId(name: string): string | null {
	const entry = avatarCache.get(name);
	if (!entry) return null;

	// 检查缓存是否过期
	if (Date.now() - entry.timestamp > CACHE_TTL) {
		avatarCache.delete(name);
		return null;
	}

	return entry.avatar;
}

// 从缓存获取头像（按 shortId）
export function getAvatar(shortId: number): string {
	const name = shortIdCache.get(shortId);
	if (!name) return "";

	const entry = avatarCache.get(name);
	if (!entry) return "";

	// 检查缓存是否过期
	if (Date.now() - entry.timestamp > CACHE_TTL) {
		avatarCache.delete(name);
		shortIdCache.delete(shortId);
		return "";
	}

	return entry.avatar;
}

// 检查缓存是否有效
export function hasValidCache(name: string): boolean {
	const entry = avatarCache.get(name);
	if (!entry) return false;
	return Date.now() - entry.timestamp <= CACHE_TTL;
}

/**
 * 订阅当前玩家档案信息
 *
 * 注意：avatar 不通过 Schema 同步（大数据），改为消息发送
 * nickname 通过 Schema 同步，avatar 从全局缓存获取
 */
export function usePlayerProfile(room: Room<GameRoomState> | null): { nickname: string; avatar: string } {
	const player = useMultiplayerState(room, (state: GameRoomState) => {
		if (!room?.sessionId || !state?.players) return null;
		return state.players.get(room.sessionId) || null;
	}) as PlayerStateType | null;

	const [avatar, setAvatar] = useState<string>("");

	// 监听头像更新事件（包括当前玩家和其他玩家）
	useEffect(() => {
		const handleAvatarUpdate = (event: CustomEvent<{ shortId: number; avatar: string }>) => {
			const { shortId, avatar: avatarData } = event.detail;

			// 更新全局缓存（从 players Map 中查找对应玩家）
			const players = room?.state?.players;
			if (players) {
				players.forEach((p) => {
					if (p.shortId === shortId) {
						updateAvatar(p.name || p.nickname, shortId, avatarData);
					}
				});
			}

			// 如果是当前玩家，更新本地状态
			if (player && player.shortId === shortId) {
				setAvatar(avatarData);
			}
		};

		// 监听玩家加入事件（新玩家加入时记录信息）
		const handlePlayerJoined = (event: CustomEvent<{ sessionId: string; shortId: number; name: string; role: string; isNew: boolean }>) => {
			const { shortId, name, isNew } = event.detail;
			console.log(`[usePlayerProfile] 玩家加入: ${name}, shortId=${shortId}, isNew=${isNew}`);
		};

		window.addEventListener("stfcs-player-avatar", handleAvatarUpdate as EventListener);
		window.addEventListener("stfcs-player-joined", handlePlayerJoined as EventListener);

		return () => {
			window.removeEventListener("stfcs-player-avatar", handleAvatarUpdate as EventListener);
			window.removeEventListener("stfcs-player-joined", handlePlayerJoined as EventListener);
		};
	}, [room?.state?.players, player?.shortId]);

	// 初始化时从缓存获取头像
	useEffect(() => {
		if (player) {
			const cachedAvatar = getAvatar(player.shortId);
			if (cachedAvatar) {
				setAvatar(cachedAvatar);
			}
		}
	}, [player?.shortId]);

	return {
		nickname: player?.nickname || player?.name || "",
		avatar,
	};
}