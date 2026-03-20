/**
 * 阵营常量定义
 * 
 * 定义默认阵营和阵营回合相关常量
 */

import type { FactionDefinition } from '../types/faction.js';

// 默认阵营定义
export const FACTIONS: Record<string, FactionDefinition> = {
	federation: {
		id: 'federation',
		name: 'Federation',
		nameLocalized: {
			zh: '联邦',
			en: 'Federation',
		},
		color: '#4a9eff', // 蓝色
		icon: 'shield',
		description: 'United Federation of Planets - defenders of peace and democracy',
	},
	empire: {
		id: 'empire',
		name: 'Empire',
		nameLocalized: {
			zh: '帝国',
			en: 'Empire',
		},
		color: '#ff4a4a', // 红色
		icon: 'sword',
		description: 'Galactic Empire - conquerors seeking total domination',
	},
};

// 默认阵营 ID 列表
export const DEFAULT_FACTION_IDS = ['federation', 'empire'] as const;

// 防抖延迟（毫秒）- 阵营所有玩家结束后等待时间
export const FACTION_TURN_DEBOUNCE_MS = 1000;

// 回合超时时间（毫秒）- 单个阵营最大行动时间
export const FACTION_TURN_TIMEOUT_MS = 300000; // 5 分钟

// 最小玩家数量
export const MIN_PLAYERS_PER_FACTION = 1;

// 最大玩家数量
export const MAX_PLAYERS_PER_FACTION = 8;

/**
 * 获取阵营列表
 */
export function getFactionList(): FactionDefinition[] {
	return Object.values(FACTIONS);
}

/**
 * 获取阵营定义
 */
export function getFaction(id: string): FactionDefinition | undefined {
	return FACTIONS[id];
}

/**
 * 检查阵营是否存在
 */
export function isValidFaction(id: string): boolean {
	return id in FACTIONS;
}

/**
 * 获取阵营颜色
 */
export function getFactionColor(id: string): string {
	return FACTIONS[id]?.color ?? '#888888';
}

/**
 * 获取阵营本地化名称
 */
export function getFactionLocalizedName(id: string, locale: 'zh' | 'en' = 'zh'): string {
	const faction = FACTIONS[id];
	return faction?.nameLocalized[locale] ?? id;
}