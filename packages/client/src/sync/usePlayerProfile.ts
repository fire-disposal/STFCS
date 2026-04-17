import type { Room } from "@colyseus/sdk";
import type { GameRoomState, PlayerStateType } from "@/sync/types";
import { useMultiplayerState } from "./useMultiplayerState";
import { useState, useEffect } from "react";

/**
 * 全局头像缓存
 * 
 * 结构：playerId/nickname → { avatar, timestamp }
 * 缓存有效期：5分钟
 */
interface CacheEntry {
	avatar: string;
	timestamp: number;
}

const avatarCache = new Map<string, CacheEntry>();
const shortIdCache = new Map<number, string>(); // shortId → playerId 映射
const CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

// 更新缓存
export function updateAvatar(playerId: string, shortId: number, avatar: string): void {
	if (!avatar) return;
	
	avatarCache.set(playerId, { avatar, timestamp: Date.now() });
	if (shortId > 0) {
		shortIdCache.set(shortId, playerId);
	}
}

// 从缓存获取头像（按 playerId）
export function getAvatarByPlayerId(playerId: string): string | null {
	const entry = avatarCache.get(playerId);
	if (!entry) return null;
	
	// 检查缓存是否过期
	if (Date.now() - entry.timestamp > CACHE_TTL) {
		avatarCache.delete(playerId);
		return null;
	}
	
	return entry.avatar;
}

// 从缓存获取头像（按 shortId）
export function getAvatar(shortId: number): string {
	const playerId = shortIdCache.get(shortId);
	if (!playerId) return "";
	
	const entry = avatarCache.get(playerId);
	if (!entry) return "";
	
	// 检查缓存是否过期
	if (Date.now() - entry.timestamp > CACHE_TTL) {
		avatarCache.delete(playerId);
		shortIdCache.delete(shortId);
		return "";
	}
	
	return entry.avatar;
}

// 检查缓存是否有效
export function hasValidCache(playerId: string): boolean {
	const entry = avatarCache.get(playerId);
	if (!entry) return false;
	return Date.now() - entry.timestamp <= CACHE_TTL;
}

/**
 * 订阅玩家档案信息
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

	// 监听头像更新事件
	useEffect(() => {
		const handleAvatarUpdate = (event: CustomEvent<{ shortId: number; avatar: string }>) => {
			if (player) {
				const avatarData = event.detail.avatar;
				setAvatar(avatarData);
				// 更新缓存（playerId 用 nickname）
				updateAvatar(player.nickname || player.name, event.detail.shortId, avatarData);
			}
		};
		window.addEventListener("stfcs-player-avatar", handleAvatarUpdate as EventListener);
		return () => {
			window.removeEventListener("stfcs-player-avatar", handleAvatarUpdate as EventListener);
		};
	}, [player?.shortId, player?.nickname, player?.name]);

	return {
		nickname: player?.nickname || "",
		avatar,
	};
}
