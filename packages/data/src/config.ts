/**
 * 游戏配置和伤害倍率
 *
 * 这些数据定义游戏规则的核心参数
 */

import type { DamageModifiersMap, DamageTypeValue } from "./types.js";

// ==================== 伤害倍率 ====================
// 参考 GDD 第 5.1 节：武器伤害类型修正

export const DAMAGE_MODIFIERS: DamageModifiersMap = {
	KINETIC: {
		shield: 2.0,    // 动能对护盾加倍伤害
		armor: 0.5,     // 动能对护甲减半穿甲
		hull: 1.0,      // 动能对船体正常
		description: "动能武器 - 反盾专用，快速削盾",
	},
	HIGH_EXPLOSIVE: {
		shield: 0.5,    // 高爆对护盾减半伤害
		armor: 2.0,     // 高爆对护甲加倍穿甲
		hull: 1.0,      // 高爆对船体正常
		description: "高爆武器 - 反甲专用，穿透护甲",
	},
	ENERGY: {
		shield: 1.0,    // 能量对所有目标均等
		armor: 1.0,
		hull: 1.0,
		description: "能量武器 - 万金油，无修正",
	},
	FRAGMENTATION: {
		shield: 0.25,   // 破片对护盾极弱
		armor: 0.25,    // 破片对护甲极弱
		hull: 1.0,      // 破片对船体正常（反船体专用）
		description: "破片武器 - 反船体，对防护无效",
	},
};

// ==================== 游戏全局配置 ====================

export const GAME_CONFIG = {
	// 回合系统
	TURN_DURATION_SECONDS: 10,       // 每回合时间（秒），用于弹药装填计算

	// 护盾系统
	SHIELD_UP_FLUX_COST: 10,         // 护盾维持每回合辐能消耗
	SHIELD_FLUX_PER_DAMAGE: 1,       // 护盾吸收伤害→硬辐能转化率

	// 过载系统
	OVERLOAD_BASE_DURATION: 10,      // 过载基础持续时间（秒）
	OVERLOAD_FLUX_DECAY: 20,         // 过载恢复后辐能降至 max/2
	VENT_FLUX_RATE: 30,              // 主动排散速率（每秒）

	// 武器系统
	DEFAULT_COOLDOWN: 5,             // 默认冷却时间（秒）

	// 地图系统
	MAP_DEFAULT_WIDTH: 2000,
	MAP_DEFAULT_HEIGHT: 2000,

	// 房间系统
	MAX_PLAYERS_PER_ROOM: 8,
	RECONNECTION_TIMEOUT_MS: 60000,  // 断线重连超时（毫秒）
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
