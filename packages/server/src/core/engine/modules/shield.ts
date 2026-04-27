/**
 * 护盾系统
 *
 * 核心功能：
 * 1. 护盾开启/关闭
 * 2. 护盾方向计算（全向盾/前盾）
 * 3. 护盾覆盖检测
 * 4. 护盾效率计算
 * 5. 护盾维持消耗
 */

import type { CombatToken } from "@vt/data";
import { calculateModifiedValue } from "./modifier.js";
import { angleBetween } from "@vt/data";
import type { EngineContext, EngineResult } from "../context.js";
import { createEngineEvent } from "../context.js";

/**
 * 护盾开启结果
 */
export interface ShieldToggleResult {
	success: boolean;
	newActive: boolean;
	reason?: string;
	fluxCost?: number;
}

/**
 * 判断护盾是否覆盖指定角度
 */
export function isAngleInShieldArc(
	shipHeading: number,
	shieldDirection: number,
	shieldArc: number,
	targetAngle: number
): boolean {
	const relativeAngle = ((targetAngle - shipHeading - shieldDirection + 540) % 360) - 180;
	return Math.abs(relativeAngle) <= shieldArc / 2;
}

/**
 * 判断攻击是否命中护盾
 * 
 * @param ship - 目标舰船
 * @param attackerPosition - 攻击者位置
 * @returns 命中结果和攻击角度
 * 
 * 护盾朝向（shield.direction）使用航海坐标系：
 * - 0° = 船头方向（北）
 * - 90° = 右舷方向（东）
 * - 180° = 船尾方向（南）
 * - 270° = 左舷方向（西）
 */
export function isShieldHit(
	ship: CombatToken,
	attackerPosition: { x: number; y: number }
): { hit: boolean; shieldAngle?: number } {
	const runtime = ship.runtime;
	const shield = runtime?.shield;

	if (!shield || !shield.active) {
		return { hit: false };
	}

	const position = runtime?.position ?? { x: 0, y: 0 };
	const attackAngle = angleBetween(position, attackerPosition);

	const shieldSpec = ship.spec.shield;
	if (!shieldSpec) return { hit: false };

	const shieldArc = shieldSpec.arc || 360;

	if (shieldArc >= 360) {
		return { hit: true, shieldAngle: attackAngle };
	}

	const shieldDirection = shield.direction ?? 0;
	const inArc = isAngleInShieldArc(
		runtime?.heading ?? 0,
		shieldDirection,
		shieldArc,
		attackAngle
	);

	return { hit: inArc, shieldAngle: attackAngle };
}

/**
 * 计算护盾防御产生的硬辐能
 */
export function calculateShieldFlux(damage: number, efficiency: number): number {
	return damage * efficiency;
}

/**
 * 计算护盾维持消耗
 */
export function calculateShieldUpkeep(ship: CombatToken): number {
	const shield = ship.runtime?.shield;
	const shieldSpec = ship.spec.shield;

	if (!shield || !shield.active || !shieldSpec) {
		return 0;
	}

	return shieldSpec.upkeep || 0;
}


/**
 * 切换护盾状态
 */
export function toggleShield(
	ship: CombatToken,
	active: boolean
): ShieldToggleResult {
	const shield = ship.runtime?.shield;
	const shieldSpec = ship.spec.shield;

	if (!shieldSpec || !shield) {
		return { success: false, newActive: false, reason: "Ship has no shield" };
	}

	if (ship.runtime?.overloaded) {
		return { success: false, newActive: shield.active, reason: "Ship is overloaded" };
	}

	if (active && ship.runtime?.venting) {
		return { success: false, newActive: false, reason: "Cannot activate shield while venting" };
	}

	shield.active = active;

	return {
		success: true,
		newActive: active,
		fluxCost: active ? (shieldSpec.upkeep || 0) : 0,
	};
}

/**
 * 获取护盾状态摘要
 */
export function getShieldStatus(ship: CombatToken): {
	hasShield: boolean;
	active: boolean;
	isOmni: boolean;
	upkeep: number;
	canToggle: boolean;
} {
	const shield = ship.runtime?.shield;
	const shieldSpec = ship.spec.shield;

	if (!shieldSpec || !shield) {
		return {
			hasShield: false,
			active: false,
			isOmni: false,
			upkeep: 0,
			canToggle: false,
		};
	}

	const canToggle = !ship.runtime?.overloaded && !ship.runtime?.destroyed;

	return {
		hasShield: true,
		active: shield.active,
		isOmni: shieldSpec.arc >= 360,
		upkeep: shieldSpec.upkeep || 0,
		canToggle,
	};
}

/**
 * 计算护盾吸收的伤害
 */
export function calculateShieldAbsorption(
	damage: number,
	damageType: string,
	shieldSpec: any,
	runtime?: any
): { absorbedDamage: number; fluxGenerated: number } {
	const baseEfficiency = shieldSpec.efficiency || 1.0;
	const efficiency = runtime
		? calculateModifiedValue(baseEfficiency, runtime, "shieldEfficiency")
		: baseEfficiency;

	let shieldMultiplier = 1.0;
	switch (damageType) {
		case "KINETIC":
			shieldMultiplier = 2.0;
			break;
		case "HIGH_EXPLOSIVE":
			shieldMultiplier = 0.5;
			break;
		case "ENERGY":
			shieldMultiplier = 1.0;
			break;
		case "FRAGMENTATION":
			shieldMultiplier = 0.25;
			break;
	}

	const shieldDamage = damage * shieldMultiplier;
	const fluxGenerated = shieldDamage * efficiency;

	return {
		absorbedDamage: shieldDamage,
		fluxGenerated,
	};
}

/**
 * 检查攻击是否命中护盾（旧版兼容）
 */
export function checkShieldHit(
	ship: any,
	attackAngle: number,
	_hitPosition: { x: number; y: number }
): { hit: boolean; angleDiff: number } {
	const spec = ship.spec;
	const runtime = ship.runtime;

	if (!runtime?.shield?.active || !spec.shield) {
		return { hit: false, angleDiff: 0 };
	}

	const shieldArc = spec.shield.arc || 360;
	if (shieldArc >= 360) {
		return { hit: true, angleDiff: 0 };
	}

	const shipAngle = runtime.heading || 0;
	const shieldDirection = runtime.shield?.direction ?? 0;

	const relativeAttackAngle = ((attackAngle - shipAngle + 360) % 360);

	const angleDiff = Math.abs(((relativeAttackAngle - shieldDirection + 180) % 360) - 180);

	const hit = angleDiff <= shieldArc / 2;

	return { hit, angleDiff };
}

/**
 * 检查护盾切换合法性
 */
export function validateShieldToggle(ship: any, newActive: boolean): { valid: boolean; error?: string } {
	const runtime = ship.runtime;
	const spec = ship.spec;

	if (runtime?.destroyed) {
		return { valid: false, error: "Ship is destroyed" };
	}

	if (runtime?.overloaded) {
		return { valid: false, error: "Ship is overloaded" };
	}

	if (!spec.shield || !runtime?.shield) {
		return { valid: false, error: "Ship has no shield" };
	}

	const currentActive = runtime?.shield?.active || false;
	if (currentActive === newActive) {
		return { valid: false, error: `Shield is already ${newActive ? "active" : "inactive"}` };
	}

	if (newActive && runtime?.venting) {
		return { valid: false, error: "Cannot activate shield while venting" };
	}

	return { valid: true };
}

/**
 * 检查护盾转向合法性
 * 
 * 在自己的回合内，护盾可以任意调整方向（0-360°）
 */
export function validateShieldRotate(ship: any, newDirection: number): { valid: boolean; error?: string } {
	const runtime = ship.runtime;
	const spec = ship.spec;

	if (runtime?.destroyed) {
		return { valid: false, error: "Ship is destroyed" };
	}

	if (!spec.shield) {
		return { valid: false, error: "Ship has no shield" };
	}

	if (spec.shield.arc >= 360) {
		return { valid: false, error: "Omni shield does not need direction control" };
	}

	if (spec.shield.fixed) {
		return { valid: false, error: "Shield direction is fixed and cannot be rotated" };
	}

	if (!runtime?.shield?.active) {
		return { valid: false, error: "Shield must be active to rotate" };
	}

	if (newDirection < 0 || newDirection > 360) {
		return { valid: false, error: "Direction must be between 0 and 360" };
	}

	return { valid: true };
}

// ==================== Engine Action Handlers ====================

/**
* 应用护盾开关
* 纯计算：读取 state，返回更新指令（不直接修改 state）
*/
export function applyShieldToggle(context: EngineContext): EngineResult {
	const payload = context.payload as Record<string, unknown>;
	const tokenId = payload["tokenId"] as string;
	const ship = context.state.tokens[tokenId];
	if (!ship) return { runtimeUpdates: [], events: [] };

	const active = !!payload["active"];
	const shieldRuntime = ship.runtime?.shield;
	const shieldSpec = ship.spec.shield;

	if (!shieldSpec || !shieldRuntime) return { runtimeUpdates: [], events: [] };
	if (ship.runtime?.overloaded) return { runtimeUpdates: [], events: [] };
	if (active && ship.runtime?.venting) return { runtimeUpdates: [], events: [] };

	const updates: Record<string, unknown> = {
		shield: {
			...shieldRuntime,
			active,
		},
	};

	// 注：开启护盾不立即产生辐能
	// 维护费由 processTokenTurnEnd → calculateShieldUpkeep 在回合结束时根据护盾最终状态收取
	const fluxCost = 0;

	return {
		runtimeUpdates: [{ tokenId, updates }],
		events: [createEngineEvent("shield_toggle", tokenId, { active, fluxCost })],
	};
}

/**
* 应用护盾转向
* 纯计算：读取 state，返回更新指令
*/
export function applyShieldRotate(context: EngineContext): EngineResult {
	const payload = context.payload as Record<string, unknown>;
	const tokenId = payload["tokenId"] as string;
	const ship = context.state.tokens[tokenId];
	if (!ship) return { runtimeUpdates: [], events: [] };

	const direction = (payload["direction"] ?? 0) as number;
	const shieldRuntime = ship.runtime?.shield;
	if (!shieldRuntime) return { runtimeUpdates: [], events: [] };

	const validation = validateShieldRotate(ship, direction);
	if (!validation.valid) return { runtimeUpdates: [], events: [] };

	return {
		runtimeUpdates: [{
			tokenId,
			updates: {
				shield: {
					active: shieldRuntime.active ?? false,
					direction,
				},
			} as Record<string, unknown>,
		}],
		events: [createEngineEvent("shield_rotate", tokenId, { direction })],
	};
}