/**
 * 修正模块（基于 ShipModifier 数据驱动）
 *
 * 设计原则：
 * 1. 所有修正存储在 ShipRuntime.modifiers[] 数组中
 * 2. 修正类型由 stat + operation + value 定义，无 hard-coded switch
 * 3. 支持叠加（stacks=true）和覆盖（stacks=false + stackKey）
 * 4. 支持持续回合数（duration），undefined = 永久
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createStatusEffectEvent } from "../context.js";
import type { ShipModifier, ShipRuntime } from "@vt/data";

// ============================================================
// 核心 API：添加/移除/查询修正
// ============================================================

/** 向舰船添加修正 */
export function addModifier(
	runtime: ShipRuntime,
	modifier: ShipModifier
): { added: boolean; replaced?: boolean } {
	if (!runtime.modifiers) {
		runtime.modifiers = [];
	}

	if (!modifier.stacks && modifier.stackKey) {
		// 不可叠加：查找同 stackKey 的修正并替换
		const existingIndex = runtime.modifiers.findIndex(
			(m) => m.stackKey === modifier.stackKey
		);
		if (existingIndex >= 0) {
			runtime.modifiers[existingIndex] = modifier;
			return { added: true, replaced: true };
		}
	}

	runtime.modifiers.push(modifier);
	return { added: true };
}

/** 从舰船移除修正 */
export function removeModifier(
	runtime: ShipRuntime,
	modifierId: string
): boolean {
	if (!runtime.modifiers) return false;
	const initialLength = runtime.modifiers.length;
	runtime.modifiers = runtime.modifiers.filter((m) => m.id !== modifierId);
	return runtime.modifiers.length < initialLength;
}

/** 按 stat 获取所有相关修正 */
export function getModifiersByStat(
	runtime: ShipRuntime,
	stat: ShipModifier["stat"]
): ShipModifier[] {
	return runtime.modifiers?.filter((m) => m.stat === stat) ?? [];
}

// ============================================================
// 核心 API：计算修正后属性值
// ============================================================

/** 计算修正后的属性值 */
export function calculateModifiedValue(
	baseValue: number,
	runtime: ShipRuntime,
	stat: ShipModifier["stat"]
): number {
	const modifiers = getModifiersByStat(runtime, stat);
	if (modifiers.length === 0) return baseValue;

	// 分离乘性和加性修正
	const multipliers = modifiers.filter((m) => m.operation === "multiply");
	const additives = modifiers.filter((m) => m.operation === "add");

	// 乘性修正：累乘
	let result = baseValue;
	for (const m of multipliers) {
		result *= m.value;
	}

	// 加性修正：累加
	for (const m of additives) {
		result += m.value;
	}

	return result;
}

/** 批量计算多个属性的修正值 */
export function calculateModifiedValues(
	baseValues: Record<ShipModifier["stat"], number>,
	runtime: ShipRuntime
): Record<ShipModifier["stat"], number> {
	const result = { ...baseValues };
	for (const stat of Object.keys(baseValues) as ShipModifier["stat"][]) {
		result[stat] = calculateModifiedValue(baseValues[stat]!, runtime, stat);
	}
	return result;
}

// ============================================================
// 回合更新：处理持续时间
// ============================================================

/** 更新所有舰船的修正持续时间（每回合调用） */
export function updateModifiers(state: any): {
	shipUpdates: Map<string, any>;
	expiredModifiers: Map<string, ShipModifier[]>;
} {
	const shipUpdates = new Map<string, any>();
	const expiredModifiers = new Map<string, ShipModifier[]>();

	for (const [shipId, ship] of state.tokens.entries()) {
		if (!ship.runtime?.modifiers || ship.runtime.modifiers.length === 0) {
			continue;
		}

		const runtime: ShipRuntime = { ...ship.runtime };
		const expired: ShipModifier[] = [];
		const remaining: ShipModifier[] = [];

		for (const modifier of runtime.modifiers!) {
			if (modifier.duration !== undefined) {
				modifier.duration--;
				if (modifier.duration <= 0) {
					expired.push(modifier);
					continue;
				}
			}
			remaining.push(modifier);
		}

		if (expired.length > 0) {
			runtime.modifiers = remaining;
			shipUpdates.set(shipId, { runtime });
			expiredModifiers.set(shipId, expired);
		} else {
			// duration 减少但未过期，也需更新
			runtime.modifiers = remaining;
			shipUpdates.set(shipId, { runtime });
		}
	}

	return { shipUpdates, expiredModifiers };
}

// ============================================================
// Engine Action 处理
// ============================================================

/** 应用修正 Action */
export function applyModifier(context: EngineContext): { newState: any; events: any[] } {
	const { state, action } = context;
	const payload = action.payload as any;

	const events = [];
	const updates = new Map<string, any>();

	if (action.type === "APPLY_MODIFIER") {
		const result = processModifierApplication(state, payload);

		for (const [shipId, shipUpdate] of result.shipUpdates.entries()) {
			updates.set(`ship:${shipId}`, shipUpdate);
			if (result.modifierChanges.has(shipId)) {
				const change = result.modifierChanges.get(shipId)!;
				events.push(
					createStatusEffectEvent(
						shipId,
						change.modifierId,
						change.stat,
						change.action,
						change.duration
					)
				);
			}
		}
	}

	const newState = applyStateUpdates(state, updates);
	return { newState, events };
}

function processModifierApplication(state: any, payload: any) {
	const shipUpdates = new Map<string, any>();
	const modifierChanges = new Map<
		string,
		{ modifierId: string; stat: string; action: "APPLIED" | "UPDATED"; duration?: number }
	>();

	const { targetType, targetId, faction, modifier } = payload;
	const targetShips = getTargetShips(state, targetType, targetId, faction);

	for (const ship of targetShips) {
		const runtime: ShipRuntime = { ...ship.runtime };

		const shipModifier: ShipModifier = {
			id: modifier.id || `mod_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
			source: modifier.source || payload.sourceId || "system",
			stat: modifier.stat,
			value: modifier.value,
			operation: modifier.operation || "multiply",
			stacks: modifier.stacks ?? false,
			stackKey: modifier.stackKey,
			duration: modifier.duration,
			metadata: modifier.metadata,
		};

		const result = addModifier(runtime, shipModifier);

		modifierChanges.set(ship.id, {
			modifierId: shipModifier.id,
			stat: shipModifier.stat,
			action: result.replaced ? "UPDATED" : "APPLIED",
			duration: shipModifier.duration,
		});

		shipUpdates.set(ship.id, { runtime });
	}

	return { shipUpdates, modifierChanges };
}

function getTargetShips(state: any, targetType: string, targetId?: string, _faction?: string): any[] {
	const ships = Array.from(state.tokens.values());

	switch (targetType) {
		case "SHIP": {
			const ship = targetId ? state.tokens.get(targetId) : undefined;
			return ship ? [ship] : [];
		}
		case "FACTION":
			return ships.filter((ship: any) => ship.runtime?.faction === _faction);
		case "ALL":
			return ships;
		default:
			return [];
	}
}

/** 检查修正应用合法性 */
export function validateModifierApplication(
	state: any,
	playerId: string,
	payload: any
): { valid: boolean; error?: string } {
	const player = state.players.get(playerId);

	if (!player) {
		return { valid: false, error: "Player not found" };
	}

	// 检查权限（简化：只有 DM 可以应用全局修正）
	if (payload.targetType === "ALL" || payload.targetType === "FACTION") {
		if (player.role !== "OWNER") {
			return { valid: false, error: "Only DM can apply global modifiers" };
		}
	}

	// 检查目标是否存在
	if (payload.targetType === "SHIP" && payload.targetId) {
		const targetShip = state.tokens.get(payload.targetId);
		if (!targetShip) {
			return { valid: false, error: "Target ship not found" };
		}
	}

	// 检查修正数据
	if (!payload.modifier || !payload.modifier.stat) {
		return { valid: false, error: "Invalid modifier data: missing stat" };
	}
	if (payload.modifier.value === undefined) {
		return { valid: false, error: "Invalid modifier data: missing value" };
	}

	return { valid: true };
}
