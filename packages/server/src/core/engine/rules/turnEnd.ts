/**
 * 回合结束规则 - 基于 @vt/data 权威设计
 *
 * 回合结束时需要处理的逻辑：
 * 1. 辐能消散（软辐能优先消散）
 * 2. 过载恢复（overloadTime 递减，归零时解除过载）
 * 3. 武器状态转换（FIRED → COOLDOWN/READY）
 * 4. 移动状态重置（phase A/B/C → A）
 * 5. 主动排散状态清除
 */

import type { CombatToken } from "../../state/Token.js";
import type { WeaponRuntime, MountSpec } from "@vt/data";
import { updateWeaponStateAtTurnEnd } from "./weapon.js";
import { getFluxDissipation, endOverload, addSoftFlux } from "../modules/flux.js";
import { calculateShieldUpkeep } from "../modules/shield.js";
import type { EngineContext, EngineResult } from "../context.js";
import { createEngineEvent } from "../context.js";

export interface TurnEndResult {
	fluxDissipated: boolean;
	overloadEnded: boolean;
	weaponsUpdated: boolean;
	movementReset: boolean;
	ventingCleared: boolean;
	newFluxSoft: number;
	newFluxHard: number;
}

export interface ProcessAllTokensResult {
	tokensUpdated: string[];
	fluxChanges: Map<string, { soft: number; hard: number; total: number }>;
	overloadRecoveries: string[];
	weaponStateChanges: string[];
}

/**
 * 处理单个舰船的回合结束逻辑
 */
export function processTokenTurnEnd(token: CombatToken): TurnEndResult {
	const runtime = token.runtime;
	if (!runtime || runtime.destroyed) {
		return {
			fluxDissipated: false,
			overloadEnded: false,
			weaponsUpdated: false,
			movementReset: false,
			ventingCleared: false,
			newFluxSoft: runtime?.fluxSoft ?? 0,
			newFluxHard: runtime?.fluxHard ?? 0,
		};
	}

	const result: TurnEndResult = {
		fluxDissipated: false,
		overloadEnded: false,
		weaponsUpdated: false,
		movementReset: false,
		ventingCleared: false,
		newFluxSoft: runtime.fluxSoft ?? 0,
		newFluxHard: runtime.fluxHard ?? 0,
	};

	// 1. 处理排散状态清除
	if (runtime.venting) {
		runtime.venting = false;
		result.ventingCleared = true;
	}

	// 2. 处理过载恢复时间
	if (runtime.overloaded && runtime.overloadTime > 0) {
		runtime.overloadTime = runtime.overloadTime - 1;
		if (runtime.overloadTime <= 0) {
			endOverload(token);
			result.overloadEnded = true;
		}
	}

	// 3. 护盾维持消耗：护盾开启时每回合结束产生 soft flux（含容量检查和过载触发）
	const shieldUpkeep = calculateShieldUpkeep(token);
	if (shieldUpkeep > 0) {
		addSoftFlux(token, shieldUpkeep);
		result.newFluxSoft = token.runtime?.fluxSoft ?? 0;
	}

	// 4. 处理辐能消散
	const dissipation = getFluxDissipation(token);
	const shieldActive = runtime.shield?.active ?? false;

	if (dissipation > 0) {
		const oldSoft = runtime.fluxSoft ?? 0;
		const oldHard = runtime.fluxHard ?? 0;

		// 软辐能优先消散
		if (oldSoft > 0) {
			runtime.fluxSoft = Math.max(0, oldSoft - dissipation);
			result.fluxDissipated = runtime.fluxSoft < oldSoft;
		}

		// 护盾关闭时硬辐能也会消散
		if (!shieldActive && oldHard > 0) {
			runtime.fluxHard = Math.max(0, oldHard - dissipation);
			result.fluxDissipated = result.fluxDissipated || runtime.fluxHard < oldHard;
		}

		result.newFluxSoft = runtime.fluxSoft ?? 0;
		result.newFluxHard = runtime.fluxHard ?? 0;
	}

	// 4. 处理武器状态转换
	if (runtime.weapons && runtime.weapons.length > 0) {
		const spec = token.spec;
		const oldWeapons = runtime.weapons;
		const updatedWeapons: (WeaponRuntime | undefined)[] = oldWeapons.map((w: WeaponRuntime | undefined) => {
			if (!w) return w;
			const mount = spec.mounts?.find((m: MountSpec) => m.id === w.mountId);
			const weaponSpec = mount?.weapon?.spec;
			if (weaponSpec) {
				return updateWeaponStateAtTurnEnd(w, weaponSpec);
			}
			return updateWeaponStateAtTurnEnd(w);
		});

		const hasChanges = updatedWeapons.some(
			(w: WeaponRuntime | undefined, i: number) => w && oldWeapons[i] && w.state !== oldWeapons[i]?.state
		);

		if (hasChanges) {
			runtime.weapons = updatedWeapons as typeof runtime.weapons;
			result.weaponsUpdated = true;
		}
	}

	// 6. 重置移动状态
	if (runtime.movement) {
		runtime.movement = {
			currentPhase: "A",
			phaseAUsed: 0,
			turnAngleUsed: 0,
			phaseCUsed: 0,
			phaseALock: null,
			phaseCLock: null,
			hasMoved: false,
		};
		result.movementReset = true;
	}

	// 7. 重置开火标记
	runtime.hasFired = false;

	return result;
}

/**
 * 处理所有舰船的回合结束逻辑
 */
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

		if (tokenResult.fluxDissipated || tokenResult.overloadEnded ||
			tokenResult.weaponsUpdated || tokenResult.movementReset ||
			tokenResult.ventingCleared) {
			result.tokensUpdated.push(token.$id);
		}

		if (tokenResult.fluxDissipated) {
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

/**
 * 检查回合结束合法性（用于验证）
 */
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

// ==================== Engine Action Handlers ====================

/**
* 应用结束回合（标记 hasFired）
* 纯计算：读取 state，返回更新指令
*/
export function applyEndTurn(context: EngineContext): EngineResult {
	const payload = context.payload as Record<string, unknown>;
	const tokenId = payload["tokenId"] as string;
	if (!context.state.tokens[tokenId]) return { runtimeUpdates: [], events: [] };

	return {
		runtimeUpdates: [{
			tokenId,
			updates: { hasFired: true } as Record<string, unknown>,
		}],
		events: [createEngineEvent("end_turn", tokenId)],
	};
}