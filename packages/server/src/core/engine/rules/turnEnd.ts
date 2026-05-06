/**
 * 回合结束规则 - 基于 @vt/data 权威设计
 *
 * 回合结束时需要处理的逻辑：
 * 1. 辐能消散（软辐能优先消散）
 * 2. 过载恢复（overloadTime 递减，归零时解除过载）
 * 3. 武器状态转换（FIRED → COOLDOWN/READY）
 * 4. 移动状态重置（phase A/B/C → A）
 * 5. 主动排散状态清除
 *
 * 数值约定：所有终端数值四舍五入为整数
 */

import type { CombatToken, WeaponRuntime, MountSpec } from "@vt/data";
import { updateWeaponStateAtTurnEnd } from "./weapon.js";
import { getFluxDissipation } from "../modules/flux.js";
import { calculateShieldUpkeep } from "../modules/shield.js";
import type { EngineContext, EngineResult } from "../context.js";
import { createEngineEvent } from "../context.js";

export interface TurnEndResult {
	fluxDissipated: boolean;
	overloadEnded: boolean;
	overloadTriggered?: boolean;
	weaponsUpdated: boolean;
	updatedWeapons?: WeaponRuntime[];
	movementReset: boolean;
	ventingCleared: boolean;
	newFluxSoft: number;
	newFluxHard: number;
	shieldUpkeepAdded: number;
	dissipationReduced: number;
	ventingClearedAmount: number;
	fluxChange: number;
}

export interface ProcessAllTokensResult {
	tokensUpdated: string[];
	fluxChanges: Map<string, { soft: number; hard: number; total: number }>;
	overloadRecoveries: string[];
	weaponStateChanges: string[];
}

export function processTokenTurnEnd(token: CombatToken): TurnEndResult {
	const runtime = token.runtime;
	const initialSoft = Math.round(runtime?.fluxSoft ?? 0);
	const initialHard = Math.round(runtime?.fluxHard ?? 0);
	const initialTotal = initialSoft + initialHard;

	if (!runtime || runtime.destroyed) {
		return {
			fluxDissipated: false,
			overloadEnded: false,
			weaponsUpdated: false,
			movementReset: false,
			ventingCleared: false,
			newFluxSoft: 0,
			newFluxHard: 0,
			shieldUpkeepAdded: 0,
			dissipationReduced: 0,
			ventingClearedAmount: 0,
			fluxChange: 0,
		};
	}

	const result: TurnEndResult = {
		fluxDissipated: false,
		overloadEnded: false,
		weaponsUpdated: false,
		movementReset: false,
		ventingCleared: false,
		newFluxSoft: initialSoft,
		newFluxHard: initialHard,
		shieldUpkeepAdded: 0,
		dissipationReduced: 0,
		ventingClearedAmount: 0,
		fluxChange: 0,
	};

	let currentSoft = initialSoft;
	let currentHard = initialHard;

	// 1. 处理主动排散
	if (runtime.venting) {
		result.ventingCleared = true;
		result.ventingClearedAmount = initialTotal;
		currentSoft = 0;
		currentHard = 0;
	}

	// 2. 处理过载恢复时间
	if (runtime.overloaded && runtime.overloadTime > 0) {
		const newOverloadTime = runtime.overloadTime - 1;
		if (newOverloadTime <= 0) {
			result.overloadEnded = true;
		}
	}

	// 3. 护盾维持消耗：护盾开启时每回合结束产生 soft flux
	const shieldUpkeep = Math.round(calculateShieldUpkeep(token));
	if (shieldUpkeep > 0 && !result.ventingCleared) {
		const capacity = Math.round(token.spec.fluxCapacity ?? 100);
		const currentTotal = currentSoft + currentHard;
		const available = capacity - currentTotal;

		if (available > 0) {
			const added = Math.min(shieldUpkeep, available);
			currentSoft = Math.round(currentSoft + added);
			result.shieldUpkeepAdded = added;
			result.newFluxSoft = currentSoft;

			// 检查是否过载
			if (currentSoft + currentHard >= capacity && !runtime.overloaded) {
				result.overloadTriggered = true;
			}
		}
	}

	// 4. 处理辐能消散
	const dissipation = Math.round(getFluxDissipation(token));
	const shieldActive = runtime.shield?.active ?? false;

	if (dissipation > 0 && !result.ventingCleared) {
		let reduced = 0;
		// 软辐能优先消散
		if (currentSoft > 0) {
			const newSoft = Math.round(Math.max(0, currentSoft - dissipation));
			reduced += currentSoft - newSoft;
			currentSoft = newSoft;
		}

		// 护盾关闭时硬辐能也会消散
		if (!shieldActive && currentHard > 0) {
			const newHard = Math.round(Math.max(0, currentHard - dissipation));
			reduced += currentHard - newHard;
			currentHard = newHard;
		}

		if (reduced > 0) {
			result.fluxDissipated = true;
			result.dissipationReduced = Math.round(reduced);
		}

		result.newFluxSoft = currentSoft;
		result.newFluxHard = currentHard;
	}

	// 计算最终变化
	const finalTotal = currentSoft + currentHard;
	result.fluxChange = Math.round(finalTotal - initialTotal);

	// 5. 处理武器状态转换
	if (runtime.weapons && runtime.weapons.length > 0) {
		const spec = token.spec;
		const weaponsList = runtime.weapons;
		const updatedWeapons: (WeaponRuntime | undefined)[] = weaponsList.map(
			(w: WeaponRuntime | undefined) => {
				if (!w) return w;
				const mount = spec.mounts?.find((m: MountSpec) => m.id === w.mountId);
				const weaponSpec = mount?.weapon?.spec;
				if (weaponSpec) {
					return updateWeaponStateAtTurnEnd(w, weaponSpec);
				}
				return updateWeaponStateAtTurnEnd(w);
			}
		);

		const hasChanges = updatedWeapons.some(
			(w: WeaponRuntime | undefined, i: number) =>
				w && weaponsList[i] && w.state !== weaponsList[i]?.state
		);

		if (hasChanges) {
			result.weaponsUpdated = true;
			result.updatedWeapons = updatedWeapons.filter((w): w is WeaponRuntime => w !== undefined);
		}
	}

	// 6. 重置移动状态
	if (runtime.movement) {
		result.movementReset = true;
	}

	return result;
}

export function processAllTokensTurnEnd(tokens: CombatToken[]): ProcessAllTokensResult {
	const result: ProcessAllTokensResult = {
		tokensUpdated: [],
		fluxChanges: new Map(),
		overloadRecoveries: [],
		weaponStateChanges: [],
	};

	for (const token of tokens) {
		if (token.runtime?.destroyed) continue;

		const tokenResult = processTokenTurnEnd(token);

		if (
			tokenResult.fluxDissipated ||
			tokenResult.overloadEnded ||
			tokenResult.weaponsUpdated ||
			tokenResult.movementReset ||
			tokenResult.ventingCleared
		) {
			result.tokensUpdated.push(token.$id);
		}

		if (tokenResult.fluxDissipated || tokenResult.ventingCleared) {
			result.fluxChanges.set(token.$id, {
				soft: tokenResult.newFluxSoft,
				hard: tokenResult.newFluxHard,
				total: tokenResult.newFluxSoft + tokenResult.newFluxHard,
			});
		}

		if (tokenResult.overloadEnded) {
			result.overloadRecoveries.push(token.$id);
		}

		if (tokenResult.weaponsUpdated) {
			result.weaponStateChanges.push(token.$id);
		}
	}

	return result;
}

export function validateEndTurn(
	token: CombatToken,
	_playerId: string
): { valid: boolean; error?: string } {
	const runtime = token.runtime;

	if (!runtime) {
		return { valid: false, error: "No runtime state" };
	}

	if (runtime.destroyed) {
		return { valid: true };
	}

	return { valid: true };
}

export function applyEndTurn(context: EngineContext): EngineResult {
	const payload = context.payload as Record<string, unknown>;
	const tokenId = payload["tokenId"] as string;
	if (!context.state.tokens[tokenId]) return { runtimeUpdates: [], events: [] };

	return {
		runtimeUpdates: [
			{
				tokenId,
				updates: { hasFired: true } as Record<string, unknown>,
			},
		],
		events: [createEngineEvent("end_turn", tokenId)],
	};
}

export function applyVent(context: EngineContext): EngineResult {
	const payload = context.payload as Record<string, unknown>;
	const tokenId = payload["tokenId"] as string;
	const ship = context.state.tokens[tokenId];
	if (!ship) return { runtimeUpdates: [], events: [] };

	const runtime = ship.runtime;
	if (!runtime || runtime.destroyed || runtime.venting || runtime.hasFired || runtime.overloaded) {
		return { runtimeUpdates: [], events: [] };
	}

	const fluxCleared = Math.round((runtime.fluxSoft ?? 0) + (runtime.fluxHard ?? 0));

	return {
		runtimeUpdates: [
			{
				tokenId,
				updates: {
					fluxSoft: 0,
					fluxHard: 0,
					venting: true,
				} as Record<string, unknown>,
			},
		],
		events: [
			createEngineEvent("vent", tokenId, {
				tokenId,
				tokenName: ship.metadata?.name ?? tokenId,
				fluxCleared,
				fluxSoftBefore: Math.round(runtime.fluxSoft ?? 0),
				fluxHardBefore: Math.round(runtime.fluxHard ?? 0),
			}),
		],
	};
}
