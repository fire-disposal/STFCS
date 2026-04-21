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

import type { CombatToken } from "../../state/Token.js";
import type { EngineContext } from "../context.js";
import { applyStateUpdates, createShieldToggleEvent } from "../context.js";
import { calculateModifiedValue } from "./modifier.js";

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
 * 应用护盾Action
 */
export function applyShield(context: EngineContext): { newState: any; events: any[] } {
	const { state, action, ship } = context;
	const payload = action.payload as any;
	
	if (!ship) {
		throw new Error("Ship not found for shield action");
	}

	const events = [];
	const updates = new Map<string, any>();

	if (action.type === "TOGGLE_SHIELD") {
		const shieldResult = processShieldToggle(ship, payload);
		
		updates.set(`ship:${ship.id}`, {
			runtime: shieldResult.newRuntime,
		});

		events.push(createShieldToggleEvent(
			ship.id,
			shieldResult.newRuntime.shield?.active || false,
			shieldResult.previousActive
		));
	}

	const newState = applyStateUpdates(state, updates);
	return { newState, events };
}

/**
 * 处理护盾切换
 */
function processShieldToggle(ship: any, payload: any) {
	const runtime = { ...ship.runtime };
	const spec = ship.tokenJson.token;
	
	const previousActive = runtime.shield?.active || false;
	const newActive = payload.active !== undefined ? payload.active : !previousActive;

	if (!runtime.shield) {
		runtime.shield = {
			active: false,
			value: spec.shield?.radius || 0,
			maxShield: spec.shield?.radius || 0,
		};
	}

	runtime.shield.active = newActive;

	if (newActive && !previousActive) {
		const shieldUpkeep = spec.shield?.upkeep || 0;
		if (shieldUpkeep > 0) {
			runtime.fluxSoft = (runtime.fluxSoft || 0) + shieldUpkeep;
		}
	}

	return {
		newRuntime: runtime,
		previousActive,
	};
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
 */
export function isShieldHit(
	ship: CombatToken,
	attackerPosition: { x: number; y: number }
): { hit: boolean; shieldAngle?: number } {
	const runtime = ship.tokenJson.runtime;
	const shield = runtime?.shield;

	if (!shield || !shield.active || shield.value <= 0) {
		return { hit: false };
	}

	const position = runtime?.position ?? { x: 0, y: 0 };
	const dx = attackerPosition.x - position.x;
	const dy = attackerPosition.y - position.y;
	const attackAngle = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;

	const shieldSpec = ship.tokenJson.token.shield;
	if (!shieldSpec) return { hit: false };

	if (shieldSpec.type === "OMNI") {
		return { hit: true, shieldAngle: attackAngle };
	}

	const shieldDirection = shieldSpec.direction || 0;
	const shieldArc = shieldSpec.arc || 120;

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
	const shield = ship.tokenJson.runtime?.shield;
	const shieldSpec = ship.tokenJson.token.shield;

	if (!shield || !shield.active || !shieldSpec) {
		return 0;
	}

	return shieldSpec.upkeep || 0;
}

/**
 * 应用护盾伤害
 */
export function applyShieldDamage(
	ship: CombatToken,
	damage: number
): { shieldDamage: number; overflow: number } {
	const shield = ship.tokenJson.runtime?.shield;

	if (!shield || !shield.active || shield.value <= 0) {
		return { shieldDamage: 0, overflow: damage };
	}

	const remaining = shield.value;
	if (damage >= remaining) {
		shield.value = 0;
		return { shieldDamage: remaining, overflow: damage - remaining };
	} else {
		shield.value -= damage;
		return { shieldDamage: damage, overflow: 0 };
	}
}

/**
 * 切换护盾状态
 */
export function toggleShield(
	ship: CombatToken,
	active: boolean
): ShieldToggleResult {
	const shield = ship.tokenJson.runtime?.shield;
	const shieldSpec = ship.tokenJson.token.shield;

	if (!shieldSpec || !shield) {
		return { success: false, newActive: false, reason: "Ship has no shield" };
	}

	if (ship.tokenJson.runtime?.overloaded) {
		return { success: false, newActive: shield.active, reason: "Ship is overloaded" };
	}

	if (active && ship.tokenJson.runtime?.venting) {
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
	value: number;
	maxShield: number;
	percentage: number;
	type: string;
	upkeep: number;
	canToggle: boolean;
} {
	const shield = ship.tokenJson.runtime?.shield;
	const shieldSpec = ship.tokenJson.token.shield;

	if (!shieldSpec || !shield) {
		return {
			hasShield: false,
			active: false,
			value: 0,
			maxShield: 0,
			percentage: 0,
			type: "NONE",
			upkeep: 0,
			canToggle: false,
		};
	}

	const maxShield = shieldSpec.radius || 100;
	const canToggle = !ship.tokenJson.runtime?.overloaded && !ship.tokenJson.runtime?.destroyed;

	return {
		hasShield: true,
		active: shield.active,
		value: shield.value,
		maxShield,
		percentage: maxShield > 0 ? (shield.value / maxShield) * 100 : 0,
		type: shieldSpec.type,
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
	const spec = ship.tokenJson.token;
	const runtime = ship.tokenJson.runtime;

	if (!runtime?.shield?.active || !spec.shield) {
		return { hit: false, angleDiff: 0 };
	}

	if (spec.shield.type === "OMNI") {
		return { hit: true, angleDiff: 0 };
	}

	const shipAngle = runtime.heading || 0;
	const relativeAttackAngle = ((attackAngle - shipAngle + 360) % 360);

	const shieldDirection = spec.shield.direction || 0;
	const shieldArc = spec.shield.arc || 360;

	const angleDiff = Math.abs(((relativeAttackAngle - shieldDirection + 180) % 360) - 180);

	const hit = angleDiff <= shieldArc / 2;

	return { hit, angleDiff };
}

/**
 * 检查护盾切换合法性
 */
export function validateShieldToggle(ship: any, newActive: boolean): { valid: boolean; error?: string } {
	const runtime = ship.tokenJson.runtime;
	const spec = ship.tokenJson.token;

	if (runtime?.destroyed) {
		return { valid: false, error: "Ship is destroyed" };
	}

	if (runtime?.overloaded) {
		return { valid: false, error: "Ship is overloaded" };
	}

	if (!spec.shield) {
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