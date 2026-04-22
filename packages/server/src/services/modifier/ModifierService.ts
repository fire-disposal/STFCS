/**
 * ModifierService - 修正器服务
 *
 * 管理舰船修正器（BUFF/减益）的定义和应用
 */

import type { TokenModifier, TokenRuntime } from "@vt/data";

export type ModifierType =
	| "RANGE"
	| "DAMAGE"
	| "ARMOR"
	| "SHIELD"
	| "SPEED"
	| "TURN_RATE"
	| "FLUX_CAPACITY"
	| "FLUX_DISSIPATION"
	| "ACCURACY"
	| "COOLDOWN";

export type ModifierTarget =
	| "ALL"
	| "FACTION"
	| "PLAYER"
	| "SHIP_CLASS"
	| "SHIP_SIZE"
	| "WEAPON_TYPE";

export interface ModifierDef {
	id: string;
	name: string;
	description?: string;
	scope: { target: ModifierTarget; targetId?: string };
	effects: { type: ModifierType; value: number; isMultiplicative: boolean }[];
	duration?: number;
	stackable: boolean;
	maxStacks?: number;
	priority: number;
}

export interface ActiveModifier {
	modifierId: string;
	scope: { target: ModifierTarget; targetId?: string };
	effects: { type: ModifierType; value: number; isMultiplicative: boolean }[];
	appliedAt: number;
	expiresAt?: number;
	stacks: number;
	source?: string;
}

const DEFAULT_MODIFIERS: ModifierDef[] = [
	{
		id: "range_penalty_far",
		name: "远距离惩罚",
		description: "远距离射击精度下降",
		scope: { target: "ALL" },
		effects: [{ type: "ACCURACY", value: -0.3, isMultiplicative: true }],
		stackable: true,
		priority: 10,
	},
	{
		id: "range_bonus_near",
		name: "近距离奖励",
		description: "近距离射击精度提升",
		scope: { target: "ALL" },
		effects: [{ type: "ACCURACY", value: 0.2, isMultiplicative: true }],
		stackable: true,
		priority: 10,
	},
	{
		id: "overload_penalty",
		name: "过载惩罚",
		description: "舰船过载时所有系统效率下降",
		scope: { target: "ALL" },
		effects: [
			{ type: "SPEED", value: -0.5, isMultiplicative: true },
			{ type: "TURN_RATE", value: -0.5, isMultiplicative: true },
			{ type: "ACCURACY", value: -0.7, isMultiplicative: true },
		],
		stackable: false,
		priority: 100,
	},
];

export class ModifierService {
	private modifiers = new Map<string, ModifierDef>();
	private activeModifiers = new Map<string, ActiveModifier[]>();

	constructor() {
		for (const mod of DEFAULT_MODIFIERS) {
			this.modifiers.set(mod.id, mod);
		}
	}

	getModifierById(id: string): ModifierDef | null {
		return this.modifiers.get(id) ?? null;
	}

	getAllModifiers(): ModifierDef[] {
		return Array.from(this.modifiers.values());
	}

	getModifiersByType(type: ModifierType): ModifierDef[] {
		return this.getAllModifiers().filter((m) =>
			m.effects.some((e) => e.type === type)
		);
	}

	applyModifier(targetId: string, modifierId: string, source?: string): boolean {
		const modifier = this.getModifierById(modifierId);
		if (!modifier) return false;

		const activeMods = this.activeModifiers.get(targetId) ?? [];
		const existingIndex = activeMods.findIndex((m) => m.modifierId === modifierId);

		if (existingIndex >= 0) {
			const existing = activeMods[existingIndex]!;
			if (modifier.stackable) {
				const maxStacks = modifier.maxStacks ?? 1;
				if (existing.stacks < maxStacks) {
					existing.stacks++;
					if (modifier.duration) {
						existing.expiresAt = Date.now() + modifier.duration * 1000;
					}
					return true;
				}
				return false;
			}
			activeMods[existingIndex] = this.createActiveModifier(modifier, source);
			this.activeModifiers.set(targetId, activeMods);
			return true;
		}

		const activeMod = this.createActiveModifier(modifier, source);
		activeMods.push(activeMod);
		activeMods.sort((a, b) => {
			const modA = this.getModifierById(a.modifierId)!;
			const modB = this.getModifierById(b.modifierId)!;
			return modB.priority - modA.priority;
		});
		this.activeModifiers.set(targetId, activeMods);
		return true;
	}

	private createActiveModifier(modifier: ModifierDef, source?: string): ActiveModifier {
		const now = Date.now();
		const result: ActiveModifier = {
			modifierId: modifier.id,
			scope: modifier.scope,
			effects: modifier.effects,
			appliedAt: now,
			stacks: 1,
		};
		if (modifier.duration) {
			result.expiresAt = now + modifier.duration * 1000;
		}
		if (source) {
			result.source = source;
		}
		return result;
	}

	removeModifier(targetId: string, modifierId: string): boolean {
		const activeMods = this.activeModifiers.get(targetId);
		if (!activeMods) return false;

		const filtered = activeMods.filter((m) => m.modifierId !== modifierId);
		if (filtered.length < activeMods.length) {
			this.activeModifiers.set(targetId, filtered);
			return true;
		}
		return false;
	}

	clearAllModifiers(targetId: string): void {
		this.activeModifiers.delete(targetId);
	}

	getTargetModifiers(targetId: string): ActiveModifier[] {
		return this.activeModifiers.get(targetId) ?? [];
	}

	calculateModifiedValue(
		baseValue: number,
		targetId: string,
		modifierType: ModifierType
	): number {
		const modifiers = this.getTargetModifiers(targetId);
		let result = baseValue;

		for (const activeMod of modifiers) {
			for (const effect of activeMod.effects) {
				if (effect.type === modifierType && !effect.isMultiplicative) {
					result += baseValue * effect.value * activeMod.stacks;
				}
			}
		}

		for (const activeMod of modifiers) {
			for (const effect of activeMod.effects) {
				if (effect.type === modifierType && effect.isMultiplicative) {
					result *= 1 + effect.value * activeMod.stacks;
				}
			}
		}

		return result;
	}

	cleanupExpiredModifiers(): void {
		const now = Date.now();
		for (const [targetId, activeMods] of this.activeModifiers.entries()) {
			const validMods = activeMods.filter((m) => !m.expiresAt || m.expiresAt > now);
			if (validMods.length === 0) {
				this.activeModifiers.delete(targetId);
			} else if (validMods.length < activeMods.length) {
				this.activeModifiers.set(targetId, validMods);
			}
		}
	}

	applyToTokenRuntime(runtime: TokenRuntime, modifier: TokenModifier): TokenRuntime {
		const updatedRuntime = { ...runtime };
		const modifiers = updatedRuntime.modifiers ?? [];

		const existingIndex = modifiers.findIndex((m) =>
			m.stackKey === modifier.stackKey && !modifier.stacks
		);

		if (existingIndex >= 0 && !modifier.stacks) {
			modifiers[existingIndex] = modifier;
		} else {
			modifiers.push(modifier);
		}

		updatedRuntime.modifiers = modifiers;
		return updatedRuntime;
	}

	addModifier(modifier: ModifierDef): void {
		this.modifiers.set(modifier.id, modifier);
	}
}

export const modifierService = new ModifierService();