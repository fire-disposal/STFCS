/**
 * 游戏配置和伤害倍率
 *
 * 这些数据定义游戏规则的核心参数
 */

import { getServerConfig } from "../configs/index.js";

// ==================== 游戏全局配置 ====================

/**
 * 获取游戏全局配置
 * 从 server-config.json 加载
 */
export function getGameConfig() {
	const serverConfig = getServerConfig();
	return {
		// 武器系统
		DEFAULT_COOLDOWN: serverConfig.game.defaultCooldown,

		// 地图系统
		MAP_DEFAULT_WIDTH: serverConfig.game.mapDefaultWidth,
		MAP_DEFAULT_HEIGHT: serverConfig.game.mapDefaultHeight,

		// 房间系统
		MAX_PLAYERS_PER_ROOM: serverConfig.room.maxPlayers,
		RECONNECTION_TIMEOUT_MS: serverConfig.connection.reconnectionTimeoutMs,
	} as const;
}
