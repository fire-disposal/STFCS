/**
 * 战斗日志格式化
 *
 * 输出彩色算式说明，清晰向玩家展示伤害计算过程
 */

import type { DamageTypeValue } from "@vt/data";
import type { DamageResult } from "./damage.js";

/**
 * ANSI 颜色代码
 */
export const Colors = {
	reset: "\x1b[0m",
	bold: "\x1b[1m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
	white: "\x1b[37m",
	dim: "\x1b[2m",
};

/**
 * 伤害类型颜色映射
 */
export const DamageTypeColors: Record<DamageTypeValue, string> = {
	KINETIC: Colors.cyan,
	HIGH_EXPLOSIVE: Colors.red,
	ENERGY: Colors.yellow,
	FRAGMENTATION: Colors.dim,
};

/**
 * 伤害类型名称映射
 */
export const DamageTypeNames: Record<DamageTypeValue, string> = {
	KINETIC: "动能",
	HIGH_EXPLOSIVE: "高爆",
	ENERGY: "能量",
	FRAGMENTATION: "破片",
};

/**
 * 象限名称映射
 */
export const QuadrantNames = ["右前(RF)", "右后(RR)", "右后背(RB)", "左后背(LB)", "左后(LL)", "左前(LF)"];

/**
 * 格式化护盾阶段日志
 */
export function formatShieldPhaseLog(
	baseDamage: number,
	shieldMultiplier: number,
	shieldDamage: number,
	efficiency: number,
	fluxGenerated: number,
	targetName: string
): string {
	const lines: string[] = [];

	lines.push(`${Colors.cyan}${Colors.bold}[护盾阶段]${Colors.reset}`);
	lines.push(
		`  ${Colors.white}对护盾伤害${Colors.reset} = ${Colors.blue}${baseDamage.toFixed(1)}${Colors.reset} × ${Colors.magenta}shieldMultiplier(${shieldMultiplier.toFixed(2)})${Colors.reset} = ${Colors.green}${shieldDamage.toFixed(1)}${Colors.reset}`
	);
	lines.push(
		`  ${Colors.white}硬辐能${Colors.reset} = ${Colors.blue}${shieldDamage.toFixed(1)}${Colors.reset} × ${Colors.magenta}护盾效率(${efficiency.toFixed(2)})${Colors.reset} = ${Colors.red}${fluxGenerated.toFixed(1)}${Colors.reset}`
	);
	lines.push(
		`  ${Colors.yellow}→ ${targetName}护盾吸收攻击，产生 ${Colors.red}${fluxGenerated.toFixed(1)}${Colors.yellow} 硬辐能${Colors.reset}`
	);

	return lines.join("\n");
}

/**
 * 格式化护甲阶段日志
 */
export function formatArmorPhaseLog(
	baseDamage: number,
	penetrationMultiplier: number,
	penetration: number,
	currentArmor: number,
	maxArmor: number,
	minReduction: number,
	effectiveArmor: number,
	hullDamage: number,
	armorDamage: number,
	quadrant: number,
	damageReductionRatio: number,
	maxReduction: number,
	appliedMaxReductionCap: boolean,
	targetName: string
): string {
	const lines: string[] = [];
	const quadrantName = QuadrantNames[quadrant] || `象限${quadrant}`;

	lines.push(`${Colors.magenta}${Colors.bold}[护甲阶段]${Colors.reset}`);
	lines.push(
		`  ${Colors.white}穿甲强度 Z${Colors.reset} = ${Colors.blue}${baseDamage.toFixed(1)}${Colors.reset} × ${Colors.magenta}penetrationMultiplier(${penetrationMultiplier.toFixed(2)})${Colors.reset} = ${Colors.green}${penetration.toFixed(1)}${Colors.reset}`
	);
	lines.push(
		`  ${Colors.white}计算护甲值 C${Colors.reset} = max(${Colors.blue}${currentArmor.toFixed(1)}${Colors.reset}, ${Colors.blue}${maxArmor.toFixed(1)}${Colors.reset} × ${Colors.magenta}minReduction(${minReduction.toFixed(2)})${Colors.reset}) = ${Colors.green}${effectiveArmor.toFixed(1)}${Colors.reset}`
	);

	const formulaHullDamage = (baseDamage * penetration) / (penetration + effectiveArmor);
	lines.push(
		`  ${Colors.white}船体伤害 D${Colors.reset} = ${Colors.blue}${baseDamage.toFixed(1)}${Colors.reset} × ${Colors.green}${penetration.toFixed(1)}${Colors.reset} ÷ (${Colors.green}${penetration.toFixed(1)}${Colors.reset} + ${Colors.green}${effectiveArmor.toFixed(1)}${Colors.reset}) = ${Colors.yellow}${formulaHullDamage.toFixed(1)}${Colors.reset}`
	);

	if (appliedMaxReductionCap) {
		lines.push(
			`  ${Colors.red}${Colors.bold}最大护甲减伤比限制${Colors.reset}：减伤比 ${Colors.yellow}${(damageReductionRatio * 100).toFixed(1)}%${Colors.reset} > ${Colors.magenta}${(maxReduction * 100).toFixed(1)}%${Colors.reset}`
		);
		lines.push(
			`  ${Colors.white}修正后船体伤害${Colors.reset} = ${Colors.blue}${baseDamage.toFixed(1)}${Colors.reset} × (1 - ${Colors.magenta}${maxReduction.toFixed(2)}${Colors.reset}) = ${Colors.red}${hullDamage.toFixed(1)}${Colors.reset}`
		);
	}

	lines.push(
		`  ${Colors.white}护甲剥落${Colors.reset} = ${Colors.green}${armorDamage.toFixed(1)}${Colors.reset}`
	);
	lines.push(
		`  ${Colors.yellow}→ ${targetName}${quadrantName}护甲剥落 ${Colors.green}${armorDamage.toFixed(1)}${Colors.yellow}，船体伤害 ${Colors.red}${hullDamage.toFixed(1)}${Colors.reset}`
	);

	return lines.join("\n");
}

/**
 * 格式化完整战斗日志
 */
export function formatBattleLog(
	attackerName: string,
	targetName: string,
	weaponDisplayName: string,
	damageType: DamageTypeValue,
	baseDamage: number,
	damageResult: DamageResult,
	shieldMultiplier: number,
	penetrationMultiplier: number,
	targetArmorSpec: {
		currentArmor: number;
		maxArmor: number;
		minReduction: number;
		maxReduction: number;
	},
	targetShieldSpec?: {
		efficiency: number;
	}
): string {
	const lines: string[] = [];
	const typeColor = DamageTypeColors[damageType] || Colors.white;
	const typeName = DamageTypeNames[damageType] || damageType;

	lines.push(`${Colors.bold}${Colors.blue}========== 战斗日志 ==========${Colors.reset}`);
	lines.push(
		`${Colors.white}${attackerName}${Colors.reset} 使用 ${Colors.cyan}${weaponDisplayName}${Colors.reset} (${typeColor}${typeName}${Colors.reset}) 攻击 ${Colors.white}${targetName}${Colors.reset}`
	);
	lines.push(`${Colors.white}基础伤害${Colors.reset}: ${Colors.blue}${baseDamage.toFixed(1)}${Colors.reset}`);
	lines.push("");

	if (damageResult.shieldHit && targetShieldSpec) {
		const shieldDamage = baseDamage * shieldMultiplier;
		lines.push(
			formatShieldPhaseLog(
				baseDamage,
				shieldMultiplier,
				shieldDamage,
				targetShieldSpec.efficiency,
				damageResult.fluxGenerated,
				targetName
			)
		);
		lines.push("");
	}

	if (damageResult.armorHit) {
		const penetration = baseDamage * penetrationMultiplier;
		const currentArmor = targetArmorSpec.currentArmor;
		const maxArmor = targetArmorSpec.maxArmor;
		const minReduction = targetArmorSpec.minReduction;
		const maxReduction = targetArmorSpec.maxReduction;
		const effectiveArmor = Math.max(currentArmor, maxArmor * minReduction);

		let formulaHullDamage = (baseDamage * penetration) / (penetration + effectiveArmor);
		const damageReductionRatio = (baseDamage - formulaHullDamage) / baseDamage;
		const appliedMaxReductionCap = damageReductionRatio > maxReduction;

		lines.push(
			formatArmorPhaseLog(
				baseDamage,
				penetrationMultiplier,
				penetration,
				currentArmor,
				maxArmor,
				minReduction,
				effectiveArmor,
				damageResult.hullDamage,
				damageResult.armorDamage,
				damageResult.armorQuadrant,
				damageReductionRatio,
				maxReduction,
				appliedMaxReductionCap,
				targetName
			)
		);
		lines.push("");
	}

	if (damageResult.targetDestroyed) {
		lines.push(`${Colors.red}${Colors.bold}★ ${targetName} 被摧毁！${Colors.reset}`);
	} else if (damageResult.targetOverloaded) {
		lines.push(`${Colors.yellow}${Colors.bold}★ ${targetName} 过载！${Colors.reset}`);
	}

	lines.push(`${Colors.bold}${Colors.blue}==============================${Colors.reset}`);

	return lines.join("\n");
}

/**
 * 简化战斗日志（用于终端输出）
 */
export function formatSimpleBattleLog(
	attackerName: string,
	targetName: string,
	_damageType: DamageTypeValue,
	damageResult: DamageResult
): string {
	const typeColor = DamageTypeColors[_damageType] || Colors.white;
	const typeName = DamageTypeNames[_damageType] || _damageType;

	let result = `${Colors.cyan}${attackerName}${Colors.reset} → ${Colors.white}${targetName}${Colors.reset} [${typeColor}${typeName}${Colors.reset}]`;

	if (damageResult.shieldHit) {
		result += ` 护盾(${Colors.red}${damageResult.fluxGenerated.toFixed(1)}辐能${Colors.reset})`;
	}
	if (damageResult.armorHit) {
		const quadrantName = QuadrantNames[damageResult.armorQuadrant] || `象限${damageResult.armorQuadrant}`;
		result += ` ${Colors.magenta}${quadrantName}${Colors.reset}护甲-${damageResult.armorDamage.toFixed(1)}`;
	}
	if (damageResult.hullDamage > 0) {
		result += ` 船体-${Colors.red}${damageResult.hullDamage.toFixed(1)}${Colors.reset}`;
	}
	if (damageResult.targetDestroyed) {
		result += ` ${Colors.red}${Colors.bold}[摧毁]${Colors.reset}`;
	} else if (damageResult.targetOverloaded) {
		result += ` ${Colors.yellow}[过载]${Colors.reset}`;
	}

	return result;
}