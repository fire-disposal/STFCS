/**
 * 战斗房间配置常量
 */

/** 空房间自动销毁时间（毫秒） - 缩短到 30 秒 */
export const EMPTY_ROOM_TTL_MS = 30 * 1000;

/** 默认最大客户端数 */
export const DEFAULT_MAX_CLIENTS = 8;

/** 最大客户端数上限 */
export const MAX_CLIENTS_LIMIT = 16;

/** 最小客户端数 */
export const MIN_CLIENTS = 2;

/** 重连等待窗口（秒） - 轻量化：10秒内可恢复玩家状态 */
export const RECONNECTION_WINDOW_SECONDS = 10;

/** 游戏循环间隔（毫秒） */
export const SIMULATION_INTERVAL_MS = 50;