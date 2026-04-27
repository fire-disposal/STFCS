/**
 * 辐能系统 (Flux System)
 *
 * 核心功能：
 * 1. 软辐能/硬辐能管理
 * 2. 辐散（每回合软辐能下降）
 * 3. 过载判定和效果
 * 4. 主动排散
 * 5. 武器开火、护盾维持/防御产生的辐能
 */

import type { CombatToken } from "@vt/data";
import { calculateModifiedValue } from "./modifier.js";
import type { EngineContext, EngineResult } from "../context.js";
import { createEngineEvent } from "../context.js";

/**
 * 辐能计算结果
 */

// ==================== 基础查询函数 ====================
export function getFluxCapacity(ship: CombatToken): number {
	return ship.spec.fluxCapacity || 100;
}

export function getFluxDissipation(ship: CombatToken): number {
	const baseDissipation = ship.spec.fluxDissipation || 0;
	const runtime = ship.runtime;
	if (!runtime) return baseDissipation;
	return calculateModifiedValue(baseDissipation, runtime, "fluxDissipation");
}

export function getTotalFlux(ship: CombatToken): number {
	const runtime = ship.runtime;
	return (runtime?.fluxSoft || 0) + (runtime?.fluxHard || 0);
}

export function isOverloaded(ship: CombatToken): boolean {
	return ship.runtime?.overloaded || false;
}

// ==================== 辐能添加 ====================

export function addSoftFlux(
	ship: CombatToken,
	amount: number
): { success: boolean; actualAdded: number; newFluxSoft: number } {
	const runtime = ship.runtime;
	if (!runtime) {
		return { success: false, actualAdded: 0, newFluxSoft: 0 };
	}
	if (amount <= 0) {
		return { success: true, actualAdded: 0, newFluxSoft: runtime.fluxSoft || 0 };
	}

	const capacity = getFluxCapacity(ship);
	const currentTotal = getTotalFlux(ship);
	const available = capacity - currentTotal;

	if (available <= 0) {
		return {
			success: false,
			actualAdded: 0,
			newFluxSoft: runtime.fluxSoft || 0,
		};
	}

	const actualAdded = Math.min(amount, available);
	runtime.fluxSoft = (runtime.fluxSoft || 0) + actualAdded;

	if (getTotalFlux(ship) >= capacity) {
		triggerOverload(ship);
	}

	return {
		success: actualAdded > 0,
		actualAdded,
		newFluxSoft: runtime.fluxSoft,
	};
}

export function addHardFlux(
	ship: CombatToken,
	amount: number
): { success: boolean; actualAdded: number; newFluxHard: number } {
	const runtime = ship.runtime;
	if (!runtime) {
		return { success: false, actualAdded: 0, newFluxHard: 0 };
	}
	if (amount <= 0) {
		return { success: true, actualAdded: 0, newFluxHard: runtime.fluxHard || 0 };
	}

	const capacity = getFluxCapacity(ship);
	const currentTotal = getTotalFlux(ship);
	const available = capacity - currentTotal;

	if (available <= 0) {
		return {
			success: false,
			actualAdded: 0,
			newFluxHard: runtime.fluxHard || 0,
		};
	}

	const actualAdded = Math.min(amount, available);
	runtime.fluxHard = (runtime.fluxHard || 0) + actualAdded;

	if (getTotalFlux(ship) >= capacity) {
		triggerOverload(ship);
	}

	return {
		success: actualAdded > 0,
		actualAdded,
		newFluxHard: runtime.fluxHard,
	};
}

// ==================== 过载管理 ====================

export function triggerOverload(ship: CombatToken): void {
	const runtime = ship.runtime;
	if (!runtime || runtime.overloaded) return;

	runtime.overloaded = true;
	runtime.overloadTime = 1;

	if (runtime.shield) {
		runtime.shield.active = false;
	}

	if (runtime.weapons) {
		runtime.weapons.forEach((w: any) => {
			if (w.state === "READY" || w.state === "COOLDOWN") {
				w.state = "DISABLED";
			}
		});
	}
}

export function endOverload(ship: CombatToken): void {
	const runtime = ship.runtime;
	if (!runtime || !runtime.overloaded) return;

	runtime.overloaded = false;
	runtime.overloadTime = 0;

	const capacity = getFluxCapacity(ship);
	const targetFlux = capacity / 2;
	const currentTotal = getTotalFlux(ship);

	if (currentTotal > targetFlux) {
		const excess = currentTotal - targetFlux;
		const currentSoft = runtime.fluxSoft || 0;
		if (currentSoft >= excess) {
			runtime.fluxSoft = currentSoft - excess;
		} else {
			const remaining = excess - currentSoft;
			runtime.fluxSoft = 0;
			runtime.fluxHard = Math.max(0, (runtime.fluxHard || 0) - remaining);
		}
	}

	if (runtime.weapons) {
		runtime.weapons.forEach((w: any) => {
			if (w.state === "DISABLED") {
				w.state = "READY";
			}
		});
	}
}

// ==================== 主动排散 ====================

export function ventFlux(ship: CombatToken): {
	success: boolean;
	reason?: string;
	fluxCleared: number;
} {
	const runtime = ship.runtime;
	if (!runtime) {
		return { success: false, reason: "No runtime state", fluxCleared: 0 };
	}

	if (runtime.venting) {
		return { success: false, reason: "Already venting this turn", fluxCleared: 0 };
	}

	if (runtime.hasFired) {
		return { success: false, reason: "Cannot vent after firing weapons", fluxCleared: 0 };
	}

	if (runtime.shield) {
		runtime.shield.active = false;
	}

	// 禁用所有武器（主动排散期间无法开火）
	if (runtime.weapons) {
		runtime.weapons.forEach((w: any) => {
			if (w.state === "READY" || w.state === "COOLDOWN") {
				w.state = "DISABLED";
			}
		});
	}

	const fluxCleared = getTotalFlux(ship);
	runtime.fluxSoft = 0;
	runtime.fluxHard = 0;

	if (runtime.overloaded) {
		endOverload(ship);
	}

	runtime.venting = true;

	return {
		success: true,
		fluxCleared,
	};
}

export function canVent(ship: CombatToken): {
	canVent: boolean;
	reason?: string;
} {
	const runtime = ship.runtime;
	if (!runtime) {
		return { canVent: false, reason: "No runtime state" };
	}

	if (runtime.destroyed) {
		return { canVent: false, reason: "Ship is destroyed" };
	}

	if (runtime.venting) {
		return { canVent: false, reason: "Already venting this turn" };
	}

	if (runtime.hasFired) {
		return { canVent: false, reason: "Cannot vent after firing weapons" };
	}

	return { canVent: true };
}

// ==================== 状态查询 ====================

export function getFluxStatus(ship: CombatToken): {
	fluxSoft: number;
	fluxHard: number;
	totalFlux: number;
	fluxCapacity: number;
	fluxDissipation: number;
	percentage: number;
	overloaded: boolean;
	venting: boolean;
} {
	const runtime = ship.runtime;
	const capacity = getFluxCapacity(ship);
	const total = getTotalFlux(ship);

	return {
		fluxSoft: runtime?.fluxSoft || 0,
		fluxHard: runtime?.fluxHard || 0,
		totalFlux: total,
		fluxCapacity: capacity,
		fluxDissipation: getFluxDissipation(ship),
		percentage: capacity > 0 ? (total / capacity) * 100 : 0,
		overloaded: runtime?.overloaded || false,
		venting: runtime?.venting || false,
	};
}

// ==================== Engine Action Handlers ====================

/**
	* 应用主动排散
	* 纯计算：读取 state，返回更新指令（不直接修改 state）
	* 注意：不调用 ventFlux（该函数有副作用），直接计算更新值
	*/
export function applyVent(context: EngineContext): EngineResult {
	const payload = context.payload as Record<string, unknown>;
	const tokenId = payload["tokenId"] as string;
	const ship = context.state.tokens[tokenId];
	if (!ship) return { runtimeUpdates: [], events: [] };

	const runtime = ship.runtime;
	if (!runtime || runtime.destroyed || runtime.venting || runtime.hasFired) {
		return { runtimeUpdates: [], events: [] };
	}

	return {
		runtimeUpdates: [{
			tokenId,
			updates: {
				fluxSoft: 0,
				fluxHard: 0,
				venting: true,
			} as Record<string, unknown>,
		}],
		events: [createEngineEvent("vent", tokenId)],
	};
}