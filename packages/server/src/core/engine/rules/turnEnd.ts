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
}

export interface ProcessAllTokensResult {
	tokensUpdated: string[];
	fluxChanges: Map<string, { soft: number; hard: number; total: number }>;
	overloadRecoveries: string[];
	weaponStateChanges: string[];
}

/**
 * 处理单个舰船的回合结束逻辑
 * 纯计算：不直接修改 token，返回新值
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

	let currentSoft = runtime.fluxSoft ?? 0;
	let currentHard = runtime.fluxHard ?? 0;

	// 1. 处理排散状态清除
	if (runtime.venting) {
		result.ventingCleared = true;
	}

	// 2. 处理过载恢复时间
	if (runtime.overloaded && runtime.overloadTime > 0) {
		const newOverloadTime = runtime.overloadTime - 1;
		if (newOverloadTime <= 0) {
			result.overloadEnded = true;
		}
	}

	// 3. 护盾维持消耗：护盾开启时每回合结束产生 soft flux
	const shieldUpkeep = calculateShieldUpkeep(token);
	if (shieldUpkeep > 0) {
		const capacity = token.spec.fluxCapacity ?? 100;
		const currentTotal = currentSoft + currentHard;
		const available = capacity - currentTotal;
		
		if (available > 0) {
			const added = Math.min(shieldUpkeep, available);
			currentSoft += added;
			result.newFluxSoft = currentSoft;
			
			// 检查是否过载
			if (currentSoft + currentHard >= capacity && !runtime.overloaded) {
				result.overloadTriggered = true;
			}
		}
	}

	// 4. 处理辐能消散
	const dissipation = getFluxDissipation(token);
	const shieldActive = runtime.shield?.active ?? false;

	if (dissipation > 0) {
		// 软辐能优先消散
		if (currentSoft > 0) {
			const newSoft = Math.max(0, currentSoft - dissipation);
			if (newSoft !== currentSoft) {
				result.fluxDissipated = true;
			}
			currentSoft = newSoft;
		}

		// 护盾关闭时硬辐能也会消散
		if (!shieldActive && currentHard > 0) {
			const newHard = Math.max(0, currentHard - dissipation);
			if (newHard !== currentHard) {
				result.fluxDissipated = true;
			}
			currentHard = newHard;
		}

		result.newFluxSoft = currentSoft;
		result.newFluxHard = currentHard;
	}

	// 5. 处理武器状态转换
	if (runtime.weapons && runtime.weapons.length > 0) {
		const spec = token.spec;
		const weaponsList = runtime.weapons;
		const updatedWeapons: (WeaponRuntime | undefined)[] = weaponsList.map((w: WeaponRuntime | undefined) => {
			if (!w) return w;
			const mount = spec.mounts?.find((m: MountSpec) => m.id === w.mountId);
			const weaponSpec = mount?.weapon?.spec;
			if (weaponSpec) {
				return updateWeaponStateAtTurnEnd(w, weaponSpec);
			}
			return updateWeaponStateAtTurnEnd(w);
		});

		const hasChanges = updatedWeapons.some(
			(w: WeaponRuntime | undefined, i: number) => w && weaponsList[i] && w.state !== weaponsList[i]?.state
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