/**
 * 修正模块（基于 TokenModifier 数据驱动）
 *
 * 设计原则：
 * 1. 所有修正存储在 TokenRuntime.modifiers[] 数组中
 * 2. 修正类型由 stat + operation + value 定义，无 hard-coded switch
 * 3. 支持叠加（stacks=true）和覆盖（stacks=false + stackKey）
 * 4. 支持持续回合数（duration），undefined = 永久
 */

import type { TokenModifier, TokenRuntime } from "@vt/data";

// ============================================================
// 核心 API：添加/移除/查询修正
// ============================================================

/** 向舰船添加修正 */
export function addModifier(
	runtime: TokenRuntime,
	modifier: TokenModifier
): { added: boolean; replaced: boolean } {
	if (!runtime.modifiers) {
		runtime.modifiers = [];
	}

	// 如果不叠加且已有同 stackKey 的修正，覆盖之
	if (!modifier.stacks && modifier.stackKey) {
		const existingIndex = runtime.modifiers.findIndex(
			(m) => m.stackKey === modifier.stackKey
		);
		if (existingIndex !== -1) {
			runtime.modifiers[existingIndex] = modifier;
			return { added: true, replaced: true };
		}
	}

	runtime.modifiers.push(modifier);
	return { added: true, replaced: false };
}

/** 从舰船移除修正（按 id） */
export function removeModifier(
	runtime: TokenRuntime,
	modifierId: string
): boolean {
	if (!runtime.modifiers) return false;

	const index = runtime.modifiers.findIndex((m) => m.id === modifierId);
	if (index === -1) return false;

	runtime.modifiers.splice(index, 1);
	return true;
}

/** 获取某个属性的所有修正 */
export function getModifiersByStat(
	runtime: TokenRuntime,
	stat: TokenModifier["stat"]
): TokenModifier[] {
	if (!runtime.modifiers) return [];
	return runtime.modifiers.filter((m) => m.stat === stat);
}

/** 计算修正后的属性值 */
export function calculateModifiedValue(
	baseValue: number,
	runtime: TokenRuntime,
	stat: TokenModifier["stat"]
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
	baseValues: Record<TokenModifier["stat"], number>,
	runtime: TokenRuntime
): Record<TokenModifier["stat"], number> {
	const result = { ...baseValues };
	for (const stat of Object.keys(baseValues) as TokenModifier["stat"][]) {
		result[stat] = calculateModifiedValue(baseValues[stat]!, runtime, stat);
	}
	return result;
}
