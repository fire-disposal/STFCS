/**
 * 游戏规则配置
 *
 * 前端兼容版本：使用硬编码规则，移除 fs 依赖
 * 服务器端可以有自己的配置加载逻辑
 */

import { z } from "zod";

// ==================== Zod Schema ====================

export const DamageModifierSchema = z.object({
	shieldMultiplier: z.number(),
	armorMultiplier: z.number(),
	hullMultiplier: z.number(),
});

export const ArmorQuadrantDefSchema = z.object({
	id: z.number(),
	name: z.string(),
	angleRange: z.object({
		start: z.number(),
		end: z.number(),
	}),
});

export const GameRulesSchema = z.object({
	$schema: z.string(),
	description: z.string(),
	movement: z.object({
		phases: z.object({
			order: z.array(z.string()),
			strictOrder: z.boolean(),
			cannotSkip: z.boolean(),
		}),
		budget: z.object({
			forwardMultiplier: z.number(),
			backwardMultiplier: z.number(),
			strafeMultiplier: z.number(),
			turnMultiplier: z.number(),
		}),
		restrictions: z.object({
			overloaded: z.object({ movementDisabled: z.boolean() }),
			destroyed: z.object({ movementDisabled: z.boolean() }),
		}),
	}),
	combat: z.object({
		damageModifiers: z.record(z.string(), DamageModifierSchema),
		armorQuadrants: z.object({
			definitions: z.array(ArmorQuadrantDefSchema),
			referenceAngle: z.string(),
			normalizeToHeading: z.boolean(),
			singleHitQuadrant: z.boolean(),
		}),
		// 辐能规则固定，不再配置化：
		// - 武器开火 → 软辐能（攻击者）
		// - 护盾维持 → 软辐能
		// - 护盾吸收攻击 → 硬辐能（被攻击者）
		// - 护盾开启时硬辐能不可消散
	}),
});

export type GameRules = z.infer<typeof GameRulesSchema>;

// ==================== 常量 ====================

export const SIZE_COMPATIBILITY: Record<string, string[]> = {
	SMALL: ["SMALL"],
	MEDIUM: ["SMALL", "MEDIUM"],
	LARGE: ["SMALL", "MEDIUM", "LARGE"],
};

export function isWeaponSizeCompatible(mountSize: string, weaponSize: string): boolean {
	return SIZE_COMPATIBILITY[mountSize]?.includes(weaponSize) ?? false;
}

// ==================== 默认游戏规则 ====================

export const DEFAULT_GAME_RULES: GameRules = {
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
				{ id: 0, name: "RF", angleRange: { start: 0, end: 60 } },
				{ id: 1, name: "RR", angleRange: { start: 60, end: 120 } },
				{ id: 2, name: "RB", angleRange: { start: 120, end: 180 } },
				{ id: 3, name: "LB", angleRange: { start: 180, end: 240 } },
				{ id: 4, name: "LL", angleRange: { start: 240, end: 300 } },
				{ id: 5, name: "LF", angleRange: { start: 300, end: 360 } },
			],
			referenceAngle: "heading",
			normalizeToHeading: true,
			singleHitQuadrant: true,
		},
	},
};

// ==================== 导出单例（兼容性）====================

/**
 * @deprecated 使用 DEFAULT_GAME_RULES 代替
 * 保持向后兼容，但不再从文件加载
 */
export const GAME_RULES = DEFAULT_GAME_RULES;
