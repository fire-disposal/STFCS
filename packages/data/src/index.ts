/**
 * @vt/data - 统一数据层导出
 *
 * 所有核心类型和值从 GameSchemas（Zod）统一导出
 */

// ==================== 核心模型（Zod Schema + 类型 + 值）====================
export * from "./core/index.js";

// ==================== 游戏规则配置 ====================
export { GAME_RULES, GameRulesSchema, DamageModifierSchema, ArmorQuadrantDefSchema } from "./configs/index.js";
export type { GameRules } from "./configs/index.js";

// ==================== 类型值别名（兼容性）====================
import {
	GamePhase,
	Faction,
	PlayerRole,
	DamageType,
	WeaponState,
	WeaponTag,
} from "./core/GameSchemas.js";

export type GamePhaseValue = (typeof GamePhase)[keyof typeof GamePhase];
export type FactionValue = (typeof Faction)[keyof typeof Faction];
export type PlayerRoleValue = (typeof PlayerRole)[keyof typeof PlayerRole];
export type DamageTypeValue = (typeof DamageType)[keyof typeof DamageType];
export type WeaponStateValue = (typeof WeaponState)[keyof typeof WeaponState];
export type WeaponTagValue = (typeof WeaponTag)[keyof typeof WeaponTag];
