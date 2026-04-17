/**
 * 战斗房间配置常量
 */

/** 空房间自动销毁时间（毫秒） - 缩短到 30 秒 */
export const EMPTY_ROOM_TTL_MS = 30 * 1000;

/** 房主离开后等待时间（毫秒） - 5分钟 */
export const OWNER_LEAVE_TTL_MS = 5 * 60 * 1000;

/** 默认最大客户端数 */
export const DEFAULT_MAX_CLIENTS = 8;

/** 最大客户端数上限 */
export const MAX_CLIENTS_LIMIT = 16;

/** 最小客户端数 */
export const MIN_CLIENTS = 2;

/** 游戏循环间隔（毫秒） */
export const SIMULATION_INTERVAL_MS = 50;