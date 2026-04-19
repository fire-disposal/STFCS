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
import type { ShipTokenState } from "../../state/Token.js";

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

export function getFluxCapacity(ship: ShipTokenState): number {
	return ship.shipJson.ship.fluxCapacity || 100;
}

export function getFluxDissipation(ship: ShipTokenState): number {
	return ship.shipJson.ship.fluxDissipation || 0;
}

export function getTotalFlux(ship: ShipTokenState): number {
	const runtime = ship.runtime;
	return (runtime.fluxSoft || 0) + (runtime.fluxHard || 0);
}

export function isOverloaded(ship: ShipTokenState): boolean {
	return ship.runtime.overloaded || false;
}

// ==================== 辐能添加 ====================

export function addSoftFlux(
	ship: ShipTokenState,
	amount: number
): { success: boolean; actualAdded: number; newFluxSoft: number } {
	if (amount <= 0) {
		return { success: true, actualAdded: 0, newFluxSoft: ship.runtime.fluxSoft || 0 };
	}

	const capacity = getFluxCapacity(ship);
	const currentTotal = getTotalFlux(ship);
	const available = capacity - currentTotal;

	if (available <= 0) {
		return {
			success: false,
			actualAdded: 0,
			newFluxSoft: ship.runtime.fluxSoft || 0,
		};
	}

	const actualAdded = Math.min(amount, available);
	ship.runtime.fluxSoft = (ship.runtime.fluxSoft || 0) + actualAdded;

	// 检查是否触发过载
	if (getTotalFlux(ship) >= capacity) {
		triggerOverload(ship);
	}

	return {
		success: actualAdded > 0,
		actualAdded,
		newFluxSoft: ship.runtime.fluxSoft,
	};
}

export function addHardFlux(
	ship: ShipTokenState,
	amount: number
): { success: boolean; actualAdded: number; newFluxHard: number } {
	if (amount <= 0) {
		return { success: true, actualAdded: 0, newFluxHard: ship.runtime.fluxHard || 0 };
	}

	const capacity = getFluxCapacity(ship);
	const currentTotal = getTotalFlux(ship);
	const available = capacity - currentTotal;

	if (available <= 0) {
		return {
			success: false,
			actualAdded: 0,
			newFluxHard: ship.runtime.fluxHard || 0,
		};
	}

	const actualAdded = Math.min(amount, available);
	ship.runtime.fluxHard = (ship.runtime.fluxHard || 0) + actualAdded;

	if (getTotalFlux(ship) >= capacity) {
		triggerOverload(ship);
	}

	return {
		success: actualAdded > 0,
		actualAdded,
		newFluxHard: ship.runtime.fluxHard,
	};
}

// ==================== 过载管理 ====================

export function triggerOverload(ship: ShipTokenState): void {
	if (ship.runtime.overloaded) return;

	ship.runtime.overloaded = true;
	ship.runtime.overloadTime = 1;

	// 关闭护盾
	if (ship.runtime.shield) {
		ship.runtime.shield.active = false;
	}

	// 禁用武器
	if (ship.runtime.weapons) {
		ship.runtime.weapons.forEach((w: any) => {
			if (w.state === "READY" || w.state === "COOLDOWN") {
				w.state = "DISABLED";
			}
		});
	}
}

export function endOverload(ship: ShipTokenState): void {
	if (!ship.runtime.overloaded) return;

	ship.runtime.overloaded = false;
	ship.runtime.overloadTime = 0;

	// 过载结束时辐能降到最大值的一半
	const capacity = getFluxCapacity(ship);
	const targetFlux = capacity / 2;
	const currentTotal = getTotalFlux(ship);

	if (currentTotal > targetFlux) {
		const excess = currentTotal - targetFlux;
		// 优先减少软辐能
		const currentSoft = ship.runtime.fluxSoft || 0;
		if (currentSoft >= excess) {
			ship.runtime.fluxSoft = currentSoft - excess;
		} else {
			const remaining = excess - currentSoft;
			ship.runtime.fluxSoft = 0;
			ship.runtime.fluxHard = Math.max(0, (ship.runtime.fluxHard || 0) - remaining);
		}
	}

	// 恢复武器状态（从 DISABLED 恢复）
	if (ship.runtime.weapons) {
		ship.runtime.weapons.forEach((w: any) => {
			if (w.state === "DISABLED") {
				w.state = "READY";
			}
		});
	}
}

// ==================== 辐散 ====================

export function dissipateFlux(ship: ShipTokenState): FluxCalculationResult {
	const runtime = ship.runtime;
	const dissipation = getFluxDissipation(ship);

	let newFluxSoft = runtime.fluxSoft || 0;
	let newFluxHard = runtime.fluxHard || 0;
	let overloadChanged = false;

	// 软辐能散逸
	if (dissipation > 0 && newFluxSoft > 0) {
		newFluxSoft = Math.max(0, newFluxSoft - dissipation);
	}

	// 检查过载是否结束
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

export function processTurnEndFlux(ship: ShipTokenState): {
	fluxDissipated: boolean;
	overloadEnded: boolean;
	newFluxSoft: number;
	newFluxHard: number;
} {
	const runtime = ship.runtime;

	// 减少过载时间
	if (runtime.overloaded && (runtime.overloadTime || 0) > 0) {
		runtime.overloadTime = (runtime.overloadTime || 0) - 1;
	}

	// 辐散
	const result = dissipateFlux(ship);

	// 更新状态
	runtime.fluxSoft = result.newFluxSoft;
	runtime.fluxHard = result.newFluxHard;

	// 检查过载是否结束
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

export function ventFlux(ship: ShipTokenState): {
	success: boolean;
	reason?: string;
	fluxCleared: number;
} {
	const runtime = ship.runtime;

	if (runtime.venting) {
		return { success: false, reason: "Already venting this turn", fluxCleared: 0 };
	}

	if (runtime.hasFired) {
		return { success: false, reason: "Cannot vent after firing weapons", fluxCleared: 0 };
	}

	// 关闭护盾
	if (runtime.shield) {
		runtime.shield.active = false;
	}

	// 清空辐能
	const fluxCleared = getTotalFlux(ship);
	runtime.fluxSoft = 0;
	runtime.fluxHard = 0;

	// 如果过载中，结束过载
	if (runtime.overloaded) {
		endOverload(ship);
	}

	// 标记主动排散
	runtime.venting = true;

	return {
		success: true,
		fluxCleared,
	};
}

export function canVent(ship: ShipTokenState): {
	canVent: boolean;
	reason?: string;
} {
	const runtime = ship.runtime;

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

export function getFluxStatus(ship: ShipTokenState): {
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
		fluxSoft: runtime.fluxSoft || 0,
		fluxHard: runtime.fluxHard || 0,
		totalFlux: total,
		fluxCapacity: capacity,
		fluxDissipation: getFluxDissipation(ship),
		percentage: capacity > 0 ? (total / capacity) * 100 : 0,
		overloaded: runtime.overloaded || false,
		venting: runtime.venting || false,
	};
}

// ==================== 兼容性接口（保留现有功能）====================

/**
 * 应用辐能Action
 */
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
				runtime: {
					...ship.runtime,
				},
			});

			events.push(createFluxChangeEvent(
				ship.id,
				ship.runtime.fluxSoft || 0,
				ship.runtime.fluxHard || 0,
				getTotalFlux(ship),
				"VENTED"
			));
		}
	} else if (action.type === "END_TURN") {
		// 回合结束时的辐能处理在 GameStateManager 中统一处理
	}

	const newState = applyStateUpdates(state, updates);
	return { newState, events };
}

/**
 * 检查排散辐能合法性
 */
export function validateFluxVent(ship: any): { valid: boolean; error?: string } {
	const result = canVent(ship);
	if (result.canVent) {
		return { valid: true };
	}
	return result.reason 
		? { valid: false, error: result.reason }
		: { valid: false };
}

/**
 * 计算辐能状态
 */
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

/**
 * 处理辐能消散（回合结束时，兼容旧版）
 */
export function processFluxDissipation(state: any): {
	shipUpdates: Map<string, any>;
	fluxChanges: Map<string, any>;
} {
	const shipUpdates = new Map<string, any>();
	const fluxChanges = new Map<string, any>();

	for (const [shipId, ship] of state.tokens.entries()) {
		if (ship.runtime.destroyed) continue;

		const oldTotalFlux = getTotalFlux(ship);
		const oldOverloaded = ship.runtime.overloaded;

		// 使用新的辐能系统处理
		processTurnEndFlux(ship);

		const newTotalFlux = getTotalFlux(ship);
		const newOverloaded = ship.runtime.overloaded;

		shipUpdates.set(shipId, { runtime: ship.runtime });

		if (oldTotalFlux !== newTotalFlux || oldOverloaded !== newOverloaded) {
			fluxChanges.set(shipId, {
				newFluxSoft: ship.runtime.fluxSoft,
				newFluxHard: ship.runtime.fluxHard,
				newTotalFlux: newTotalFlux,
				isOverloaded: newOverloaded,
			});
		}
	}

	return { shipUpdates, fluxChanges };
}
