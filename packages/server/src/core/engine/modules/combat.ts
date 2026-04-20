/**
 * 战斗模块
 * 基于 @vt/data 权威设计
 */

import type { EngineContext } from "../context.js";
import { applyStateUpdates, createAttackEvent, createDamageEvent, createShipDestroyedEvent } from "../context.js";
import { calculateWeaponAttack, setWeaponFired } from "../rules/weapon.js";
import { calculateDamage } from "../rules/damage.js";
import { calculateModifiedValue } from "./modifier.js";

/**
 * 应用战斗Action
 */
export function applyCombat(context: EngineContext): { newState: any; events: any[] } {
  const { state, action, ship, targetShip, weapon } = context;
  const payload = action.payload as any;
  
  if (!ship || !targetShip || !weapon) {
    throw new Error("Missing required combat data");
  }

  const events = [];
  const updates = new Map<string, any>();

  // 计算武器攻击
  const attackResult = calculateWeaponAttack(
    weapon.weapon || {},
    weapon,
    ship.shipJson.ship,
    ship.runtime,
    targetShip.shipJson.ship,
    targetShip.runtime,
    ship.runtime.position,
    targetShip.runtime.position,
    payload.targetQuadrant
  );

  // 更新攻击者状态
	const newAttackerRuntime = {
		...ship.runtime,
		hasFired: true,
		weapons: updateWeaponAfterFire(ship.runtime.weapons, payload.weaponId),
	};

	// 武器开火产生软辐能（攻击者）
	// 远行星号规则：武器开火产生的辐能为软辐能
	const weaponFluxCost = (weapon.weapon as any)?.fluxCostPerShot || 0;
	newAttackerRuntime.fluxSoft = (newAttackerRuntime.fluxSoft || 0) + weaponFluxCost;

	const attackerUpdates = { runtime: newAttackerRuntime };
	updates.set(`ship:${ship.id}`, attackerUpdates);

  // 创建攻击事件
  events.push(createAttackEvent(
    ship.id,
    targetShip.id,
    payload.weaponId,
    attackResult.damage,
    attackResult.hit
  ));

// 如果命中，处理伤害
	if (attackResult.hit && attackResult.damage > 0) {
		// 应用攻击者增伤修正（damageDealt）
		const attackerDamageDealt = calculateModifiedValue(1.0, ship.runtime, "damageDealt");
		// 应用目标减伤/易伤修正（damageTaken）
		const targetDamageTaken = calculateModifiedValue(1.0, targetShip.runtime, "damageTaken");

		// 最终伤害 = 基础伤害 × 攻击者增伤 × 目标易伤
		const finalDamage = attackResult.damage * attackerDamageDealt * targetDamageTaken;

		// 计算详细伤害
		const damageResult = calculateDamage(
			targetShip.shipJson.ship,
			targetShip.runtime,
			finalDamage,
			(weapon.weapon as any)?.damageType || "KINETIC",
			ship.runtime.position, // 攻击者位置作为命中点
			targetShip.runtime.position
		);

    // 更新目标状态
    const targetUpdates = applyDamageToShip(targetShip, damageResult);
    updates.set(`ship:${targetShip.id}`, targetUpdates);

    // 创建伤害事件
    events.push(createDamageEvent(
      targetShip.id,
      damageResult.damageApplied,
      (weapon.weapon as any)?.damageType || "KINETIC",
      ship.id,
      damageResult.shieldHit,
      damageResult.armorHit
    ));

    // 如果目标被摧毁，创建摧毁事件
    if (damageResult.targetDestroyed) {
      events.push(createShipDestroyedEvent(
        targetShip.id,
        ship.id,
        payload.weaponId
      ));
    }
  }

  // 应用状态更新
  const newState = applyStateUpdates(state, updates);

  return { newState, events };
}

/**
 * 更新武器状态（开火后）
 * 将指定武器设为 "FIRED" 状态
 */
function updateWeaponAfterFire(weapons: any[], weaponId: string): any[] {
  if (!weapons) return weapons;
  
  return weapons.map(weapon => {
    if (weapon.mountId === weaponId) {
      return setWeaponFired(weapon);
    }
    return weapon;
  });
}

/**
 * 应用伤害到舰船
 */
function applyDamageToShip(ship: any, damageResult: any): any {
  const newRuntime = { ...ship.runtime };

  // 更新生命值
  if (newRuntime.hull !== undefined) {
    newRuntime.hull = Math.max(0, newRuntime.hull - damageResult.hullDamage);
    if (newRuntime.hull <= 0) {
      newRuntime.destroyed = true;
    }
  }

  // 更新护甲
  if (damageResult.armorHit && damageResult.armorQuadrant >= 0) {
    const armor = [...(newRuntime.armor || [0, 0, 0, 0, 0, 0])];
    armor[damageResult.armorQuadrant] = Math.max(
      0,
      armor[damageResult.armorQuadrant] - damageResult.armorDamage
    );
    newRuntime.armor = armor;
  }

  // 更新辐能
	// 远行星号规则：
	// - 护盾吸收攻击 → 目标产生硬辐能
	// - 直接命中护甲/船体 → 不产生额外辐能（武器开火辐能在攻击者身上）
	if (damageResult.shieldHit && damageResult.fluxGenerated > 0) {
		newRuntime.fluxHard = (newRuntime.fluxHard || 0) + damageResult.fluxGenerated;
	}

  // 检查过载
  const totalFlux = (newRuntime.fluxSoft || 0) + (newRuntime.fluxHard || 0);
  const fluxCapacity = ship.shipJson.ship.fluxCapacity || 0;
  
  if (totalFlux > fluxCapacity && !newRuntime.overloaded) {
    newRuntime.overloaded = true;
    newRuntime.overloadTime = 1; // 过载持续1回合
  }

  return {
    runtime: newRuntime,
  };
}

/**
 * 检查攻击合法性
 */
export function validateAttack(
  attacker: any,
  target: any,
  weaponId: string,
  distance: number
): { valid: boolean; error?: string } {
  // 检查攻击者状态
  if (attacker.runtime.destroyed) {
    return { valid: false, error: "Attacker is destroyed" };
  }

  if (attacker.runtime.overloaded) {
    return { valid: false, error: "Attacker is overloaded" };
  }

  if (attacker.runtime.hasFired) {
    return { valid: false, error: "Attacker has already fired this turn" };
  }

  // 检查目标状态
  if (target.runtime.destroyed) {
    return { valid: false, error: "Target is destroyed" };
  }

  // 检查武器
  const weapon = attacker.runtime.weapons?.find((w: { mountId: string }) => w.mountId === weaponId);
  if (!weapon) {
    return { valid: false, error: "Weapon not found" };
  }

  if (weapon.state !== "READY") {
    return { valid: false, error: "Weapon is not ready" };
  }

  // 检查射程
  const weaponSpec = weapon.weapon || {};
  const effectiveRange = weaponSpec.range * (attacker.shipJson.ship.rangeModifier || 1.0);
  
  if (distance > effectiveRange) {
    return { valid: false, error: "Target out of range" };
  }

  // 检查最小射程
  const minRange = weaponSpec.minRange || 0;
  if (distance < minRange) {
    return { valid: false, error: "Target too close" };
  }

  return { valid: true };
}