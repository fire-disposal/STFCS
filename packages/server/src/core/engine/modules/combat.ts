/**
 * 战斗模块
 *
 * 纯计算层：接受 EngineContext，返回 EngineResult（更新指令列表）。
 * 支持多武器多目标分配（allocations），与 handlers.ts 的 attack handler 对齐。
 *
 * 同一 combat action 内多门武器攻击同一目标时，使用 localTargetState
 * 跟踪累积伤害（护甲递减、辐能累积、摧毁阻断），防止状态快照导致的重复伤害。
 *
 * applyCombat 与 applyDeviation 共享武器迭代 + 攻击者过载结算逻辑，
 * 通过 parseAllocations / finalizeAttackerOverload 消除重复。
 *
 * 基于 @vt/data GameRoomState（Record-based）
 * 数值约定：所有终端数值四舍五入为整数
 */

import type { EngineContext, EngineResult, TokenRuntimeUpdate } from "../context.js";
import { createEngineEvent } from "../context.js";
import { calculateWeaponAttack } from "../rules/weapon.js";
import { calculateDamage } from "../rules/damage.js";
import { calculateModifiedValue } from "./modifier.js";
import { angleBetween, distanceBetween } from "@vt/data";

export interface WeaponAllocation {
	mountId: string;
	targets: { targetId: string; shotCount: number; quadrant?: number }[];
}

/** 单次 combat action 内跟踪的本地目标状态 */
interface LocalTargetState {
	hull: number;
	armor: number[];
	fluxHard: number;
	fluxSoft: number;
	overloaded: boolean;
	destroyed: boolean;
	shieldActive: boolean;
	shieldDirection: number;
}

// ==================== 共享工具函数 ====================

/**
 * 解析 allocation payload 为 WeaponAllocation[]
 */
function parseAllocations(payload: Record<string, unknown>): WeaponAllocation[] {
	const rawAllocations = payload["allocations"] as Array<Record<string, unknown>> | undefined;
	if (!rawAllocations) return [];
	return rawAllocations.map((alloc) => {
		const rawTargets = alloc["targets"] as Array<Record<string, unknown>> | undefined;
		return {
			mountId: alloc["mountId"] as string,
			targets: (rawTargets ?? []).map((t) => {
				const entry: { targetId: string; shotCount: number; quadrant?: number } = {
					targetId: t["targetId"] as string,
					shotCount: (t["shotCount"] ?? t["shots"] ?? 1) as number,
				};
				const q = t["quadrant"];
				if (q !== undefined) entry.quadrant = q as number;
				return entry;
			}),
		};
	});
}

/**
 * 最终化攻击者过载状态（applyCombat / applyDeviation 共享）
 */
function finalizeAttackerOverload(
	ship: { [key: string]: unknown },
	totalFluxCost: number,
	updatedWeapons: { state: string; [key: string]: unknown }[],
	events: ReturnType<typeof createEngineEvent>[]
): Record<string, unknown> {
	const runtime = ship["runtime"] as { [key: string]: unknown } | undefined;
	const spec = ship["spec"] as { [key: string]: unknown } | undefined;
	const metadata = ship["metadata"] as { [key: string]: unknown } | undefined;
	const shipId = ship["$id"] as string;

	const fluxSoft = (runtime?.["fluxSoft"] as number) ?? 0;
	const fluxHard = (runtime?.["fluxHard"] as number) ?? 0;
	const capacity = Math.round((spec?.["fluxCapacity"] as number) ?? 0);
	const newFluxSoft = Math.round(fluxSoft + totalFluxCost);
	const newTotalFlux = newFluxSoft + Math.round(fluxHard);
	const overloaded = newTotalFlux >= capacity && !(runtime?.["overloaded"] as boolean);

	const attackerUpdates: Record<string, unknown> = {
		fluxSoft: newFluxSoft,
		weapons: updatedWeapons,
	};

	if (overloaded) {
		attackerUpdates["overloaded"] = true;
		attackerUpdates["overloadTime"] = 1;
		const shield = runtime?.["shield"] as { active?: boolean; direction?: number } | undefined;
		if (shield) {
			attackerUpdates["shield"] = { active: false, direction: shield.direction ?? 0 };
		}
		attackerUpdates["weapons"] = updatedWeapons.map((w) => ({
			...w,
			state: w.state === "READY" || w.state === "COOLDOWN" ? "DISABLED" : w.state,
		}));

		events.push(
			createEngineEvent("overload", shipId, {
				tokenId: shipId,
				tokenName: (metadata?.["name"] as string) ?? shipId,
				totalFlux: newTotalFlux,
				fluxCapacity: capacity,
				reason: "weapon_fire",
			})
		);
	}

	return attackerUpdates;
}

/**
 * 初始化或获取本地目标跟踪状态
 */
function initLocalState(
	localState: Map<string, LocalTargetState>,
	targetId: string,
	runtime: { [key: string]: unknown } | undefined
): LocalTargetState | undefined {
	let st = localState.get(targetId);
	if (!st && runtime) {
		const shield = runtime["shield"] as { active?: boolean; direction?: number } | undefined;
		st = {
			hull: (runtime["hull"] as number) ?? 0,
			armor: [...((runtime["armor"] as number[]) ?? [0, 0, 0, 0, 0, 0])],
			fluxHard: (runtime["fluxHard"] as number) ?? 0,
			fluxSoft: (runtime["fluxSoft"] as number) ?? 0,
			overloaded: (runtime["overloaded"] as boolean) ?? false,
			destroyed: (runtime["destroyed"] as boolean) ?? false,
			shieldActive: shield?.active ?? false,
			shieldDirection: shield?.direction ?? 0,
		};
		localState.set(targetId, st);
	}
	return st;
}

/**
 * 从本地状态生成最终的 runtimeUpdates（含过载展开）
 */
function finalizeLocalStates(
	localState: Map<string, LocalTargetState>,
	tokens: Record<string, { [key: string]: unknown }>
): TokenRuntimeUpdate[] {
	const updates: TokenRuntimeUpdate[] = [];
	for (const [targetId, st] of localState) {
		const token = tokens[targetId] as { [key: string]: unknown } | undefined;
		const tokenRuntime = token?.["runtime"] as { [key: string]: unknown } | undefined;
		const targetUpdates: Record<string, unknown> = {
			hull: st.hull,
			armor: st.armor,
			fluxHard: st.fluxHard,
			destroyed: st.destroyed,
			overloaded: st.overloaded,
		};

		if (st.overloaded) {
			targetUpdates["overloadTime"] = 1;
			const shield = tokenRuntime?.["shield"] as
				| { active?: boolean; direction?: number }
				| undefined;
			if (shield) {
				targetUpdates["shield"] = { active: false, direction: shield.direction ?? 0 };
			}
			const weapons = tokenRuntime?.["weapons"] as
				| Array<{ state: string; [key: string]: unknown }>
				| undefined;
			if (weapons) {
				targetUpdates["weapons"] = weapons.map((w) => ({
					...w,
					state: w.state === "READY" || w.state === "COOLDOWN" ? "DISABLED" : w.state,
				}));
			}
		}

		updates.push({ tokenId: targetId, updates: targetUpdates });
	}
	return updates;
}

// ==================== applyCombat（实弹攻击） ====================

export function applyCombat(context: EngineContext): EngineResult {
	const { state, ship } = context;
	const payload = context.payload as Record<string, unknown>;

	if (!ship) return { runtimeUpdates: [], events: [] };

	const runtimeUpdates: TokenRuntimeUpdate[] = [];
	const events: ReturnType<typeof createEngineEvent>[] = [];

	const allocations = parseAllocations(payload);
	if (allocations.length === 0) return { runtimeUpdates, events };

	const attackerSpec = ship.spec;
	const attackerRuntime = ship.runtime;
	const attackerPos = attackerRuntime.position ?? { x: 0, y: 0 };
	let totalFluxCost = 0;
	const updatedWeapons = attackerRuntime.weapons ? [...attackerRuntime.weapons] : [];

	// 本地目标状态跟踪：同一 action 内累积伤害
	const localState = new Map<string, LocalTargetState>();

	for (const alloc of allocations) {
		const mount = attackerSpec.mounts?.find((m) => m.id === alloc.mountId);
		const weaponIdx = updatedWeapons.findIndex((w) => w.mountId === alloc.mountId);
		if (weaponIdx === -1 || !mount) continue;
		const weaponRuntime = updatedWeapons[weaponIdx];
		if (!weaponRuntime) continue;
		const weaponSpec = mount.weapon?.spec;
		if (!weaponSpec) continue;
		// 服务端武器就绪状态验证
		if (weaponRuntime.state !== "READY") continue;

		let lastHitTargetPos = attackerPos;

		for (const target of alloc.targets) {
			const targetToken = state.tokens[target.targetId];
			if (!targetToken) continue;

			// 初始化或获取本地目标状态
			const st = initLocalState(
				localState,
				target.targetId,
				targetToken.runtime as { [key: string]: unknown }
			);
			if (!st) continue;

			// 跳过已在本 action 中被摧毁的目标
			if (st.destroyed) continue;

			const targetSpec = targetToken.spec;
			const targetPos = targetToken.runtime?.position ?? { x: 0, y: 0 };

			// 用本地状态构造临时 runtime
			const localRuntime = {
				...targetToken.runtime,
				hull: st.hull,
				armor: st.armor,
				fluxHard: st.fluxHard,
				fluxSoft: st.fluxSoft,
				overloaded: st.overloaded,
				destroyed: st.destroyed,
				shield: st.shieldActive ? { active: true, direction: st.shieldDirection } : undefined,
			};

			const attackResult = calculateWeaponAttack(
				weaponSpec,
				weaponRuntime,
				attackerSpec,
				attackerRuntime,
				targetSpec,
				localRuntime,
				attackerPos,
				targetPos,
				target.quadrant
			);

			if (attackResult.hit) {
				lastHitTargetPos = targetPos;

				const attackerDamageDealt = calculateModifiedValue(1.0, attackerRuntime, "damageDealt");
				const targetDamageTaken = calculateModifiedValue(1.0, localRuntime, "damageTaken");
				const finalDamage = Math.round(
					attackResult.damage * attackerDamageDealt * targetDamageTaken
				);

				const damageResult = calculateDamage(
					targetSpec,
					localRuntime,
					finalDamage,
					weaponSpec.damageType,
					attackerPos,
					targetPos
				);

				// 累积更新本地状态
				st.hull = Math.round(Math.max(0, st.hull - damageResult.hullDamage));
				if (damageResult.armorQuadrant >= 0 && damageResult.armorQuadrant < 6) {
					st.armor[damageResult.armorQuadrant] = Math.round(
						Math.max(0, st.armor[damageResult.armorQuadrant]! - damageResult.armorDamage)
					);
				}
				st.fluxHard = Math.round(st.fluxHard + damageResult.fluxGenerated);
				st.destroyed = st.hull <= 0;
				st.overloaded =
					st.fluxHard + st.fluxSoft >= Math.round(targetSpec.fluxCapacity ?? 0) && !st.overloaded;

				events.push(
					createEngineEvent("attack", ship.$id, {
						attackerId: ship.$id,
						targetId: target.targetId,
						weaponId: alloc.mountId,
						weaponName: mount.displayName ?? alloc.mountId,
						targetName: targetToken.metadata?.name ?? target.targetId,
						baseDamage: Math.round(weaponSpec.damage),
						projectileCount: weaponSpec.projectilesPerShot ?? 1,
						damageType: weaponSpec.damageType,
						distance: Math.round(distanceBetween(attackerPos, targetPos)),
						hitDamage: Math.round(attackResult.damage),
						finalDamage,
						hullDamage: Math.round(damageResult.hullDamage),
						armorDamage: Math.round(damageResult.armorDamage),
						armorQuadrant: damageResult.armorQuadrant,
						shieldHit: damageResult.shieldHit,
						fluxGenerated: Math.round(damageResult.fluxGenerated),
						destroyed: st.destroyed,
						overloaded: st.overloaded,
					})
				);

				if (st.overloaded) {
					events.push(
						createEngineEvent("overload", target.targetId, {
							tokenId: target.targetId,
							tokenName: targetToken.metadata?.name ?? target.targetId,
							totalFlux: Math.round(st.fluxHard + st.fluxSoft),
							fluxCapacity: Math.round(targetSpec.fluxCapacity ?? 0),
						})
					);
				}

				if (st.destroyed) {
					events.push(
						createEngineEvent("destroyed", target.targetId, {
							tokenId: target.targetId,
							tokenName: targetToken.metadata?.name ?? target.targetId,
						})
					);
				}
			}

			totalFluxCost += weaponSpec.fluxCostPerShot ?? 0;
		}

		const weaponHeading = angleBetween(attackerPos, lastHitTargetPos);
		updatedWeapons[weaponIdx] = {
			...weaponRuntime,
			state: "FIRED" as const,
			currentHeading: weaponHeading,
		};
	}

	// 生成目标 runtimeUpdates
	runtimeUpdates.push(
		...finalizeLocalStates(localState, state.tokens as Record<string, { [key: string]: unknown }>)
	);

	// 攻击者过载结算
	runtimeUpdates.push({
		tokenId: ship.$id,
		updates: finalizeAttackerOverload(
			ship as unknown as { [key: string]: unknown },
			totalFluxCost,
			updatedWeapons,
			events
		),
	});

	return { runtimeUpdates, events };
}

// ==================== applyDeviation（偏差射击 — 不造成伤害） ====================

export function applyDeviation(context: EngineContext): EngineResult {
	const { state, ship } = context;
	const payload = context.payload as Record<string, unknown>;

	if (!ship) return { runtimeUpdates: [], events: [] };

	const runtimeUpdates: TokenRuntimeUpdate[] = [];
	const events: ReturnType<typeof createEngineEvent>[] = [];

	const allocations = parseAllocations(payload);
	if (allocations.length === 0) return { runtimeUpdates, events };

	const attackerSpec = ship.spec;
	const attackerRuntime = ship.runtime;
	const attackerPos = attackerRuntime.position ?? { x: 0, y: 0 };
	let totalFluxCost = 0;
	const updatedWeapons = attackerRuntime.weapons ? [...attackerRuntime.weapons] : [];

	for (const alloc of allocations) {
		const mount = attackerSpec.mounts?.find((m) => m.id === alloc.mountId);
		const weaponIdx = updatedWeapons.findIndex((w) => w.mountId === alloc.mountId);
		if (weaponIdx === -1 || !mount) continue;
		const weaponRuntime = updatedWeapons[weaponIdx];
		if (!weaponRuntime) continue;
		const weaponSpec = mount.weapon?.spec;
		if (!weaponSpec) continue;
		// 服务端武器就绪状态验证
		if (weaponRuntime.state !== "READY") continue;

		let lastTargetPos = attackerPos;

		for (const target of alloc.targets) {
			const targetToken = state.tokens[target.targetId];
			if (!targetToken) continue;
			const targetRuntime = targetToken.runtime;
			if (!targetRuntime || targetRuntime.destroyed) continue;
			lastTargetPos = targetRuntime.position ?? { x: 0, y: 0 };

			events.push(
				createEngineEvent("deviation", ship.$id, {
					attackerId: ship.$id,
					targetId: target.targetId,
					weaponId: alloc.mountId,
					weaponName: mount.displayName ?? alloc.mountId,
					targetName: targetToken.metadata?.name ?? target.targetId,
				})
			);

			totalFluxCost += weaponSpec.fluxCostPerShot ?? 0;
		}

		const weaponHeading = angleBetween(attackerPos, lastTargetPos);
		updatedWeapons[weaponIdx] = {
			...weaponRuntime,
			state: "FIRED" as const,
			currentHeading: weaponHeading,
		};
	}

	// 攻击者过载结算（共享 finalizeAttackerOverload）
	runtimeUpdates.push({
		tokenId: ship.$id,
		updates: finalizeAttackerOverload(
			ship as unknown as { [key: string]: unknown },
			totalFluxCost,
			updatedWeapons,
			events
		),
	});

	return { runtimeUpdates, events };
}
