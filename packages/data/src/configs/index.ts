/**
 * 游戏规则配置加载器
 *
 * 从JSON文件加载所有游戏规则配置，提供类型安全的配置访问
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";

const CONFIGS_DIR = resolve(dirname(new URL(import.meta.url).pathname), "configs");

/** 配置缓存 */
const cache: Map<string, any> = new Map();

/** 配置文件映射 */
const CONFIG_FILES = {
	gameRules: "game-rules.json",
	serverConfig: "server-config.json",
} as const;

/** 已加载标记 */
let loaded = false;

/**
 * 加载所有配置
 */
export function loadAllConfigs(): void {
	if (loaded) return;

	for (const [key, filename] of Object.entries(CONFIG_FILES)) {
		const filepath = resolve(CONFIGS_DIR, filename);
		if (existsSync(filepath)) {
			const content = readFileSync(filepath, "utf-8");
			const config = JSON.parse(content);
			cache.set(key, config);
			console.log(`[RuleConfigs] Loaded ${filename}`);
		} else {
			console.warn(`[RuleConfigs] Missing config: ${filename}`);
		}
	}

	loaded = true;
}

/**
 * 获取游戏核心规则配置
 */
export function getGameRules(): GameRulesConfig {
	ensureLoaded();
	return cache.get("gameRules") ?? getDefaultGameRules();
}

/**
 * 获取服务器配置
 */
export function getServerConfig(): ServerConfig {
	ensureLoaded();
	return cache.get("serverConfig") ?? getDefaultServerConfig();
}

/**
 * 热重载所有配置
 */
export function reloadConfigs(): void {
	cache.clear();
	loaded = false;
	loadAllConfigs();
}

/**
 * 确保已加载
 */
function ensureLoaded(): void {
	if (!loaded) {
		loadAllConfigs();
	}
}

// ==================== 类型定义 ====================

export interface DamageModifierEntry {
	shieldMultiplier: number;
	armorMultiplier: number;
	hullMultiplier: number;
}

export type DamageModifiersMap = Record<string, DamageModifierEntry>;

export interface GameRulesConfig {
	$schema: string;
	description: string;
	movement: {
		phases: {
			order: string[];
			strictOrder: boolean;
			cannotSkip: boolean;
		};
		budget: {
			forwardMultiplier: number;
			backwardMultiplier: number;
			strafeMultiplier: number;
			turnMultiplier: number;
		};
		restrictions: {
			overloaded: { movementDisabled: boolean };
			destroyed: { movementDisabled: boolean };
		};
	};
	combat: {
		damageModifiers: DamageModifiersMap;
		armorQuadrants: {
			definitions: Array<{
				id: number;
				name: string;
				angleRange: {
					start: number;
					end: number;
				};
			}>;
			referenceAngle: string;
			normalizeToHeading: boolean;
			singleHitQuadrant: boolean;
		};
		shieldInteraction: {
			fluxGenerationOnBlock: boolean;
			fluxType: string;
		};
	};
}

export interface ServerConfig {
	$schema: string;
	$version: string;
	description: string;
	game: {
		turnDurationSeconds: number;
		defaultCooldown: number;
		mapDefaultWidth: number;
		mapDefaultHeight: number;
		maxShipsPerRoom: number;
		autoSaveInterval: number;
		description: string;
	};
	room: {
		maxPlayers: number;
		maxClientsLimit: number;
		minClients: number;
		emptyRoomTtlMs: number;
		ownerLeaveTtlMs: number;
		simulationIntervalMs: number;
		description: string;
	};
	connection: {
		reconnectionTimeoutMs: number;
		pingIntervalMs: number;
		heartbeatTimeoutMs: number;
		description: string;
	};
}

// ==================== 游戏全局配置 ====================

/**
 * 获取游戏全局配置（从 server-config.json 加载）
 */
export function getGameConfig() {
	const serverConfig = getServerConfig();
	return {
		DEFAULT_COOLDOWN: serverConfig.game.defaultCooldown,
		MAP_DEFAULT_WIDTH: serverConfig.game.mapDefaultWidth,
		MAP_DEFAULT_HEIGHT: serverConfig.game.mapDefaultHeight,
		MAX_PLAYERS_PER_ROOM: serverConfig.room.maxPlayers,
		RECONNECTION_TIMEOUT_MS: serverConfig.connection.reconnectionTimeoutMs,
	} as const;
}

/** 游戏全局配置常量（懒加载） */
export const GAME_CONFIG = getGameConfig();

// ==================== 游戏规则 ====================

export const SIZE_COMPATIBILITY: Record<string, string[]> = {
	SMALL: ["SMALL"],
	MEDIUM: ["SMALL", "MEDIUM"],
	LARGE: ["SMALL", "MEDIUM", "LARGE"],
};

export function isWeaponSizeCompatible(
	mountSize: string,
	weaponSize: string
): boolean {
	return SIZE_COMPATIBILITY[mountSize]?.includes(weaponSize) ?? false;
}

// ==================== 默认配置 ====================

function getDefaultGameRules(): GameRulesConfig {
	return {
		$schema: "rules-v1",
		description: "STFCS 游戏核心规则配置",
		movement: {
			phases: {
				order: ["PHASE_A", "PHASE_TURN", "PHASE_C"],
				strictOrder: true,
				cannotSkip: true,
			},
			budget: {
				forwardMultiplier: 2.0,
				backwardMultiplier: 2.0,
				strafeMultiplier: 1.0,
				turnMultiplier: 1.0,
			},
			restrictions: {
				overloaded: { movementDisabled: true },
				destroyed: { movementDisabled: true },
			},
		},
		combat: {
			damageModifiers: {
				KINETIC: { shieldMultiplier: 2.0, armorMultiplier: 0.5, hullMultiplier: 1.0 },
				HIGH_EXPLOSIVE: { shieldMultiplier: 0.5, armorMultiplier: 2.0, hullMultiplier: 1.0 },
				ENERGY: { shieldMultiplier: 1.0, armorMultiplier: 1.0, hullMultiplier: 1.0 },
				FRAGMENTATION: { shieldMultiplier: 0.25, armorMultiplier: 0.25, hullMultiplier: 1.0 },
			},
			armorQuadrants: {
				definitions: [
					{ id: 0, name: "RF", angleRange: { start: 0,   end: 60  } },
					{ id: 1, name: "RR", angleRange: { start: 60,  end: 120 } },
					{ id: 2, name: "RB", angleRange: { start: 120, end: 180 } },
					{ id: 3, name: "LB", angleRange: { start: 180, end: 240 } },
					{ id: 4, name: "LL", angleRange: { start: 240, end: 300 } },
					{ id: 5, name: "LF", angleRange: { start: 300, end: 360 } },
				],
				referenceAngle: "heading",
				normalizeToHeading: true,
				singleHitQuadrant: true,
			},
			shieldInteraction: {
				fluxGenerationOnBlock: true,
				fluxType: "HARD",
			},
		},
	};
}

function getDefaultServerConfig(): ServerConfig {
	return {
		$schema: "server-config-v1",
		$version: "1.0.0",
		description: "STFCS 服务器配置",
		game: {
			turnDurationSeconds: 10,
			defaultCooldown: 5,
			mapDefaultWidth: 2000,
			mapDefaultHeight: 2000,
			maxShipsPerRoom: 100,
			autoSaveInterval: 0,
			description: "游戏核心参数",
		},
		room: {
			maxPlayers: 8,
			maxClientsLimit: 16,
			minClients: 2,
			emptyRoomTtlMs: 30000,
			ownerLeaveTtlMs: 300000,
			simulationIntervalMs: 50,
			description: "房间参数",
		},
		connection: {
			reconnectionTimeoutMs: 60000,
			pingIntervalMs: 5000,
			heartbeatTimeoutMs: 15000,
			description: "连接参数",
		},
	};
}
