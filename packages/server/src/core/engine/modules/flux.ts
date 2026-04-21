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

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createFluxChangeEvent } from "../context.js";
import type { CombatToken } from "../../state/Token.js";
import { calculateModifiedValue } from "./modifier.js";

/**
 * 辐能计算结果
 */
export interface FluxCalculationResult {
	newFluxSoft: number;
	newFluxHard: number;
	totalFlux: number;
	overloaded: boolean;
	overloadChanged: boolean;
}

/**
 * 辐能变化来源
 */
export type FluxSource =
	| "WEAPON_FIRE"
	| "SHIELD_UPKEEP"
	| "SHIELD_HIT"
	| "VENT"
	| "DISSIPATION"
	| "MANUAL";

// ==================== 基础查询函数 ====================

export function getFluxCapacity(ship: CombatToken): number {
	return ship.tokenJson.token.fluxCapacity || 100;
}

export function getFluxDissipation(ship: CombatToken): number {
	const baseDissipation = ship.tokenJson.token.fluxDissipation || 0;
	const runtime = ship.tokenJson.runtime;
	if (!runtime) return baseDissipation;
	return calculateModifiedValue(baseDissipation, runtime, "fluxDissipation");
}

export function getTotalFlux(ship: CombatToken): number {
	const runtime = ship.tokenJson.runtime;
	return (runtime?.fluxSoft || 0) + (runtime?.fluxHard || 0);
}

export function isOverloaded(ship: CombatToken): boolean {
	return ship.tokenJson.runtime?.overloaded || false;
}

// ==================== 辐能添加 ====================

export function addSoftFlux(
	ship: CombatToken,
	amount: number
): { success: boolean; actualAdded: number; newFluxSoft: number } {
	const runtime = ship.tokenJson.runtime;
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
	const runtime = ship.tokenJson.runtime;
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
	const runtime = ship.tokenJson.runtime;
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
	const runtime = ship.tokenJson.runtime;
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

// ==================== 辐散 ====================

export function dissipateFlux(ship: CombatToken): FluxCalculationResult {
	const runtime = ship.tokenJson.runtime;
	if (!runtime) {
		return {
			newFluxSoft: 0,
			newFluxHard: 0,
			totalFlux: 0,
			overloaded: false,
			overloadChanged: false,
		};
	}
	const dissipation = getFluxDissipation(ship);
	const shieldActive = runtime.shield?.active ?? false;

	let newFluxSoft = runtime.fluxSoft || 0;
	let newFluxHard = runtime.fluxHard || 0;
	let overloadChanged = false;

	if (dissipation > 0 && newFluxSoft > 0) {
		newFluxSoft = Math.max(0, newFluxSoft - dissipation);
	}

	if (!shieldActive && dissipation > 0 && newFluxHard > 0) {
		newFluxHard = Math.max(0, newFluxHard - dissipation);
	}

	let overloaded = runtime.overloaded || false;
	if (overloaded) {
		const overloadTime = runtime.overloadTime || 0;
		if (overloadTime <= 0) {
			overloaded = false;
			overloadChanged = true;
		}
	}

	return {
		newFluxSoft,
		newFluxHard,
		totalFlux: newFluxSoft + newFluxHard,
		overloaded,
		overloadChanged,
	};
}

// ==================== 回合结束处理 ====================

export function processTurnEndFlux(ship: CombatToken): {
	fluxDissipated: boolean;
	overloadEnded: boolean;
	newFluxSoft: number;
	newFluxHard: number;
} {
	const runtime = ship.tokenJson.runtime;
	if (!runtime) {
		return {
			fluxDissipated: false,
			overloadEnded: false,
			newFluxSoft: 0,
			newFluxHard: 0,
		};
	}

	if (runtime.overloaded && (runtime.overloadTime || 0) > 0) {
		runtime.overloadTime = (runtime.overloadTime || 0) - 1;
	}

	const result = dissipateFlux(ship);

	runtime.fluxSoft = result.newFluxSoft;
	runtime.fluxHard = result.newFluxHard;

	if (result.overloadChanged) {
		endOverload(ship);
	} else {
		runtime.overloaded = result.overloaded;
	}

	return {
		fluxDissipated: result.newFluxSoft < (runtime.fluxSoft || 0),
		overloadEnded: result.overloadChanged,
		newFluxSoft: result.newFluxSoft,
		newFluxHard: result.newFluxHard,
	};
}

// ==================== 主动排散 ====================

export function ventFlux(ship: CombatToken): {
	success: boolean;
	reason?: string;
	fluxCleared: number;
} {
	const runtime = ship.tokenJson.runtime;
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
	const runtime = ship.tokenJson.runtime;
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
	const runtime = ship.tokenJson.runtime;
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

// ==================== 兼容性接口（保留现有功能）====================

export function applyFlux(context: EngineContext): { newState: any; events: any[] } {
	const { state, action, ship } = context;
	
	if (!ship) {
		throw new Error("Ship not found for flux action");
	}

	const events = [];
	const updates = new Map<string, any>();

	if (action.type === "VENT_FLUX") {
		const ventResult = ventFlux(ship);
		
		if (ventResult.success) {
			updates.set(`ship:${ship.id}`, {
				tokenJson: {
					...ship.tokenJson,
					runtime: ship.tokenJson.runtime,
				},
			});

			events.push(createFluxChangeEvent(
				ship.id,
				ship.tokenJson.runtime?.fluxSoft || 0,
				ship.tokenJson.runtime?.fluxHard || 0,
				getTotalFlux(ship),
				"VENTED"
			));
		}
	} else if (action.type === "END_TURN") {
	}

	const newState = applyStateUpdates(state, updates);
	return { newState, events };
}

export function validateFluxVent(ship: any): { valid: boolean; error?: string } {
	const result = canVent(ship);
	if (result.canVent) {
		return { valid: true };
	}
	return result.reason 
		? { valid: false, error: result.reason }
		: { valid: false };
}

export function calculateFluxState(
	fluxSoft: number,
	fluxHard: number,
	fluxCapacity: number
): "NORMAL" | "HIGH" | "OVERLOADED" | "VENTING" {
	const totalFlux = fluxSoft + fluxHard;
	const ratio = totalFlux / fluxCapacity;

	if (ratio >= 1.0) {
		return "OVERLOADED";
	} else if (ratio >= 0.7) {
		return "HIGH";
	} else {
		return "NORMAL";
	}
}

export function processFluxDissipation(state: any): {
	shipUpdates: Map<string, any>;
	fluxChanges: Map<string, any>;
} {
	const shipUpdates = new Map<string, any>();
	const fluxChanges = new Map<string, any>();

	for (const [shipId, ship] of state.tokens.entries()) {
		if (ship.tokenJson.runtime?.destroyed) continue;

		const oldTotalFlux = getTotalFlux(ship);
		const oldOverloaded = ship.tokenJson.runtime?.overloaded;

		processTurnEndFlux(ship);

		const newTotalFlux = getTotalFlux(ship);
		const newOverloaded = ship.tokenJson.runtime?.overloaded;

		shipUpdates.set(shipId, { tokenJson: { ...ship.tokenJson, runtime: ship.tokenJson.runtime } });

		if (oldTotalFlux !== newTotalFlux || oldOverloaded !== newOverloaded) {
			fluxChanges.set(shipId, {
				newFluxSoft: ship.tokenJson.runtime?.fluxSoft,
				newFluxHard: ship.tokenJson.runtime?.fluxHard,
				newTotalFlux: newTotalFlux,
				isOverloaded: newOverloaded,
			});
		}
	}

	return { shipUpdates, fluxChanges };
}