/**
 * 游戏配置和伤害倍率
 *
 * 这些数据定义游戏规则的核心参数
 */

import type { DamageTypeValue } from "@vt/types";

// ==================== 伤害倍率 ====================

export const DAMAGE_MODIFIERS: Record<
	DamageTypeValue,
	{ shield: number; armor: number; hull: number; description?: string }
> = {
	KINETIC: {
		shield: 0.5,
		armor: 2.0,
		hull: 1.0,
		description: "动能武器 - 对装甲有效，被护盾削弱",
	},
	HIGH_EXPLOSIVE: {
		shield: 0.5,
		armor: 2.0,
		hull: 1.0,
		description: "高爆武器 - 对装甲有效，被护盾削弱",
	},
	ENERGY: {
		shield: 1.0,
		armor: 1.0,
		hull: 1.0,
		description: "能量武器 - 均衡伤害",
	},
	FRAGMENTATION: {
		shield: 0.25,
		armor: 0.25,
		hull: 0.25,
		description: "破片武器 - 对装甲和护盾无效",
	},
};

// ==================== 游戏全局配置 ====================

export const GAME_CONFIG = {
	SHIELD_UP_FLUX_COST: 10,
	OVERLOAD_BASE_DURATION: 10,
	VENT_FLUX_RATE: 30,
	OVERLOAD_FLUX_DECAY: 20,
	DEFAULT_COOLDOWN: 5,
	SHIELD_FLUX_PER_DAMAGE: 1,
	MAP_DEFAULT_WIDTH: 2000,
	MAP_DEFAULT_HEIGHT: 2000,
	MAX_PLAYERS_PER_ROOM: 8,
	RECONNECTION_TIMEOUT_MS: 60000,
} as const;

// ==================== 护甲象限名称 ====================

export const ARMOR_QUADRANT_NAMES = {
	FRONT_TOP: "前上方",
	FRONT_BOTTOM: "前下方",
	LEFT_TOP: "左上方",
	LEFT_BOTTOM: "左下方",
	RIGHT_TOP: "右上方",
	RIGHT_BOTTOM: "右下方",
} as const;
