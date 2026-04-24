/**
 * 战斗模块
 *
 * 纯计算层：接受 EngineContext，返回 EngineResult（更新指令列表）。
 * 支持多武器多目标分配（allocations），与 handlers.ts 的 attack handler 对齐。
 *
 * 基于 @vt/data GameRoomState（Record-based）
 */

import type { EngineContext, EngineResult, TokenRuntimeUpdate } from "../context.js";
import { createEngineEvent } from "../context.js";
import { calculateWeaponAttack } from "../rules/weapon.js";
import { calculateDamage } from "../rules/damage.js";
import { calculateModifiedValue } from "./modifier.js";
import { angleBetween } from "@vt/data";

/**
 * 武器分配 - 单武器对多目标的分配
 */
export interface WeaponAllocation {
  mountId: string;
  targets: { targetId: string; shotCount: number; quadrant?: number }[];
}

/**
 * 应用战斗 Action（ATTACK）
 * 支持多武器多目标分配
 */
export function applyCombat(context: EngineContext): EngineResult {
  const { state, ship } = context;
  const payload = context.payload as Record<string, unknown>;

  if (!ship) {
    return { runtimeUpdates: [], events: [] };
  }

  const runtimeUpdates: TokenRuntimeUpdate[] = [];
  const events: ReturnType<typeof createEngineEvent>[] = [];

  // 从原始 client payload 解析分配（支持 shots 和 shotCount 两种格式）
  const rawAllocations = payload["allocations"] as Array<Record<string, unknown>> | undefined;
  if (!rawAllocations || rawAllocations.length === 0) {
    return { runtimeUpdates, events };
  }

  const allocations: WeaponAllocation[] = rawAllocations.map((alloc) => {
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

    let lastHitTargetPos = attackerPos;

    for (const target of alloc.targets) {
      const targetToken = state.tokens[target.targetId];
      if (!targetToken) continue;
      const targetRuntime = targetToken.runtime;
      if (!targetRuntime || targetRuntime.destroyed) continue;
      const targetPos = targetRuntime.position ?? { x: 0, y: 0 };

      const attackResult = calculateWeaponAttack(
        weaponSpec,
        weaponRuntime,
        attackerSpec,
        attackerRuntime,
        targetToken.spec,
        targetRuntime,
        attackerPos,
        targetPos,
        target.quadrant
      );

      if (attackResult.hit) {
        lastHitTargetPos = targetPos;

        // 应用攻击者增伤修正（damageDealt）
        const attackerDamageDealt = calculateModifiedValue(1.0, attackerRuntime, "damageDealt");
        // 应用目标减伤/易伤修正（damageTaken）
        const targetDamageTaken = calculateModifiedValue(1.0, targetRuntime, "damageTaken");
        // 最终伤害 = 基础伤害 × 攻击者增伤 × 目标易伤
        const finalDamage = Math.round(attackResult.damage * attackerDamageDealt * targetDamageTaken);

        const damageResult = calculateDamage(
          targetToken.spec,
          targetRuntime,
          finalDamage,
          weaponSpec.damageType,
          attackerPos,
          targetPos
        );

        // 构建目标更新
        const newHull = Math.max(0, (targetRuntime.hull ?? 0) - damageResult.hullDamage);
        const newArmor = [...(targetRuntime.armor ?? [0, 0, 0, 0, 0, 0])];
        if (damageResult.armorQuadrant >= 0 && damageResult.armorQuadrant < 6) {
          const quadrant = damageResult.armorQuadrant;
          newArmor[quadrant] = Math.max(0, newArmor[quadrant]! - damageResult.armorDamage);
        }
        const newFluxHard = (targetRuntime.fluxHard ?? 0) + damageResult.fluxGenerated;
        const newFluxSoft = targetRuntime.fluxSoft ?? 0;
        const newTotalFlux = newFluxHard + newFluxSoft;
        const destroyed = newHull <= 0;
        const overloaded = newTotalFlux >= (targetToken.spec.fluxCapacity ?? 0) && !targetRuntime.overloaded;

        const targetUpdates: Record<string, unknown> = {
          hull: newHull,
          armor: newArmor,
          fluxHard: newFluxHard,
          overloaded,
          destroyed,
        };

        // 过载时补全 triggerOverload 的副作用：关闭护盾 + 禁用武器
        if (overloaded) {
          targetUpdates["overloadTime"] = 1;
          if (targetRuntime.shield) {
            targetUpdates["shield"] = { active: false, direction: targetRuntime.shield.direction ?? 0 };
          }
          if (targetRuntime.weapons) {
            targetUpdates["weapons"] = targetRuntime.weapons.map((w: any) => ({
              ...w,
              state: w.state === "READY" || w.state === "COOLDOWN" ? "DISABLED" : w.state,
            }));
          }
        }

        runtimeUpdates.push({
          tokenId: target.targetId,
          updates: targetUpdates,
        });

        events.push(createEngineEvent("attack", ship.$id, {
          attackerId: ship.$id,
          targetId: target.targetId,
          weaponId: alloc.mountId,
          damage: damageResult.hullDamage + damageResult.armorDamage,
        }));

        if (destroyed) {
          events.push(createEngineEvent("destroyed", target.targetId, {
            tokenId: target.targetId,
            tokenName: targetToken.metadata?.name ?? target.targetId,
          }));
        }
      }

      totalFluxCost += weaponSpec.fluxCostPerShot ?? 0;
    }

    // 更新武器状态（开火后指向目标）
    const weaponHeading = angleBetween(attackerPos, lastHitTargetPos);
    updatedWeapons[weaponIdx] = {
      ...weaponRuntime,
      state: "FIRED" as const,
      currentHeading: weaponHeading,
    };
  }

  // 攻击者辐能增加 + 武器状态更新
  const newAttackerFluxSoft = (attackerRuntime.fluxSoft ?? 0) + totalFluxCost;
  const newAttackerTotalFlux = newAttackerFluxSoft + (attackerRuntime.fluxHard ?? 0);
  const attackerCapacity = attackerSpec.fluxCapacity ?? 0;
  const attackerOverloaded = newAttackerTotalFlux >= attackerCapacity && !attackerRuntime.overloaded;

  const attackerUpdates: Record<string, unknown> = {
    fluxSoft: newAttackerFluxSoft,
    weapons: updatedWeapons,
  };

  if (attackerOverloaded) {
    attackerUpdates["overloaded"] = true;
    attackerUpdates["overloadTime"] = 1;
    if (attackerRuntime.shield) {
      attackerUpdates["shield"] = { active: false, direction: attackerRuntime.shield.direction ?? 0 };
    }
    // 武器过载：将 READY/COOLDOWN 状态的武器设为 DISABLED
    attackerUpdates["weapons"] = updatedWeapons.map((w: any) => ({
      ...w,
      state: w.state === "READY" || w.state === "COOLDOWN" ? "DISABLED" : w.state,
    }));
  }

  runtimeUpdates.push({
    tokenId: ship.$id,
    updates: attackerUpdates,
  });

  return { runtimeUpdates, events };
}
