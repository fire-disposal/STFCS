export const DEFAULT_FLUX_CAPACITY = 100;
export const DEFAULT_FLUX_DISSIPATION = 10;
export const SHIELD_EFFICIENCY = 0.5;
export const SHIELD_FRONT_MAINTENANCE_COST = 5;
export const SHIELD_FULL_MAINTENANCE_COST = 8;
export const OVERLOAD_FLUX_PERCENT = 0.5;
export const ARMOR_QUADRANT_COUNT = 6;
export const DEFAULT_ARMOR_VALUE = 50;
export const DEFAULT_HULL_VALUE = 100;
export const MOVEMENT_PHASES = 3;
export const TURN_SPEED_DEFAULT = 30;
export const WEAPON_FIXED_ARC = 10;
export const WS_HEARTBEAT_INTERVAL = 30000;
export const WS_RECONNECT_DELAY = 1000;
export const MAX_RECONNECT_ATTEMPTS = 5;

// 导出阵营常量
export {
	FACTIONS,
	DEFAULT_FACTION_IDS,
	FACTION_TURN_DEBOUNCE_MS,
	FACTION_TURN_TIMEOUT_MS,
	MIN_PLAYERS_PER_FACTION,
	MAX_PLAYERS_PER_FACTION,
	getFactionList,
	getFaction,
	isValidFaction,
	getFactionColor,
	getFactionLocalizedName,
} from './factions.js';

/**
 * 获取默认 WebSocket URL
 * - 浏览器环境：使用当前 host 的 /ws 路径（通过 Vite 代理）
 * - Node.js 环境：使用 localhost:3001
 */
export function getDefaultWsUrl(): string {
	// 使用类型断言避免 DOM 依赖
	const globalObj = globalThis as typeof globalThis & { window?: { location?: { host: string } } };
	if (globalObj.window?.location?.host) {
		// 浏览器环境：使用代理路径
		return `ws://${globalObj.window.location.host}/ws`;
	}
	// Node.js 环境：直接连接 WebSocket 服务器
	return "ws://localhost:3001";
}

export const DEFAULT_WS_URL = getDefaultWsUrl();
