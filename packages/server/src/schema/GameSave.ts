/**
 * 存档序列化
 *
 * 将游戏状态序列化为可持久化的格式
 */

import { GAME_SAVE_VERSION } from "./constants.js";
import type { GameSave, ShipSave, WeaponSave } from "./types.js";
import { GameRoomState } from "./GameSchema.js";
import { ShipState, WeaponSlot } from "./ShipStateSchema.js";
import { getShipHullSpec, getWeaponSpec } from "@vt/data";

// 重导出版本号供其他模块使用
export { GAME_SAVE_VERSION } from "./constants.js";

/**
 * 序列化游戏状态为存档格式
 */
export function serializeGameSave(
	state: GameRoomState,
	roomId: string,
	saveName: string,
	description?: string
): GameSave {
	const ships: ShipSave[] = [];

	state.ships.forEach((ship: ShipState) => {
		const weapons: WeaponSave[] = [];

		ship.weapons.forEach((w: WeaponSlot) => {
			weapons.push({
				mountId: w.mountId,
				instanceId: w.instanceId,
				weaponSpecId: w.weaponSpecId,
				state: w.state,
				cooldownRemaining: w.cooldownRemaining,
				currentAmmo: w.currentAmmo,
				reloadProgress: w.reloadProgress,
				burstRemaining: w.burstRemaining,
				currentTurretAngle: w.currentTurretAngle,
			});
		});

		ships.push({
			id: ship.id,
			hullId: ship.hullType,
			name: ship.name,
			faction: ship.faction,
			ownerId: ship.ownerId,
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			hullCurrent: ship.hull.current,
			hullMax: ship.hull.max,
			fluxHard: ship.flux.hard,
			fluxSoft: ship.flux.soft,
			fluxMax: ship.flux.max,
			shieldActive: ship.shield.active,
			shieldCurrent: ship.shield.current,
			shieldMax: ship.shield.max,
			shieldOrientation: ship.shield.orientation,
			armorGrid: [...ship.armor.quadrants],
			weapons,
			isOverloaded: ship.isOverloaded,
			overloadTime: ship.overloadTime,
			hasMoved: ship.hasMoved,
			hasFired: ship.hasFired,
			movePhase: ship.movePhase,
			phaseAForwardUsed: ship.phaseAForwardUsed,
			phaseAStrafeUsed: ship.phaseAStrafeUsed,
			phaseTurnUsed: ship.phaseTurnUsed,
			phaseCForwardUsed: ship.phaseCForwardUsed,
			phaseCStrafeUsed: ship.phaseCStrafeUsed,
		});
	});

	return {
		id: `save_${Date.now()}_${roomId}`,
		name: saveName,
		description,
		createdAt: Date.now(),
		updatedAt: Date.now(),
		version: GAME_SAVE_VERSION,
		turnCount: state.turnCount,
		currentPhase: state.currentPhase,
		activeFaction: state.activeFaction,
		ships,
		mapWidth: state.mapWidth,
		mapHeight: state.mapHeight,
	};
}

/**
 * 反序列化舰船存档数据
 *
 * 注意：仅恢复动态状态，基础属性从舰船规格重新加载
 */
export function deserializeShipSave(data: ShipSave): ShipState {
	const ship = new ShipState();

	// 基础标识
	ship.id = data.id;
	ship.hullType = data.hullId;
	ship.name = data.name;
	ship.faction = data.faction;
	ship.ownerId = data.ownerId;

	// 位置和朝向
	ship.transform.x = data.x;
	ship.transform.y = data.y;
	ship.transform.heading = data.heading;

	// 从舰船规格恢复基础属性
	const hullSpec = getShipHullSpec(data.hullId);
	if (hullSpec) {
		ship.hull.max = hullSpec.hitPoints;
		ship.flux.max = hullSpec.fluxCapacity;
		ship.flux.dissipation = hullSpec.fluxDissipation;
		ship.armor.maxPerQuadrant = hullSpec.armorMax;
		ship.maxSpeed = hullSpec.maxSpeed;
		ship.maxTurnRate = hullSpec.maxTurnRate;
		ship.width = hullSpec.width;
		ship.length = hullSpec.length;

		// 护盾属性
		ship.shield.type = hullSpec.shieldType;
		ship.shield.arc = hullSpec.shieldArc;
		ship.shield.radius = hullSpec.shieldRadius;
	}

	// 动态状态（从存档恢复）
	ship.hull.current = data.hullCurrent;
	ship.flux.hard = data.fluxHard;
	ship.flux.soft = data.fluxSoft;
	ship.shield.active = data.shieldActive;
	ship.shield.current = data.shieldCurrent;
	ship.shield.max = data.shieldMax;
	ship.shield.orientation = data.shieldOrientation ?? ship.transform.heading;

	// 护甲状态
	data.armorGrid.forEach((v, i) => ship.armor.setQuadrant(i, v));

	// 过载状态
	ship.isOverloaded = data.isOverloaded;
	ship.overloadTime = data.overloadTime ?? 0;

	// 行动状态
	ship.hasMoved = data.hasMoved;
	ship.hasFired = data.hasFired;
	ship.movePhase = data.movePhase ?? "PHASE_A";
	ship.phaseAForwardUsed = data.phaseAForwardUsed ?? 0;
	ship.phaseAStrafeUsed = data.phaseAStrafeUsed ?? 0;
	ship.phaseTurnUsed = data.phaseTurnUsed ?? 0;
	ship.phaseCForwardUsed = data.phaseCForwardUsed ?? 0;
	ship.phaseCStrafeUsed = data.phaseCStrafeUsed ?? 0;

	// 武器恢复
	// 注意：武器需要从规格重新创建，然后恢复动态状态
	if (hullSpec) {
		for (const mount of hullSpec.weaponMounts) {
			const savedWeapon = data.weapons.find(w => w.mountId === mount.id);
			if (!savedWeapon) continue;

			// 从武器规格创建
			const weaponSpec = getWeaponSpec(savedWeapon.weaponSpecId);
			if (!weaponSpec) continue;

			// 创建武器槽位（简化版本，只恢复必要状态）
			const weapon = new WeaponSlot();
			weapon.mountId = mount.id;
			weapon.displayName = mount.displayName ?? mount.id;
			weapon.mountOffsetX = mount.position?.x ?? 0;
			weapon.mountOffsetY = mount.position?.y ?? 0;
			weapon.mountType = mount.type;
			weapon.mountSize = mount.size;
			weapon.mountFacing = mount.facing;
			weapon.currentTurretAngle = savedWeapon.currentTurretAngle ?? mount.facing;
			weapon.arc = mount.arc;

			weapon.weaponSpecId = savedWeapon.weaponSpecId;
			weapon.instanceId = savedWeapon.instanceId;
			weapon.name = weaponSpec.name;
			weapon.category = weaponSpec.category;
			weapon.damageType = weaponSpec.damageType;
			weapon.size = weaponSpec.size;
			weapon.damage = weaponSpec.damage;
			weapon.baseDamage = weaponSpec.damage;
			weapon.range = weaponSpec.range;
			weapon.minRange = weaponSpec.minRange ?? 0;
			weapon.fluxCost = weaponSpec.fluxCost;
			weapon.cooldownMax = weaponSpec.cooldown;
			weapon.maxAmmo = weaponSpec.ammo ?? 0;
			weapon.reloadTime = weaponSpec.reloadTime ?? 0;
			weapon.opCost = weaponSpec.opCost;
			weapon.burstSize = weaponSpec.burstSize ?? 1;
			weapon.burstDelay = weaponSpec.burstDelay ?? 0.1;
			weapon.ignoresShields = weaponSpec.ignoresShields;

			// 恢复动态状态
			weapon.state = savedWeapon.state;
			weapon.cooldownRemaining = savedWeapon.cooldownRemaining;
			weapon.currentAmmo = savedWeapon.currentAmmo ?? weapon.maxAmmo;
			weapon.reloadProgress = savedWeapon.reloadProgress ?? 0;
			weapon.burstRemaining = savedWeapon.burstRemaining ?? 0;

			ship.weapons.set(mount.id, weapon);
		}
	}

	return ship;
}