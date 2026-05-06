/**
 * 地形系统模块
 *
 * 战术地图地形的游戏效果计算。
 * 与现有移动/战斗/回合结算系统集成。
 *
 * 地形效果类型（TerrainEffect.type）：
 *   slow          减速      移动力 × value（0.5 = 半速）
 *   flux_damage   辐能伤害   每回合 +value 硬辐能
 *   shield_block  护盾禁用   护盾效率 × (1-value)
 *   vision_block  视野遮挡   射程外的目标不可选
 *   cover         掩体       被攻击命中率 × (1-value)
 *   gravity       引力       移动方向偏向圆心
 *   heal          修复       每回合恢复 value hull
 *   damage        伤害       每回合 value 结构伤害
 *
 * 集成点：
 * - validateMovement → getTerrainSlowFactor()
 * - processTokenTurnEnd → applyTerrainEffects()
 * - calculateShipWeaponTargets → getVisionBlock(), getCoverModifier()
 */

import type { CombatToken, MapTerrain, TerrainEffect, Point } from "@vt/data";
import { distanceBetween } from "@vt/data";

// ==================== 碰撞检测 ====================

/**
 * 判断点是否在地形区域内
 */
export function isPointInTerrain(point: Point, terrain: MapTerrain): boolean {
	const dist = distanceBetween(point, terrain.position);

	switch (terrain.shape ?? "circle") {
		case "circle":
			return dist <= terrain.size;
		case "ring": {
			const inner = terrain.innerSize ?? 0;
			return dist >= inner && dist <= terrain.size;
		}
		case "rect": {
			const halfSize = terrain.size / 2;
			return (
				Math.abs(point.x - terrain.position.x) <= halfSize &&
				Math.abs(point.y - terrain.position.y) <= halfSize
			);
		}
		case "polygon":
			// 暂简化为圆形检测
			return dist <= terrain.size;
		default:
			return dist <= terrain.size;
	}
}

/**
 * 判断线段是否穿过地形区域（用于移动路径检测）
 */
export function doesPathCrossTerrain(
	from: Point,
	to: Point,
	terrain: MapTerrain
): boolean {
	// 起点或终点在地形内 → 穿过
	if (isPointInTerrain(from, terrain) || isPointInTerrain(to, terrain)) return true;

	// 距形区域边界检测
	const dist = distanceBetween(from, to);
	const steps = Math.max(1, Math.ceil(dist / 20));
	for (let i = 0; i <= steps; i++) {
		const t = i / steps;
		const point: Point = {
			x: from.x + (to.x - from.x) * t,
			y: from.y + (to.y - from.y) * t,
		};
		if (isPointInTerrain(point, terrain)) return true;
	}
	return false;
}

// ==================== 效果查询 ====================

/**
 * 获取某位置的第一个匹配地形的指定效果值
 */
export function getTerrainEffectValue(
	point: Point,
	terrains: MapTerrain[],
	effectType: string
): number {
	for (const terrain of terrains) {
		if (!terrain.effects?.length) continue;
		if (!isPointInTerrain(point, terrain)) continue;
		for (const effect of terrain.effects) {
			if (effect.type === effectType) return effect.value;
		}
	}
	return 0;
}

/**
 * 获取某位置的所有地形效果
 */
export function getTerrainEffectsAt(
	point: Point,
	terrains: MapTerrain[]
): TerrainEffect[] {
	const results: TerrainEffect[] = [];
	for (const terrain of terrains) {
		if (!terrain.effects?.length) continue;
		if (!isPointInTerrain(point, terrain)) continue;
		results.push(...terrain.effects);
	}
	return results;
}

// ==================== 移动相关 ====================

/**
 * 计算移动路径上的减速倍率
 * 穿过多个地形时取最小值（最严重的减速）
 */
export function getMovementSlowFactor(
	from: Point,
	to: Point,
	terrains: MapTerrain[]
): number {
	let minFactor = 1.0;

	for (const terrain of terrains) {
		if (!doesPathCrossTerrain(from, to, terrain)) continue;
		const slowEffect = terrain.effects?.find((e) => e.type === "slow");
		if (slowEffect && slowEffect.value < minFactor) {
			minFactor = slowEffect.value;
		}
	}

	return minFactor;
}

/**
 * 检查移动路径是否被阻挡（不可通行）
 */
export function isPathBlocked(
	from: Point,
	to: Point,
	terrains: MapTerrain[]
): boolean {
	// 小行星带和空间站阻挡通行
	const blockingTypes = ["asteroid", "station"];
	for (const terrain of terrains) {
		if (!blockingTypes.includes(terrain.type)) continue;
		if (doesPathCrossTerrain(from, to, terrain)) return true;
	}
	return false;
}

// ==================== 战斗相关 ====================

/**
 * 获取攻击者到目标之间的掩体修正
 * 如果有任何"cover"地形在攻击路径上，返回最小的命中率倍率
 */
export function getCoverModifier(
	attackerPos: Point,
	targetPos: Point,
	terrains: MapTerrain[]
): number {
	let minCover = 1.0;

	for (const terrain of terrains) {
		const coverEffect = terrain.effects?.find((e) => e.type === "cover");
		if (!coverEffect) continue;
		if (!doesPathCrossTerrain(attackerPos, targetPos, terrain)) continue;
		const factor = 1 - coverEffect.value;
		if (factor < minCover) minCover = factor;
	}

	return minCover;
}

/**
 * 判断目标是否被地形遮挡（视野遮挡）
 * vision_block 地形在目标位置时，外部不可锁定
 */
export function isVisionBlocked(
	_attackerPos: Point,
	targetPos: Point,
	terrains: MapTerrain[]
): boolean {
	// 仅当目标在 vision_block 地形内时生效
	for (const terrain of terrains) {
		const visionEffect = terrain.effects?.find((e) => e.type === "vision_block");
		if (!visionEffect) continue;
		if (isPointInTerrain(targetPos, terrain)) return true;
	}
	return false;
}

// ==================== 回合结算 ====================

export interface TerrainTurnEndEffect {
	fluxDamage: number;   // 辐能伤害（硬辐能）
	hullHeal: number;     // 修复船体
	hullDamage: number;   // 结构伤害
}

/**
 * 计算单位在回合结束时受到的地形效果
 */
export function calculateTerrainTurnEndEffects(
	ship: CombatToken,
	terrains: MapTerrain[]
): TerrainTurnEndEffect {
	const result: TerrainTurnEndEffect = {
		fluxDamage: 0,
		hullHeal: 0,
		hullDamage: 0,
	};

	if (!ship.runtime?.position) return result;
	const pos = ship.runtime.position;

	for (const terrain of terrains) {
		if (!terrain.effects?.length) continue;
		if (!isPointInTerrain(pos, terrain)) continue;

		for (const effect of terrain.effects) {
			switch (effect.type) {
				case "flux_damage":
					result.fluxDamage += effect.value;
					break;
				case "heal":
					result.hullHeal += effect.value;
					break;
				case "damage":
					result.hullDamage += effect.value;
					break;
			}
		}
	}

	return result;
}

// ==================== 地形生成 ====================

/**
 * 根据地形的 TerrainProfile 生成具体的 MapTerrain 实例
 * 用于从世界观节点进入战斗时自动生成战术地图
 */
export function generateTerrainFromProfile(
	profile: { density: number; preferredTypes?: string[] | undefined; fixedFeatures?: { type: string; count: number }[] | undefined },
	mapWidth: number,
	mapHeight: number,
	_seed?: number
): MapTerrain[] {
	const terrains: MapTerrain[] = [];

	// 固定地形
	if (profile.fixedFeatures) {
		for (const feature of profile.fixedFeatures) {
			for (let i = 0; i < feature.count; i++) {
				terrains.push({
					id: `${feature.type}_${i}`,
					type: feature.type as any,
					position: {
						x: (Math.random() - 0.5) * mapWidth * 0.6,
						y: (Math.random() - 0.5) * mapHeight * 0.6,
					},
					size: 100 + Math.random() * 200,
					shape: "circle",
				});
			}
		}
	}

	// 随机地形
	const count = Math.round(profile.density * 8);
	const typePool = profile.preferredTypes?.length
		? profile.preferredTypes
		: ["asteroid", "nebula", "debris"];

	for (let i = 0; i < count; i++) {
		const type = typePool[Math.floor(Math.random() * typePool.length)];
		terrains.push({
			id: `terrain_${type}_${i}`,
			type: type as any,
			position: {
				x: (Math.random() - 0.5) * mapWidth * 0.8,
				y: (Math.random() - 0.5) * mapHeight * 0.8,
			},
			size: 80 + Math.random() * 180,
			shape: "circle",
		});
	}

	return terrains;
}
