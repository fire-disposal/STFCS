/**
 * 辐能系统 (Flux System)
 *
 * 纯计算层：
 * 1. 软辐能/硬辐能查询
 * 2. 辐散计算（每回合软辐能下降）
 * 3. 过载判定
 * 4. 状态查询
 *
 * 注意：此模块仅提供纯计算函数，不修改状态。
 * 状态修改由 Engine 层（applyAction, turnEnd）统一管理。
 *
 * 数值约定：所有返回值为整数（四舍五入）
 */

import type { CombatToken } from "@vt/data";
import { calculateModifiedValue } from "./modifier.js";

export function getFluxCapacity(ship: CombatToken): number {
	return Math.round(ship.spec.fluxCapacity ?? 100);
}

export function getFluxDissipation(ship: CombatToken): number {
	const baseDissipation = ship.spec.fluxDissipation ?? 0;
	const runtime = ship.runtime;
	if (!runtime) return Math.round(baseDissipation);
	return Math.round(calculateModifiedValue(baseDissipation, runtime, "fluxDissipation"));
}

export function getTotalFlux(ship: CombatToken): number {
	const runtime = ship.runtime;
	return Math.round((runtime?.fluxSoft ?? 0) + (runtime?.fluxHard ?? 0));
}

export function isOverloaded(ship: CombatToken): boolean {
	return ship.runtime?.overloaded ?? false;
}

export function canVent(ship: CombatToken): { canVent: boolean; reason?: string } {
	const runtime = ship.runtime;
	if (!runtime) return { canVent: false, reason: "No runtime state" };
	if (runtime.destroyed) return { canVent: false, reason: "Ship is destroyed" };
	if (runtime.venting) return { canVent: false, reason: "Already venting this turn" };
	if (runtime.hasFired) return { canVent: false, reason: "Cannot vent after firing weapons" };
	if (runtime.overloaded) return { canVent: false, reason: "Cannot vent while overloaded" };
	return { canVent: true };
}

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
		fluxSoft: Math.round(runtime?.fluxSoft ?? 0),
		fluxHard: Math.round(runtime?.fluxHard ?? 0),
		totalFlux: total,
		fluxCapacity: capacity,
		fluxDissipation: getFluxDissipation(ship),
		percentage: Math.round(capacity > 0 ? (total / capacity) * 100 : 0),
		overloaded: runtime?.overloaded ?? false,
		venting: runtime?.venting ?? false,
	};
}

export function calculateVentResult(ship: CombatToken): {
	fluxSoftAfter: number;
	fluxHardAfter: number;
	fluxCleared: number;
	overloadEnded: boolean;
} {
	const runtime = ship.runtime;
	const fluxBefore = getTotalFlux(ship);
	const overloadBefore = runtime?.overloaded ?? false;

	return {
		fluxSoftAfter: 0,
		fluxHardAfter: 0,
		fluxCleared: Math.round(fluxBefore),
		overloadEnded: overloadBefore,
	};
}
